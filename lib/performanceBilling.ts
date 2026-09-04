import { getSupabaseAdmin } from '@/lib/supabase';
import { getStripe } from '@/lib/stripe';
import { calcPerformanceBaseFee, PERFORMANCE_FEE_RATE, formatEuro } from '@/lib/pricing';
import { logAuditEvent } from '@/lib/auditLog';

interface PerformanceUser {
  id: string;
  stripe_customer_id: string | null;
  company_name: string | null;
  monthly_revenue: number | null;
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
// jobs) chaque compte en mode "performance". Deux lignes possibles sur la
// même facture : un socle basé sur le CA déclaré (calcPerformanceBaseFee,
// toujours facturé — sans lui, un mois sans rien à récupérer rendrait
// Churnly gratuit) et un % de l'incrément mesuré via groupe témoin (voir
// computeIncrementalRevenue ci-dessus et la migration
// 20260901000000_add_recovery_control_group.sql pour le pourquoi de ce
// mécanisme plutôt qu'une liste de clients nommés).
export async function runPerformanceBilling(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
): Promise<PerformanceBillingResult[]> {
  const { data: users, error: usersError } = await supabaseAdmin
    .from('users')
    .select('id, stripe_customer_id, company_name, monthly_revenue')
    .eq('billing_mode', 'performance');

  if (usersError) {
    console.error('[performanceBilling] failed to load users', usersError);
    return [];
  }

  const stripe = getStripe();
  const results: PerformanceBillingResult[] = [];

  for (const user of (users ?? []) as PerformanceUser[]) {
    if (!user.stripe_customer_id) {
      // Ne devrait pas arriver (le mode performance suppose un client déjà
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
    const baseFee = calcPerformanceBaseFee(Number(user.monthly_revenue) || 0);
    const fee = baseFee + performanceFee;
    const sampleIds = sampleRows.map((s) => s.id);

    try {
      await stripe.invoiceItems.create({
        customer: user.stripe_customer_id,
        amount: Math.round(baseFee * 100),
        currency: 'eur',
        description: 'Churnly — socle mensuel',
      });

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
