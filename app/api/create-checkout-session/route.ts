import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getStripe, priceDataForAmount } from '@/lib/stripe';
import { calcPrice, calcManagerPrice } from '@/lib/pricing';

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  const user = userData.user;

  // Le plan (Standard vs Performance, voir lib/pricing.ts) est un vrai choix
  // de l'utilisateur fait sur /pricing — jamais recalculé côté serveur. Rien
  // à trafiquer ici : les deux plans facturent le même 20% mesuré via
  // groupe témoin, seul le socle fixe diffère.
  const body = await req.json().catch(() => ({}));
  const billingMode = body?.billingMode === 'performance' ? 'performance' : 'revenue_tier';

  // Le CA auto-déclaré par le client (barre sur /pricing) était jusqu'ici
  // écrit par le navigateur (clé anon) dans un appel séparé, avant celui-ci,
  // sans jamais vérifier que ça avait réussi — un échec silencieux (RLS,
  // latence réseau) laissait cette route lire l'ancienne valeur en base et
  // calculer un tarif complètement différent de celui affiché sur /pricing.
  // Écrit maintenant ici, dans la même requête qui calcule le prix, avec le
  // service role (donc jamais bloqué par les mêmes soucis que côté client)
  // et une vraie vérification d'erreur avant de poursuivre. DEFAULT_CLIENT_COUNT
  // (100) reste la valeur envoyée par /pricing, inchangée — voir
  // app/pricing/page.tsx.
  const rawMonthlyRevenue = Number(body?.monthlyRevenue);
  if (Number.isFinite(rawMonthlyRevenue)) {
    const monthlyRevenue = Math.max(0, Math.min(2_000_000, rawMonthlyRevenue));
    const { error: revenueUpdateError } = await supabaseAdmin
      .from('users')
      .update({ client_count: 100, monthly_revenue: monthlyRevenue })
      .eq('id', user.id);
    if (revenueUpdateError) {
      console.error('[create-checkout-session] failed to persist self-reported revenue', JSON.stringify({ userId: user.id, error: revenueUpdateError }));
      return NextResponse.json({ error: 'Could not save your revenue before checkout.' }, { status: 500 });
    }
  }

  // Le palier est calculé côté serveur à partir des données du profil en
  // base (relu après l'écriture ci-dessus, donc jamais périmé), jamais à
  // partir de ce que le client envoie directement dans le body — sinon
  // n'importe qui pourrait appeler cette route avec un tier arbitraire (ex:
  // "60") et payer moins cher que ce que son propre CA ne le justifie. Le CA
  // lui-même reste auto-déclaré (comme la barre sur /pricing l'a toujours
  // été), mais le tarif qui en découle passe toujours par calcPrice().
  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('stripe_customer_id, industry, client_count, monthly_revenue, referred_by')
    .eq('id', user.id)
    .maybeSingle();

  const p = profile as {
    industry?: string;
    client_count?: number | null;
    monthly_revenue?: number | null;
    referred_by?: string | null;
  } | null;

  try {
    const stripe = getStripe();
    let customerId = (profile as { stripe_customer_id?: string })?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await supabaseAdmin.from('users').update({ stripe_customer_id: customerId }).eq('id', user.id);
    }

    // Un utilisateur inscrit via un lien de parrainage (referred_by posé au
    // signup, voir handle_new_user) reçoit -50% sur sa première facture —
    // coupon à usage unique, appliqué une seule fois au checkout, jamais
    // reconduit sur les factures suivantes. Ne s'applique qu'au plan Standard
    // (le seul avec un abonnement/une facture Stripe classique à l'inscription
    // — le plan Performance n'a rien à facturer avant le premier cycle mensuel).
    let discounts: { coupon: string }[] | undefined;
    if (p?.referred_by && billingMode !== 'performance') {
      const coupon = await stripe.coupons.create({
        percent_off: 50,
        duration: 'once',
        max_redemptions: 1,
        name: 'Bienvenue — parrainage (-50% premier mois)',
      });
      discounts = [{ coupon: coupon.id }];
    }

    // Plan Performance : pas de socle basé sur le CA, donc pas d'abonnement
    // Stripe à créer ici — seulement une session en mode 'setup' pour
    // enregistrer un moyen de paiement, utilisé ensuite chaque mois par
    // lib/performanceBilling.ts (50€ + 20% mesuré via groupe témoin). Le
    // compte est activé par le webhook checkout.session.completed une fois
    // ce setup terminé (voir app/api/stripe-webhook).
    if (billingMode === 'performance') {
      // Managed Payments (activé par défaut sur le compte Stripe) ne
      // supporte que mode: 'subscription' ou 'payment' — incompatible avec
      // le mode 'setup' utilisé ici pour n'enregistrer qu'un moyen de
      // paiement sans charge immédiate. Désactivé explicitement pour cette
      // session précise, comme recommandé par l'erreur Stripe elle-même,
      // plutôt que changer le réglage par défaut du compte (qui affecterait
      // aussi le checkout Standard en mode 'subscription' plus bas). Le
      // champ n'est pas encore dans les types de ce SDK Stripe — étendu ici
      // sur une variable (pas un littéral inline) pour que la vérification
      // des propriétés en trop de TypeScript ne s'applique pas.
      const sessionParams: Stripe.Checkout.SessionCreateParams & { managed_payments?: { enabled: boolean } } = {
        customer: customerId,
        mode: 'setup',
        // Requis par Stripe en mode 'setup' dès lors que payment_method_types
        // n'est pas fixé — pas d'erreur sous l'ancienne API version, mais
        // devient bloquant sous 2026-07-29.dahlia (voir override plus bas).
        currency: 'eur',
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=success`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=cancelled`,
        metadata: { supabase_user_id: user.id, billing_mode: 'performance' },
        locale: 'auto',
        managed_payments: { enabled: false },
      };
      // Le client Stripe (lib/stripe.ts) est épinglé sur l'API version
      // 2025-03-31.basil pour tout le reste de l'app — antérieure à
      // l'introduction de managed_payments (arrivé dans la lignée "dahlia").
      // Sur l'ancienne version, ce champ est silencieusement ignoré à la
      // création de session (pas d'erreur ici), mais le compte applique
      // quand même son défaut Managed Payments au rendu de la page Checkout
      // hébergée par Stripe, d'où l'erreur "Invalid mode: setup" vue
      // côté client malgré ce override. On force donc une version d'API plus
      // récente uniquement pour cet appel précis, sans toucher au client
      // global (qui est utilisé par le reste de l'app — abonnements,
      // factures, webhooks — et qu'on ne veut pas faire changer de
      // comportement partout d'un coup).
      const session = await stripe.checkout.sessions.create(sessionParams, { apiVersion: '2026-07-29.dahlia' });
      return NextResponse.json({ url: session.url });
    }

    const isManagerProfile = p?.industry === 'manager';
    const tier = isManagerProfile
      ? calcManagerPrice(Number(p?.client_count) || 0)
      : calcPrice(Number(p?.monthly_revenue) || 0);
    const productId = process.env.STRIPE_PRODUCT_ID;
    if (!productId) {
      console.error('[create-checkout-session] STRIPE_PRODUCT_ID not configured', JSON.stringify({ computedTier: tier }));
      return NextResponse.json({ error: 'Invalid subscription tier' }, { status: 400 });
    }

    // Chaque compte reçoit une seule analyse gratuite à l'inscription (voir
    // le garde-fou dans app/api/analyze et app/api/stripe/connect/import) —
    // il n'y a donc plus de période d'essai Stripe à accorder ici, l'abonnement
    // est facturé immédiatement dès le checkout.
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price_data: priceDataForAmount(tier, productId), quantity: 1 }],
      ...(discounts ? { discounts } : {}),
      subscription_data: {
        metadata: { supabase_user_id: user.id, tier: String(tier) },
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=cancelled`,
      metadata: { supabase_user_id: user.id, tier: String(tier) },
      // 'auto' laisse Stripe détecter la langue du navigateur du client au
      // moment du checkout plutôt que de forcer le français — nécessaire
      // maintenant que l'app est utilisable en anglais.
      locale: 'auto',
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[create-checkout-session] failed', err);
    return NextResponse.json({ error: 'Could not start checkout.' }, { status: 500 });
  }
}
