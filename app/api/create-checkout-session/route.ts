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

  const user = userData.user;
  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('stripe_customer_id, industry, trial_used, client_count, monthly_revenue, churn_rate')
    .eq('id', user.id)
    .maybeSingle();

  // Le palier est calculé côté serveur à partir des données du profil en
  // base, jamais à partir de ce que le client envoie dans le body — sinon
  // n'importe qui pourrait appeler cette route avec un tier arbitraire (ex:
  // "150") et payer moins cher que ce que son propre volume de clients/CA
  // justifie.
  const p = profile as {
    industry?: string;
    client_count?: number | null;
    monthly_revenue?: number | null;
    churn_rate?: number | null;
  } | null;
  const isManagerProfile = p?.industry === 'manager';
  const tier = isManagerProfile
    ? calcManagerPrice(Number(p?.client_count) || 0)
    : calcPrice(Number(p?.client_count) || 0, Number(p?.monthly_revenue) || 0, Number(p?.churn_rate) || 5);
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

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        ...(isManagerProfile || trialAlreadyUsed ? {} : { trial_period_days: 3 }),
        metadata: { supabase_user_id: user.id, tier: String(tier) },
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=cancelled`,
      metadata: { supabase_user_id: user.id, tier: String(tier) },
      locale: 'fr',
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[create-checkout-session] failed', err);
    return NextResponse.json({ error: 'Could not start checkout.' }, { status: 500 });
  }
}
