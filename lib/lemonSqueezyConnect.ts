// Import de clients depuis un compte Lemon Squeezy par clé API — même
// principe que lib/paddleConnect.ts (pas d'OAuth "Connect" tiers chez Lemon
// Squeezy non plus : la clé API du compte, générée par le vendeur dans ses
// propres réglages, est l'unique moyen de lire ses données). Voir la
// migration 20260907020000_add_paddle_lemonsqueezy_connections. API
// documentée en JSON:API (voir https://docs.lemonsqueezy.com/api) — chaque
// réponse porte `data`/`included`, jamais un objet nu.

const BASE_URL = 'https://api.lemonsqueezy.com/v1';
const MAX_CUSTOMERS = 2000; // même plafond et même raison que Stripe Connect

interface JsonApiResource {
  type: string;
  id: string;
  attributes: Record<string, unknown>;
  relationships?: Record<string, { data?: { id: string; type: string } | null }>;
}

interface JsonApiResponse<T = JsonApiResource> {
  data: T | T[];
  included?: JsonApiResource[];
  links?: { next?: string | null };
}

async function lemonSqueezyFetch<T = JsonApiResource>(url: string, apiKey: string): Promise<JsonApiResponse<T>> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body?.errors?.[0]?.detail || `Lemon Squeezy a répondu ${response.status}.`;
    throw new Error(detail);
  }
  return body as JsonApiResponse<T>;
}

// Le plus léger possible pour valider une clé avant de l'enregistrer —
// jamais fait confiance à "la clé a le bon format", toujours vérifié contre
// la vraie API, même logique que verifyPaddleApiKey.
export async function verifyLemonSqueezyApiKey(apiKey: string): Promise<void> {
  await lemonSqueezyFetch(`${BASE_URL}/subscriptions?page[size]=1`, apiKey);
}

// Statuts "encore en vie" — mêmes quatre statuts que Stripe
// (ACTIVE_SUBSCRIPTION_STATUSES dans lib/stripeConnect.ts) transposés au
// vocabulaire Lemon Squeezy : 'unpaid' y a le même sens que chez Stripe
// (échec de paiement, relances épuisées, mais l'abonnement n'est pas
// encore résilié) — encore un client à risque, pas encore un churn.
const ACTIVE_STATUSES = new Set(['active', 'on_trial', 'past_due', 'unpaid']);

// Pas de filtre serveur par statut : Lemon Squeezy ne documente pas de
// syntaxe fiable pour filtrer sur plusieurs statuts à la fois sur cet
// endpoint, donc on liste tout (borné par MAX_CUSTOMERS de toute façon) et
// on filtre ici — plus sûr qu'un paramètre de filtre deviné.
async function listAllSubscriptions(apiKey: string): Promise<JsonApiResource[]> {
  const subscriptions: JsonApiResource[] = [];
  let url: string | null = `${BASE_URL}/subscriptions?page[size]=100`;
  while (url && subscriptions.length < MAX_CUSTOMERS * 2) {
    const page: JsonApiResponse<JsonApiResource> = await lemonSqueezyFetch<JsonApiResource>(url, apiKey);
    const data = Array.isArray(page.data) ? page.data : [page.data];
    subscriptions.push(...data);
    url = page.links?.next ?? null;
  }
  return subscriptions;
}

interface SubscriptionPrice {
  unitPriceCents: number;
  intervalUnit: string;
  intervalQuantity: number;
}

// Le prix n'est jamais directement sur l'objet subscription chez Lemon
// Squeezy (contrairement à Stripe) — il faut passer par la ligne
// subscription-item, puis par le "price" catalogue auquel elle renvoie.
// `include=price` sideloade le prix dans la même réponse (JSON:API
// standard) ; si jamais l'API ne le renvoie pas dans `included` pour une
// raison quelconque, on retombe sur un second appel direct plutôt que de
// silencieusement compter 0€ de revenu pour ce client.
async function fetchSubscriptionPrice(subscriptionId: string, apiKey: string): Promise<SubscriptionPrice | null> {
  const page = await lemonSqueezyFetch(
    `${BASE_URL}/subscription-items?filter[subscription_id]=${subscriptionId}&include=price`,
    apiKey,
  );
  const items = Array.isArray(page.data) ? page.data : [page.data];
  const item = items[0];
  if (!item) return null;

  const priceId = item.relationships?.price?.data?.id;
  if (!priceId) return null;

  let priceResource = page.included?.find((r) => r.type === 'prices' && r.id === priceId);
  if (!priceResource) {
    const direct = await lemonSqueezyFetch(`${BASE_URL}/prices/${priceId}`, apiKey);
    priceResource = Array.isArray(direct.data) ? direct.data[0] : direct.data;
  }
  if (!priceResource) return null;

  const attrs = priceResource.attributes;
  return {
    unitPriceCents: Number(attrs.unit_price ?? 0),
    intervalUnit: String(attrs.renewal_interval_unit ?? 'month'),
    intervalQuantity: Number(attrs.renewal_interval_quantity ?? 1) || 1,
  };
}

function monthlyAmountFromPrice(price: SubscriptionPrice | null): number {
  if (!price || !price.unitPriceCents) return 0;
  const unitEuros = price.unitPriceCents / 100;
  const { intervalUnit, intervalQuantity } = price;
  if (intervalUnit === 'year') return unitEuros / 12 / intervalQuantity;
  if (intervalUnit === 'week') return (unitEuros * 52) / 12 / intervalQuantity;
  if (intervalUnit === 'day') return (unitEuros * 365) / 12 / intervalQuantity;
  return unitEuros / intervalQuantity; // 'month'
}

export interface LemonSqueezySourcedClient {
  name: string;
  email: string | null;
  revenue_monthly: number;
  payment_status: string;
  renewal_date: string;
  lemonsqueezy_status: string;
  customer_since_days: number;
  [key: string]: unknown;
}

// Même petit pool de concurrence bornée que fetchCustomersById dans
// lib/paddleConnect.ts, pour la même raison : un appel supplémentaire par
// abonnement (prix), fait par petits groupes plutôt que tous en même
// temps.
const PRICE_FETCH_CONCURRENCY = 8;

// Même format de sortie que fetchClientsFromConnectedAccount (Stripe) et
// fetchClientsFromPaddleAccount — voir la note dans lib/stripeConnect.ts.
export async function fetchClientsFromLemonSqueezyAccount(apiKey: string): Promise<LemonSqueezySourcedClient[]> {
  const all = await listAllSubscriptions(apiKey);
  const active = all
    .filter((s) => ACTIVE_STATUSES.has(String(s.attributes.status)))
    .slice(0, MAX_CUSTOMERS);

  const prices = new Map<string, SubscriptionPrice | null>();
  for (let i = 0; i < active.length; i += PRICE_FETCH_CONCURRENCY) {
    const batch = active.slice(i, i + PRICE_FETCH_CONCURRENCY);
    const fetched = await Promise.all(
      batch.map((s) => fetchSubscriptionPrice(s.id, apiKey).catch(() => null)),
    );
    batch.forEach((s, idx) => prices.set(s.id, fetched[idx]));
  }

  return active.map((s) => {
    const attrs = s.attributes;
    const status = String(attrs.status ?? '');
    const renewsAt = attrs.renews_at ? String(attrs.renews_at) : null;
    const createdAt = attrs.created_at ? String(attrs.created_at) : null;

    return {
      name: (attrs.user_name as string) || (attrs.user_email as string) || s.id,
      email: (attrs.user_email as string) ?? null,
      revenue_monthly: Math.round(monthlyAmountFromPrice(prices.get(s.id) ?? null) * 100) / 100,
      payment_status: status === 'active' || status === 'on_trial' ? 'ok' : status,
      renewal_date: renewsAt ? renewsAt.slice(0, 10) : '',
      lemonsqueezy_status: status,
      // Approximation volontaire : la date de création de CET abonnement,
      // pas la première commande jamais passée par ce client (qui
      // nécessiterait un appel supplémentaire vers /customers pour un gain
      // marginal — voir le même arbitrage dans lib/paddleConnect.ts).
      customer_since_days: createdAt ? Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000) : 0,
    };
  });
}
