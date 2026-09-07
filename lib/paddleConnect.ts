// Import de clients depuis un compte Paddle Billing par clé API — voir la
// migration 20260907020000_add_paddle_lemonsqueezy_connections pour
// pourquoi ce modèle diffère de Stripe Connect (pas d'OAuth "Connect" tiers
// chez Paddle : la clé API du compte est l'unique moyen de lire ses
// données, donc un vrai secret à stocker chiffré plutôt qu'un simple id de
// compte). Authentification documentée par Paddle : header
// `Authorization: Bearer <clé>`, voir
// https://developer.paddle.com/api-reference/about/authentication.

// Même plafond que Stripe Connect (voir lib/stripeConnect.ts) et pour la
// même raison : borner la taille d'un import/analyse IA déclenché depuis un
// compte externe, quelle que soit sa taille réelle.
const MAX_CUSTOMERS = 2000;

// Sandbox et production sont deux comptes Paddle entièrement séparés, avec
// des URLs de base et des clés distinctes — jamais interchangeables (voir
// doc Paddle). L'utilisateur choisit l'environnement au moment de
// connecter sa clé (voir app/api/paddle/connect/route.ts).
export type PaddleEnvironment = 'production' | 'sandbox';

function baseUrl(environment: PaddleEnvironment): string {
  return environment === 'sandbox' ? 'https://sandbox-api.paddle.com' : 'https://api.paddle.com';
}

interface PaddlePaginatedResponse<T> {
  data: T[];
  meta?: { pagination?: { next?: string | null; has_more?: boolean } };
  error?: { code: string; detail: string };
}

async function paddleFetch<T>(url: string, apiKey: string): Promise<PaddlePaginatedResponse<T>> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body?.error?.detail || `Paddle a répondu ${response.status}.`;
    throw new Error(detail);
  }
  return body as PaddlePaginatedResponse<T>;
}

// Appel le plus léger possible (une seule ligne demandée) pour valider
// qu'une clé fonctionne vraiment avant de l'enregistrer — jamais fait
// confiance à "la requête a un format valide", toujours vérifié contre la
// vraie API, même logique que la connexion Stripe (le premier appel après
// l'échange OAuth aurait échoué de la même façon si le compte était
// invalide).
export async function verifyPaddleApiKey(apiKey: string, environment: PaddleEnvironment): Promise<void> {
  await paddleFetch(`${baseUrl(environment)}/subscriptions?per_page=1`, apiKey);
}

interface PaddlePrice {
  unit_price?: { amount?: string; currency_code?: string };
  billing_cycle?: { interval?: string; frequency?: number } | null;
}

interface PaddleSubscriptionItem {
  quantity?: number;
  price?: PaddlePrice;
}

interface PaddleSubscription {
  id: string;
  status: string;
  customer_id: string;
  currency_code: string;
  created_at: string;
  next_billed_at: string | null;
  canceled_at: string | null;
  billing_cycle?: { interval?: string; frequency?: number } | null;
  items: PaddleSubscriptionItem[];
}

interface PaddleCustomer {
  id: string;
  name: string | null;
  email: string | null;
  created_at: string;
}

// Mêmes statuts "encore en vie" que Stripe (voir ACTIVE_SUBSCRIPTION_STATUSES
// dans lib/stripeConnect.ts), adaptés au vocabulaire Paddle. 'paused' est
// volontairement exclu : chez Paddle c'est une vraie pause décidée (par le
// marchand ou le client), pas un signal d'échec de paiement comme 'unpaid'
// chez Stripe — un abonnement en pause n'a pas de churn à prédire tant
// qu'il reste en pause.
const ACTIVE_STATUSES = new Set(['active', 'trialing', 'past_due']);

function monthlyAmountFromPrice(price: PaddlePrice | undefined, quantity: number, fallbackCycle: PaddleSubscription['billing_cycle']): number {
  const amountCents = Number(price?.unit_price?.amount ?? 0);
  if (!amountCents) return 0;
  const unitEuros = (amountCents / 100) * quantity;
  const cycle = price?.billing_cycle ?? fallbackCycle;
  const interval = cycle?.interval ?? 'month';
  const frequency = cycle?.frequency && cycle.frequency > 0 ? cycle.frequency : 1;
  if (interval === 'year') return unitEuros / 12 / frequency;
  if (interval === 'week') return (unitEuros * 52) / 12 / frequency;
  if (interval === 'day') return (unitEuros * 365) / 12 / frequency;
  return unitEuros / frequency; // 'month'
}

export interface PaddleSourcedClient {
  name: string;
  email: string | null;
  revenue_monthly: number;
  payment_status: string;
  renewal_date: string;
  paddle_status: string;
  customer_since_days: number;
  [key: string]: unknown;
}

// Petit pool de concurrence bornée — même idée que DRAFT_CONCURRENCY dans
// lib/prospectingDraft.ts : Paddle n'expose pas le nom/email du client
// directement sur l'abonnement (contrairement à Stripe qui permet
// d'expand data.customer dans le même appel), donc chaque client unique
// nécessite un second appel — fait par petits groupes plutôt que tous en
// même temps pour rester sous la limite de 100 req/s documentée par Paddle
// sans avoir à gérer un vrai rate-limiter.
const CUSTOMER_FETCH_CONCURRENCY = 8;

async function fetchCustomersById(
  ids: string[],
  apiKey: string,
  environment: PaddleEnvironment,
): Promise<Map<string, PaddleCustomer>> {
  const result = new Map<string, PaddleCustomer>();
  for (let i = 0; i < ids.length; i += CUSTOMER_FETCH_CONCURRENCY) {
    const batch = ids.slice(i, i + CUSTOMER_FETCH_CONCURRENCY);
    const fetched = await Promise.all(
      batch.map(async (id) => {
        try {
          const body = await paddleFetch<never>(`${baseUrl(environment)}/customers/${id}`, apiKey);
          return (body as unknown as { data: PaddleCustomer }).data;
        } catch {
          return null;
        }
      }),
    );
    for (const customer of fetched) {
      if (customer) result.set(customer.id, customer);
    }
  }
  return result;
}

// Même format de sortie que fetchClientsFromConnectedAccount (Stripe) et
// les lignes d'un CSV importé — voir la note dans lib/stripeConnect.ts,
// c'est ce qui permet à app/api/analyze de rester totalement aveugle à la
// provenance des données.
export async function fetchClientsFromPaddleAccount(
  apiKey: string,
  environment: PaddleEnvironment,
): Promise<PaddleSourcedClient[]> {
  const subscriptions: PaddleSubscription[] = [];
  let url: string | null = `${baseUrl(environment)}/subscriptions?per_page=100&status=active,trialing,past_due`;

  while (url && subscriptions.length < MAX_CUSTOMERS) {
    const page: PaddlePaginatedResponse<PaddleSubscription> = await paddleFetch<PaddleSubscription>(url, apiKey);
    subscriptions.push(...page.data);
    url = page.meta?.pagination?.has_more ? page.meta.pagination.next ?? null : null;
  }

  const capped = subscriptions.filter((s) => ACTIVE_STATUSES.has(s.status)).slice(0, MAX_CUSTOMERS);
  const uniqueCustomerIds = Array.from(new Set(capped.map((s) => s.customer_id)));
  const customers = await fetchCustomersById(uniqueCustomerIds, apiKey, environment);

  return capped.map((subscription) => {
    const customer = customers.get(subscription.customer_id);
    const revenueMonthly = subscription.items.reduce(
      (sum, item) => sum + monthlyAmountFromPrice(item.price, item.quantity ?? 1, subscription.billing_cycle),
      0,
    );

    return {
      name: customer?.name || customer?.email || subscription.customer_id,
      email: customer?.email ?? null,
      revenue_monthly: Math.round(revenueMonthly * 100) / 100,
      payment_status: subscription.status === 'active' || subscription.status === 'trialing' ? 'ok' : subscription.status,
      renewal_date: subscription.next_billed_at ? subscription.next_billed_at.slice(0, 10) : '',
      paddle_status: subscription.status,
      customer_since_days: customer?.created_at
        ? Math.floor((Date.now() - new Date(customer.created_at).getTime()) / 86_400_000)
        : 0,
    };
  });
}
