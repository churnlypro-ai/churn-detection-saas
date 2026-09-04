import { getSupabaseAdmin } from '@/lib/supabase';
import { getStripe } from '@/lib/stripe';
import { PERFORMANCE_BASE_FEE, PERFORMANCE_FEE_RATE, formatEuro } from '@/lib/pricing';
import { logAuditEvent } from '@/lib/auditLog';

interface PerformanceUser {
  id: string;
  stripe_customer_id: string | null;
  company_name: string | null;
  billing_mode: 'revenue_tier' | 'performance';
}

interface PerformanceBillingResult {
  userId: string;
  incrementalRevenue: number;
  fee: number;
  invoiceId?: string;
  skipped?: 'no_customer';
  error?: string;
}

interface RecoverySample {
  id: string;
  sample_group: 'treatment' | 'control';
  revenue_monthly: number;
  resolved: boolean;
}

// Calcule l'incrément réellement imputable à Churnly à partir du groupe
// témoin (voir la migration churn_recovery_samples et lib/analysis.ts) :
// le taux de résolution du groupe traité MOINS celui du témoin, appliqué
// au revenu du groupe traité. Sans témoin mesurable ce mois-ci (aucun
// client tiré au sort dans ce groupe, ce qui arrive vite sur un petit
// compte), on ne peut rien affirmer — l'incrément est nul, jamais deviné.
function computeIncrementalRevenue(samples: RecoverySample[]): number {
  const treatment = samples.filter((s) => s.sample_group === 'treatment');
  const control = samples.filter((s) => s.sample_group === 'control');
  if (treatment.length === 0 || control.length === 0) return 0;

  const treatedRate = treatment.filter((s) => s.resolved).length / treatment.length;
  const controlRate = control.filter((s) => s.resolved).length / control.length;
  const incrementalRate = Math.max(0, treatedRate - controlRate);
  if (incrementalRate === 0) return 0;

  const treatedRevenue = treatment.reduce((sum, s) => sum + Number(s.revenue_monthly), 0);
  return Math.round(incrementalRate * treatedRevenue * 100) / 100;
}

// Facture une fois par mois (voir l'appel depuis /api/cron/resync-stripe, le
// 1er du mois — pas de créneau cron dédié, le plan Vercel Hobby limite à 2
// jobs) le % mesuré via groupe témoin (voir computeIncrementalRevenue
// ci-dessus et la migration 20260901000000_add_recovery_control_group.sql
// pour le pourquoi de ce mécanisme plutôt qu'une liste de clients nommés).
// Concerne désormais les DEUX plans (Standard 'revenue_tier' et
// 'performance', voir lib/pricing.ts) puisque les deux incluent ce 20% —
// seul le socle fixe diffère selon le plan :
// - Performance : PERFORMANCE_BASE_FEE (50€) toujours facturé ici en plus
//   du %, puisque ce plan n'a pas d'abonnement Stripe récurrent.
// - Standard : le socle basé sur le CA est déjà prélevé via l'abonnement
//   Stripe classique — on ne facture ici QUE le %, et seulement s'il y en
//   a un ce mois-ci (sinon rien à facturer, on ne crée même pas de
//   facture vide).
export async function runPerformanceBilling(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
): Promise<PerformanceBillingResult[]> {
  const { data: users, error: usersError } = await supabaseAdmin
    .from('users')
    .select('id, stripe_customer_id, company_name, billing_mode')
    .in('billing_mode', ['performance', 'revenue_tier'])
    .eq('subscription_status', 'active');

  if (usersError) {
    console.error('[performanceBilling] failed to load users', usersError);
    return [];
  }

  const stripe = getStripe();
  const results: PerformanceBillingResult[] = [];

  for (const user of (users ?? []) as PerformanceUser[]) {
    if (!user.stripe_customer_id) {
      // Ne devrait pas arriver (les deux plans supposent un client déjà
      // passé par le checkout), mais on ne facture jamais à l'aveugle sans
      // customer Stripe — repris au prochain cycle une fois corrigé.
      results.push({ userId: user.id, incrementalRevenue: 0, fee: 0, skipped: 'no_customer' });
      continue;
    }

    const { data: samples, error: samplesError } = await supabaseAdmin
      .from('churn_recovery_samples')
      .select('id, sample_group, revenue_monthly, resolved')
      .eq('user_id', user.id)
      .is('billed_at', null);

    if (samplesError) {
      results.push({ userId: user.id, incrementalRevenue: 0, fee: 0, error: 'samples lookup failed' });
      continue;
    }

    const sampleRows = (samples ?? []) as RecoverySample[];
    const incrementalRevenue = computeIncrementalRevenue(sampleRows);
    const performanceFee = incrementalRevenue > 0 ? Math.round(incrementalRevenue * PERFORMANCE_FEE_RATE * 100) / 100 : 0;
    const isPerformancePlan = user.billing_mode === 'performance';
    const baseFee = isPerformancePlan ? PERFORMANCE_BASE_FEE : 0;
    const fee = baseFee + performanceFee;
    const sampleIds = sampleRows.map((s) => s.id);

    // Plan Standard sans rien à récupérer ce mois-ci : le socle CA est déjà
    // réglé par l'abonnement Stripe, il n'y a donc littéralement rien à
    // facturer ici — pas de facture à 0€.
    if (!isPerformancePlan && performanceFee <= 0) {
      results.push({ userId: user.id, incrementalRevenue: 0, fee: 0 });
      continue;
    }

    try {
      if (baseFee > 0) {
        await stripe.invoiceItems.create({
          customer: user.stripe_customer_id,
          amount: Math.round(baseFee * 100),
          currency: 'eur',
          description: 'Churnly — socle mensuel',
        });
      }

      if (performanceFee > 0) {
        await stripe.invoiceItems.create({
          customer: user.stripe_customer_id,
          amount: Math.round(performanceFee * 100),
          currency: 'eur',
          description: `Churnly — ${PERFORMANCE_FEE_RATE * 100}% de l'écart mesuré vs groupe témoin (${formatEuro(incrementalRevenue)})`,
        });
      }

      const invoice = await stripe.invoices.create({
        customer: user.stripe_customer_id,
        collection_method: 'charge_automatically',
        auto_advance: true,
      });

      const finalized = await stripe.invoices.finalizeInvoice(invoice.id!);

      // Trace de chaque facture émise, pour pouvoir réagir si son paiement
      // échoue (voir invoice.payment_failed dans app/api/stripe-webhook) —
      // avant cette table, un échec de paiement sur une facture performance
      // ne se voyait nulle part côté Churnly.
      const { error: invoiceTrackError } = await supabaseAdmin.from('performance_invoices').insert({
        user_id: user.id,
        stripe_invoice_id: finalized.id,
        amount: fee,
        status: finalized.status === 'paid' ? 'paid' : 'open',
      });
      if (invoiceTrackError) {
        console.error('[performanceBilling] failed to record invoice', JSON.stringify({ userId: user.id, invoiceTrackError }));
      }

      if (sampleIds.length > 0) {
        const { error: markError } = await supabaseAdmin
          .from('churn_recovery_samples')
          .update({ billed_at: new Date().toISOString() })
          .in('id', sampleIds);
        if (markError) {
          console.error('[performanceBilling] failed to mark samples billed', JSON.stringify({ userId: user.id, markError }));
        }
      }

      await logAuditEvent(supabaseAdmin, user.id, 'performance_revenue_billed', {
        incrementalRevenue,
        fee,
        invoiceId: finalized.id,
      });

      results.push({ userId: user.id, incrementalRevenue, fee, invoiceId: finalized.id ?? undefined });
    } catch (err) {
      console.error('[performanceBilling] invoicing failed', JSON.stringify({ userId: user.id, err: err instanceof Error ? err.message : err }));
      results.push({ userId: user.id, incrementalRevenue, fee, error: err instanceof Error ? err.message : 'invoicing failed' });
    }
  }

  return results;
}
