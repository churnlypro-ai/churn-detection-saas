import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getStripe, PRICE_IDS } from '@/lib/stripe';
import { calcPrice, calcManagerPrice } from '@/lib/pricing';

// Appelée depuis /settings après l'enregistrement du profil : un client déjà
// abonné doit voir son abonnement Stripe suivre son CA / nombre de clients
// à jour, sinon changer ces valeurs dans le formulaire n'aurait aucun effet
// réel sur ce qu'il paie. Pouvoir ajuster son forfait sans annuler puis se
// réabonner retire une raison de partir plutôt que de simplement changer de
// palier.
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
  const userId = userData.user.id;

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('stripe_subscription_id, subscription_status, subscription_tier, industry, client_count, monthly_revenue')
    .eq('id', userId)
    .maybeSingle();

  const isActive = profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing';
  if (!isActive || !profile?.stripe_subscription_id) {
    // Pas encore abonné : le premier abonnement se crée via
    // /api/create-checkout-session, pas ici — rien à faire.
    return NextResponse.json({ updated: false });
  }

  // Le palier est recalculé côté serveur à partir des données déjà en base
  // (jamais envoyées par le client dans le body) — même règle anti-triche
  // que /api/create-checkout-session.
  const isManagerProfile = profile.industry === 'manager';
  const tier = isManagerProfile
    ? calcManagerPrice(Number(profile.client_count) || 0)
    : calcPrice(Number(profile.monthly_revenue) || 0);

  if (String(tier) === profile.subscription_tier) {
    return NextResponse.json({ updated: false, tier });
  }

  const priceId = PRICE_IDS[String(tier)];
  if (!priceId) {
    console.error('[update-subscription-tier] no price configured for computed tier', JSON.stringify({ userId, tier }));
    return NextResponse.json({ error: 'Invalid subscription tier' }, { status: 400 });
  }

  try {
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
    const itemId = subscription.items.data[0]?.id;
    if (!itemId) throw new Error('Subscription has no items');

    await stripe.subscriptions.update(profile.stripe_subscription_id, {
      items: [{ id: itemId, price: priceId }],
      // Le client passe d'un palier à l'autre en cours de mois : Stripe
      // calcule et applique automatiquement la différence proratisée,
      // plutôt que d'attendre le prochain cycle de facturation.
      proration_behavior: 'create_prorations',
      metadata: { supabase_user_id: userId, tier: String(tier) },
    });

    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ subscription_tier: String(tier) })
      .eq('id', userId);
    if (updateError) {
      console.error('[update-subscription-tier] supabase update failed', JSON.stringify({ userId, updateError }));
    }

    return NextResponse.json({ updated: true, tier });
  } catch (err) {
    console.error('[update-subscription-tier] failed', JSON.stringify({ userId, err: err instanceof Error ? err.message : err }));
    return NextResponse.json({ error: 'Could not update subscription.' }, { status: 500 });
  }
}
