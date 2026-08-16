import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getStripe, PRICE_IDS } from '@/lib/stripe';
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

  const body = await req.json().catch(() => ({}));
  // Le client ne peut que RENONCER à l'essai (payer tout de suite), jamais
  // s'en accorder un en plus de ce que le serveur autorise déjà plus bas
  // (isManagerProfile / trialAlreadyUsed) — 'wantsTrial: true' envoyé par un
  // utilisateur qui n'y a pas droit reste sans effet.
  const wantsTrial = body?.wantsTrial !== false;

  const user = userData.user;
  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('stripe_customer_id, industry, trial_used, client_count, monthly_revenue')
    .eq('id', user.id)
    .maybeSingle();

  // Le palier est calculé côté serveur à partir des données du profil en
  // base, jamais à partir de ce que le client envoie dans le body — sinon
  // n'importe qui pourrait appeler cette route avec un tier arbitraire (ex:
  // "150") et payer moins cher que ce que son propre CA ne le justifie.
  const p = profile as {
    industry?: string;
    client_count?: number | null;
    monthly_revenue?: number | null;
  } | null;
  const isManagerProfile = p?.industry === 'manager';
  const tier = isManagerProfile
    ? calcManagerPrice(Number(p?.client_count) || 0)
    : calcPrice(Number(p?.monthly_revenue) || 0);
  const priceId = PRICE_IDS[String(tier)];
  if (!priceId) {
    console.error(
      '[create-checkout-session] no price configured for computed tier',
      JSON.stringify({
        computedTier: tier,
        configuredPriceEnvVars: Object.fromEntries(
          Object.entries(PRICE_IDS).map(([key, value]) => [key, value ? 'set' : 'MISSING']),
        ),
      }),
    );
    return NextResponse.json({ error: 'Invalid subscription tier' }, { status: 400 });
  }

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

    // Ce profil paie directement, sans période d'essai.
    // Un compte ne reçoit son essai gratuit qu'une seule fois : trial_used est
    // posé de façon permanente au premier essai (voir stripe-webhook) et n'est
    // jamais effacé, contrairement à trial_end qui repart à null à l'annulation.
    const trialAlreadyUsed = (profile as { trial_used?: boolean })?.trial_used === true;
    const grantsTrial = wantsTrial && !isManagerProfile && !trialAlreadyUsed;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      // Sans carte pendant l'essai : rien à payer aujourd'hui, donc rien à
      // demander. Si personne n'ajoute de carte avant la fin des 3 jours,
      // l'abonnement passe directement à "canceled" (déjà géré partout
      // ailleurs dans l'app) plutôt que de rester bloqué en attente.
      ...(grantsTrial ? { payment_method_collection: 'if_required' as const } : {}),
      subscription_data: {
        ...(grantsTrial
          ? { trial_period_days: 3, trial_settings: { end_behavior: { missing_payment_method: 'cancel' as const } } }
          : {}),
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
