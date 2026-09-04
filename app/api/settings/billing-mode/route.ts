import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getStripe } from '@/lib/stripe';
import { logAuditEvent } from '@/lib/auditLog';
import { PERFORMANCE_BASE_FEE, PERFORMANCE_FEE_RATE } from '@/lib/pricing';

async function requireUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  if (!userData?.user) return null;
  return { supabaseAdmin, userId: userData.user.id };
}

// Statut affiché dans /settings : l'échantillon en cours depuis la
// dernière facture (groupe traité vs groupe témoin, voir
// churn_recovery_samples et lib/analysis.ts) et l'estimation de la
// prochaine facture calculée exactement comme lib/performanceBilling.ts —
// jamais le vrai montant Stripe tant que la facturation mensuelle n'est
// pas passée.
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: profile } = await auth.supabaseAdmin
    .from('users')
    .select('billing_mode')
    .eq('id', auth.userId)
    .maybeSingle();
  // Le socle fixe (50€) n'est dû qu'en plan Performance pur — en Standard
  // ('revenue_tier'), le socle basé sur le CA est déjà prélevé via
  // l'abonnement Stripe classique, seul le % mesuré ci-dessous s'ajoute.
  const baseFee = profile?.billing_mode === 'performance' ? PERFORMANCE_BASE_FEE : 0;

  const { data: samples, error } = await auth.supabaseAdmin
    .from('churn_recovery_samples')
    .select('sample_group, revenue_monthly, resolved')
    .eq('user_id', auth.userId)
    .is('billed_at', null);

  if (error) return NextResponse.json({ error: 'Chargement échoué.' }, { status: 500 });

  const treatment = (samples ?? []).filter((s) => s.sample_group === 'treatment');
  const control = (samples ?? []).filter((s) => s.sample_group === 'control');
  const treatedResolvedCount = treatment.filter((s) => s.resolved).length;
  const controlResolvedCount = control.filter((s) => s.resolved).length;

  // Même calcul que computeIncrementalRevenue dans lib/performanceBilling.ts
  // — pas de témoin mesurable ce mois-ci, pas d'incrément affirmé.
  let incrementalRevenue = 0;
  if (treatment.length > 0 && control.length > 0) {
    const treatedRate = treatedResolvedCount / treatment.length;
    const controlRate = controlResolvedCount / control.length;
    const incrementalRate = Math.max(0, treatedRate - controlRate);
    if (incrementalRate > 0) {
      const treatedRevenue = treatment.reduce((sum, s) => sum + Number(s.revenue_monthly), 0);
      incrementalRevenue = Math.round(incrementalRate * treatedRevenue * 100) / 100;
    }
  }

  return NextResponse.json({
    treatmentCount: treatment.length,
    controlCount: control.length,
    treatedResolvedCount,
    controlResolvedCount,
    incrementalRevenue,
    // Le socle de 50€ n'est dû qu'en plan Performance — voir baseFee
    // ci-dessus et lib/performanceBilling.ts.
    estimatedFee: baseFee + Math.round(incrementalRevenue * PERFORMANCE_FEE_RATE * 100) / 100,
    baseFee,
    feeRate: PERFORMANCE_FEE_RATE,
  });
}

// Bascule vers la facturation à la performance (voir lib/pricing.ts et
// lib/performanceBilling.ts) : annule l'abonnement Stripe au CA en cours et
// passe le compte en facturation mensuelle sur le revenu récupéré. Le sens
// inverse n'existe pas ici — repasser au palier CA se fait en se réabonnant
// depuis /pricing, pas depuis cette route.
//
// stripe_subscription_id est vidé AVANT que le webhook
// customer.subscription.deleted n'arrive (déclenché par l'annulation
// ci-dessous) : la route webhook fait un .eq('stripe_subscription_id', ...)
// qui ne trouvera donc plus cette ligne et ne remettra pas subscription_status
// à 'canceled' derrière nous — sans ça, le compte perdrait l'accès Premium
// dès l'arrivée (asynchrone) du webhook.
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
    .select('billing_mode, subscription_status, stripe_subscription_id, stripe_customer_id')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: 'Profil introuvable.' }, { status: 404 });
  }
  if (profile.billing_mode === 'performance') {
    return NextResponse.json({ error: 'Déjà en facturation à la performance.' }, { status: 409 });
  }
  if (profile.subscription_status !== 'active' || !profile.stripe_subscription_id || !profile.stripe_customer_id) {
    return NextResponse.json({ error: 'Un abonnement actif est requis avant de basculer.' }, { status: 400 });
  }

  try {
    const stripe = getStripe();
    await stripe.subscriptions.cancel(profile.stripe_subscription_id);

    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        billing_mode: 'performance',
        performance_billing_started_at: new Date().toISOString(),
        stripe_subscription_id: null,
        subscription_tier: null,
      })
      .eq('id', userId);
    if (updateError) {
      console.error('[settings/billing-mode] supabase update failed', JSON.stringify({ userId, updateError }));
      return NextResponse.json({ error: 'Bascule enregistrée côté paiement mais pas côté compte — contacte le support.' }, { status: 500 });
    }

    await logAuditEvent(supabaseAdmin, userId, 'billing_mode_switched', { to: 'performance' });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[settings/billing-mode] failed', JSON.stringify({ userId, err: err instanceof Error ? err.message : err }));
    return NextResponse.json({ error: 'La bascule a échoué — réessaie.' }, { status: 500 });
  }
}
