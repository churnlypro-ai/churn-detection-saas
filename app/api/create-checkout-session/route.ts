import { NextRequest, NextResponse } from 'next/server';
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
  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('stripe_customer_id, industry, client_count, monthly_revenue, referred_by')
    .eq('id', user.id)
    .maybeSingle();

  // Le palier est calculé côté serveur à partir des données du profil en
  // base, jamais à partir de ce que le client envoie dans le body — sinon
  // n'importe qui pourrait appeler cette route avec un tier arbitraire (ex:
  // "60") et payer moins cher que ce que son propre CA ne le justifie.
  const p = profile as {
    industry?: string;
    client_count?: number | null;
    monthly_revenue?: number | null;
    referred_by?: string | null;
  } | null;

  // Le plan (Standard vs Performance, voir lib/pricing.ts), en revanche, est
  // un vrai choix de l'utilisateur fait sur /pricing — jamais recalculé côté
  // serveur, contrairement au tier ci-dessus. Rien à trafiquer ici : les deux
  // plans facturent le même 20% mesuré via groupe témoin, seul le socle fixe
  // diffère.
  const body = await req.json().catch(() => ({}));
  const billingMode = body?.billingMode === 'performance' ? 'performance' : 'revenue_tier';

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
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'setup',
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=success`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=cancelled`,
        metadata: { supabase_user_id: user.id, billing_mode: 'performance' },
        locale: 'auto',
      });
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
