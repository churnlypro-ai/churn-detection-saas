import { getSupabaseAdmin } from '@/lib/supabase';
import { getStripe } from '@/lib/stripe';
import { calcPerformanceBaseFee, PERFORMANCE_FEE_RATE, MIN_CONTROL_SAMPLES_FOR_BILLING, formatEuro } from '@/lib/pricing';
import { logAuditEvent } from '@/lib/auditLog';

interface PerformanceUser {
  id: string;
  stripe_customer_id: string | null;
  company_name: string | null;
  monthly_revenue: number | null;
  performance_variable_invoiced_cents: number | null;
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
  sample_group: 'treatment' | 'control';
  revenue_monthly: number;
  resolved: boolean;
}

export interface CumulativePerformanceFee {
  treatmentCount: number;
  controlCount: number;
  cumulativeIncrementalRevenue: number;
  cumulativeDueCents: number;
  // Différence entre le cumul dû et ce qui a déjà été facturé — c'est ce
  // montant précis qui doit apparaître sur la prochaine facture, jamais le
  // cumul entier (voir computeCumulativePerformanceFee ci-dessous).
  amountDueNowCents: number;
  meetsMinimumSample: boolean;
}

// Calcule l'écart traité vs témoin sur TOUT l'historique du compte, jamais
// mois par mois — voir la migration 20260911000000 et le retour de Kevin :
// avec un petit groupe témoin, l'écart mesuré un mois donné est très bruité
// (marge d'erreur ±28 points à 10 échantillons témoins, IC 95%), et facturer
// l'écart positif sans jamais corriger un écart négatif biaise le montant
// facturé à la hausse de façon systématique, pas juste par malchance
// ponctuelle.
//
// Deux garde-fous, tous les deux nécessaires :
// 1. Le plancher à zéro (Math.max(0, ...)) s'applique au taux CUMULATIF, pas
//    à chaque mois séparément — l'ampleur du biais qu'il introduit se réduit
//    à mesure que l'échantillon grandit, contrairement à un plancher mensuel
//    répété qui accumule le biais mois après mois.
// 2. En dessous de MIN_CONTROL_SAMPLES_FOR_BILLING échantillons témoins
//    cumulés, le montant dû est forcé à zéro — la mesure n'est simplement
//    pas assez fiable pour justifier une facture, quel que soit le résultat
//    du calcul.
//
// alreadyInvoicedCents doit toujours refléter le cumul RÉELLEMENT facturé à
// ce jour (users.performance_variable_invoiced_cents) : le montant dû
// maintenant est la différence entre le cumul dû recalculé et ce total —
// jamais le cumul entier, sous peine de refacturer ce qui l'a déjà été.
export function computeCumulativePerformanceFee(
  samples: RecoverySample[],
  alreadyInvoicedCents: number,
): CumulativePerformanceFee {
  const treatment = samples.filter((s) => s.sample_group === 'treatment');
  const control = samples.filter((s) => s.sample_group === 'control');

  let cumulativeIncrementalRevenue = 0;
  if (treatment.length > 0 && control.length > 0) {
    const treatedRate = treatment.filter((s) => s.resolved).length / treatment.length;
    const controlRate = control.filter((s) => s.resolved).length / control.length;
    const incrementalRate = Math.max(0, treatedRate - controlRate);
    if (incrementalRate > 0) {
      const treatedRevenue = treatment.reduce((sum, s) => sum + Number(s.revenue_monthly), 0);
      cumulativeIncrementalRevenue = Math.round(incrementalRate * treatedRevenue * 100) / 100;
    }
  }

  const meetsMinimumSample = control.length >= MIN_CONTROL_SAMPLES_FOR_BILLING;
  const cumulativeDueCents = meetsMinimumSample
    ? Math.round(cumulativeIncrementalRevenue * PERFORMANCE_FEE_RATE * 100)
    : 0;

  return {
    treatmentCount: treatment.length,
    controlCount: control.length,
    cumulativeIncrementalRevenue,
    cumulativeDueCents,
    amountDueNowCents: Math.max(0, cumulativeDueCents - alreadyInvoicedCents),
    meetsMinimumSample,
  };
}

// Facture une fois par mois (voir l'appel depuis /api/cron/resync-stripe, le
// 1er du mois — pas de créneau cron dédié, le plan Vercel Hobby limite à 2
// jobs) chaque compte en mode "performance". Deux lignes possibles sur la
// même facture : un socle basé sur le CA déclaré (calcPerformanceBaseFee,
// toujours facturé — sans lui, un mois sans rien à récupérer rendrait
// Churnly gratuit) et le delta du % de l'écart CUMULATIF mesuré via groupe
// témoin (voir computeCumulativePerformanceFee ci-dessus).
export async function runPerformanceBilling(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
): Promise<PerformanceBillingResult[]> {
  const { data: users, error: usersError } = await supabaseAdmin
    .from('users')
    .select('id, stripe_customer_id, company_name, monthly_revenue, performance_variable_invoiced_cents')
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

    // Tout l'historique du compte, jamais filtré par une facturation
    // précédente — voir le commentaire de computeCumulativePerformanceFee :
    // le cumul doit refléter TOUS les échantillons connus à ce jour, y
    // compris ceux déjà reflétés dans une facture antérieure.
    const { data: samples, error: samplesError } = await supabaseAdmin
      .from('churn_recovery_samples')
      .select('sample_group, revenue_monthly, resolved')
      .eq('user_id', user.id);

    if (samplesError) {
      results.push({ userId: user.id, incrementalRevenue: 0, fee: 0, error: 'samples lookup failed' });
      continue;
    }

    const sampleRows = (samples ?? []) as RecoverySample[];
    const alreadyInvoicedCents = user.performance_variable_invoiced_cents ?? 0;
    const cumulative = computeCumulativePerformanceFee(sampleRows, alreadyInvoicedCents);
    const performanceFee = cumulative.amountDueNowCents / 100;
    const baseFee = calcPerformanceBaseFee(Number(user.monthly_revenue) || 0);
    const fee = baseFee + performanceFee;

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
          amount: cumulative.amountDueNowCents,
          currency: 'eur',
          description: `Churnly — ${PERFORMANCE_FEE_RATE * 100}% de l'écart cumulé mesuré vs groupe témoin (${formatEuro(cumulative.cumulativeIncrementalRevenue)} cumulés, ${cumulative.controlCount} témoins)`,
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

      // Le nouveau cumul facturé devient le cumul dû recalculé (= ancien
      // cumul facturé + le delta qu'on vient d'émettre) — jamais réinitialisé,
      // c'est ce qui permet à un mois moins bon de ne rien facturer sans
      // perdre la trace de ce qui a déjà été payé.
      if (performanceFee > 0) {
        const { error: updateError } = await supabaseAdmin
          .from('users')
          .update({ performance_variable_invoiced_cents: alreadyInvoicedCents + cumulative.amountDueNowCents })
          .eq('id', user.id);
        if (updateError) {
          console.error('[performanceBilling] failed to update invoiced total', JSON.stringify({ userId: user.id, updateError }));
        }
      }

      await logAuditEvent(supabaseAdmin, user.id, 'performance_revenue_billed', {
        incrementalRevenue: cumulative.cumulativeIncrementalRevenue,
        fee,
        invoiceId: finalized.id,
      });

      results.push({ userId: user.id, incrementalRevenue: cumulative.cumulativeIncrementalRevenue, fee, invoiceId: finalized.id ?? undefined });
    } catch (err) {
      console.error('[performanceBilling] invoicing failed', JSON.stringify({ userId: user.id, err: err instanceof Error ? err.message : err }));
      results.push({ userId: user.id, incrementalRevenue: cumulative.cumulativeIncrementalRevenue, fee, error: err instanceof Error ? err.message : 'invoicing failed' });
    }
  }

  return results;
}
