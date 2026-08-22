import crypto from 'crypto';
import Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';

// Sans plafond, un compte Stripe avec une base clients massive pourrait
// déclencher un import et une analyse IA arbitrairement gros — même garde-fou
// que le plafond de 2000 lignes sur l'upload CSV (voir app/api/analyze).
const MAX_CUSTOMERS = 2000;
const STATE_TTL_MS = 10 * 60 * 1000;

function getStateSecret(): string {
  const secret = process.env.STRIPE_CONNECT_STATE_SECRET;
  if (!secret) throw new Error('STRIPE_CONNECT_STATE_SECRET is not set');
  return secret;
}

// Le "state" OAuth protège contre le CSRF (un tiers qui forcerait un
// utilisateur à connecter le compte Stripe d'un attaquant à son insu) sans
// avoir besoin d'une table dédiée : on signe simplement userId+timestamp et
// on vérifie la signature au retour, avec une expiration courte.
export function signConnectState(userId: string): string {
  const timestamp = Date.now().toString();
  const signature = crypto
    .createHmac('sha256', getStateSecret())
    .update(`${userId}.${timestamp}`)
    .digest('hex');
  return `${userId}.${timestamp}.${signature}`;
}

export function verifyConnectState(state: string): string | null {
  const parts = state.split('.');
  if (parts.length !== 3) return null;
  const [userId, timestamp, signature] = parts;

  const expected = crypto
    .createHmac('sha256', getStateSecret())
    .update(`${userId}.${timestamp}`)
    .digest('hex');

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (sigBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return null;

  if (Date.now() - Number(timestamp) > STATE_TTL_MS) return null;
  return userId;
}

// Format distinct de signConnectState (préfixe littéral 'signup', jamais
// confondu avec un userId UUID) : utilisé quand aucun compte Churnly
// n'existe encore — inscription en un clic en liant Stripe avant même
// d'avoir créé le compte, comme "Sign up with GitHub". La langue choisie
// sur la page d'inscription est embarquée dans l'état signé puisqu'il n'y a
// pas encore de session ni de profil en base pour la retrouver au retour.
export function signSignupState(language: 'fr' | 'en'): string {
  const nonce = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now().toString();
  const signature = crypto
    .createHmac('sha256', getStateSecret())
    .update(`signup.${language}.${nonce}.${timestamp}`)
    .digest('hex');
  return `signup.${language}.${nonce}.${timestamp}.${signature}`;
}

export function verifySignupState(state: string): { language: 'fr' | 'en' } | null {
  const parts = state.split('.');
  if (parts.length !== 5 || parts[0] !== 'signup') return null;
  const [prefix, language, nonce, timestamp, signature] = parts;

  const expected = crypto
    .createHmac('sha256', getStateSecret())
    .update(`${prefix}.${language}.${nonce}.${timestamp}`)
    .digest('hex');

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (sigBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return null;

  if (Date.now() - Number(timestamp) > STATE_TTL_MS) return null;
  return { language: language === 'en' ? 'en' : 'fr' };
}

export function getConnectAuthUrl(state: string, redirectPath: string): string {
  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;
  if (!clientId) throw new Error('STRIPE_CONNECT_CLIENT_ID is not set');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    // Stripe réserve 'read_only' aux plateformes validées manuellement par
    // leur support ; 'read_write' est donc utilisé par défaut. Churnly ne
    // fait en pratique que lire les abonnements (voir
    // fetchClientsFromConnectedAccount) — jamais aucun appel d'écriture.
    scope: 'read_write',
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}${redirectPath}`,
    state,
  });
  return `https://connect.stripe.com/oauth/authorize?${params.toString()}`;
}

export async function exchangeCodeForAccount(code: string): Promise<string> {
  const stripe = getStripe();
  const response = await stripe.oauth.token({
    grant_type: 'authorization_code',
    code,
  });
  if (!response.stripe_user_id) {
    throw new Error('Stripe OAuth response missing stripe_user_id');
  }
  return response.stripe_user_id;
}

export interface ConnectedAccountProfile {
  email: string | null;
  companyName: string;
  businessDescription: string | null;
}

// Utilisé uniquement par le parcours d'inscription via Stripe (voir
// app/api/stripe/connect/signup-callback) pour pré-remplir le compte Churnly
// à partir du compte Stripe qui vient d'être lié, sans jamais redemander ces
// informations à l'utilisateur.
export async function fetchConnectedAccountProfile(accountId: string): Promise<ConnectedAccountProfile> {
  const stripe = getStripe();
  const account = await stripe.accounts.retrieve(accountId);
  return {
    email: account.email ?? null,
    companyName:
      account.business_profile?.name ||
      account.settings?.dashboard?.display_name ||
      account.email ||
      'Mon entreprise',
    // Stripe le demande déjà à ses propres comptes connectés — quand il est
    // rempli, ça évite de redemander la même information ; souvent absent ou
    // trop vague ("SaaS platform"), donc jamais traité comme suffisant en
    // soi : le compte reste invité à le préciser depuis /settings (voir la
    // bannière sur /dashboard) plutôt que de considérer le champ "acquis".
    businessDescription: account.business_profile?.product_description ?? null,
  };
}

export async function disconnectAccount(accountId: string): Promise<void> {
  const stripe = getStripe();
  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;
  if (!clientId) throw new Error('STRIPE_CONNECT_CLIENT_ID is not set');
  await stripe.oauth.deauthorize({
    client_id: clientId,
    stripe_user_id: accountId,
  });
}

// Statuts d'abonnement encore "en vie" — un abonnement déjà annulé n'a plus
// de churn à prédire, il a déjà churné, on ne l'inclut donc pas dans
// l'analyse (même logique que le CSV : on analyse des clients actuels).
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing', 'past_due', 'unpaid']);

function monthlyAmountFromPrice(price: Stripe.Price, quantity: number): number {
  if (!price.recurring || price.unit_amount == null) return 0;
  const monthlyUnit = price.unit_amount / 100;
  const { interval, interval_count: intervalCount } = price.recurring;
  if (interval === 'year') return (monthlyUnit / 12) / intervalCount;
  if (interval === 'week') return (monthlyUnit * 52) / 12 / intervalCount;
  if (interval === 'day') return (monthlyUnit * 365) / 12 / intervalCount;
  return monthlyUnit / intervalCount; // 'month'
}

export interface StripeSourcedClient {
  name: string;
  email: string | null;
  revenue_monthly: number;
  payment_status: string;
  renewal_date: string;
  cancel_at_period_end: boolean;
  stripe_status: string;
  customer_since_days: number;
  [key: string]: unknown;
}

// Récupère les clients avec un abonnement en cours sur le compte Stripe
// connecté, et les met dans le même format que les lignes d'un CSV importé
// — pour que tout le reste du pipeline d'analyse (voir app/api/analyze)
// n'ait strictement aucune idée de si les données viennent d'un fichier ou
// de Stripe.
export async function fetchClientsFromConnectedAccount(
  accountId: string,
): Promise<StripeSourcedClient[]> {
  const stripe = getStripe();
  const requestOptions = { stripeAccount: accountId };
  const clients: StripeSourcedClient[] = [];

  const subscriptions = stripe.subscriptions.list(
    { limit: 100, status: 'all', expand: ['data.customer', 'data.items.data.price'] },
    requestOptions,
  );

  for await (const subscription of subscriptions) {
    if (clients.length >= MAX_CUSTOMERS) break;
    if (!ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)) continue;

    const customer = subscription.customer;
    if (!customer || typeof customer === 'string' || customer.deleted) continue;

    const revenueMonthly = subscription.items.data.reduce((sum, item) => {
      const price = item.price;
      if (!price || typeof price === 'string') return sum;
      return sum + monthlyAmountFromPrice(price, item.quantity ?? 1);
    }, 0);

    // Depuis l'API Stripe 2025+, current_period_end vit sur chaque ligne
    // d'abonnement (un item peut avoir son propre cycle) plutôt que sur
    // l'abonnement lui-même — on prend le prochain renouvellement le plus
    // proche parmi les items, celui qui compte le plus pour la rétention.
    const nextRenewalTimestamp = subscription.items.data.reduce<number | null>((earliest, item) => {
      if (earliest === null || item.current_period_end < earliest) return item.current_period_end;
      return earliest;
    }, null);

    clients.push({
      name: customer.name || customer.email || customer.id,
      // Gardé comme vraie adresse de contact (pas juste un repli d'affichage
      // pour le nom ci-dessus) — c'est ce qui permet un jour d'écrire
      // vraiment à CE client plutôt qu'au compte Churnly lui-même, voir la
      // migration 20260822010000_add_client_email.
      email: customer.email ?? null,
      revenue_monthly: Math.round(revenueMonthly * 100) / 100,
      // 'past_due' / 'unpaid' sont les statuts Stripe eux-mêmes qui
      // signalent un problème de paiement — transmis tels quels, l'IA sait
      // déjà les interpréter comme n'importe quel autre champ du CSV.
      payment_status: subscription.status === 'active' || subscription.status === 'trialing' ? 'ok' : subscription.status,
      renewal_date: nextRenewalTimestamp ? new Date(nextRenewalTimestamp * 1000).toISOString().slice(0, 10) : '',
      // Signal natif Stripe qu'un CSV classique n'a jamais : le client a
      // déjà programmé l'arrêt de son abonnement à la fin de la période en
      // cours. C'est un facteur de risque quasi certain, pas une hypothèse.
      cancel_at_period_end: subscription.cancel_at_period_end,
      stripe_status: subscription.status,
      customer_since_days: Math.floor((Date.now() / 1000 - customer.created) / 86400),
    });
  }

  return clients;
}
