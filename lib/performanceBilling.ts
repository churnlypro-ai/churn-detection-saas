import { getSupabaseAdmin } from '@/lib/supabase';
import { getStripe } from '@/lib/stripe';
import { PERFORMANCE_BASE_FEE, PERFORMANCE_FEE_RATE, formatEuro } from '@/lib/pricing';
import { logAuditEvent } from '@/lib/auditLog';

interface PerformanceUser {
  id: string;
  stripe_customer_id: string | null;
  company_name: string | null;
}

interface PerformanceBillingResult {
  userId: string;
  recoveredTotal: number;
  fee: number;
  invoiceId?: string;
  skipped?: 'no_customer';
  error?: string;
}

// Facture une fois par mois (voir l'appel depuis /api/cron/resync-stripe, le
// 1er du mois — pas de créneau cron dédié, le plan Vercel Hobby limite à 2
// jobs) chaque compte en mode "performance" — voir la migration
// 20260829000000_add_performance_billing.sql pour le contexte. Deux lignes
// possibles sur la même facture : un socle fixe (PERFORMANCE_BASE_FEE,
// toujours facturé — sans lui, un mois sans rien à récupérer rendrait
// Churnly gratuit) et un % du revenu concrètement récupéré (seulement s'il y
// en a eu).
export async function runPerformanceBilling(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
): Promise<PerformanceBillingResult[]> {
  const { data: users, error: usersError } = await supabaseAdmin
    .from('users')
    .select('id, stripe_customer_id, company_name')
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
      results.push({ userId: user.id, recoveredTotal: 0, fee: 0, skipped: 'no_customer' });
      continue;
    }

    const { data: events, error: eventsError } = await supabaseAdmin
      .from('recovered_revenue_events')
      .select('id, amount')
      .eq('user_id', user.id)
      .eq('billed', false);

    if (eventsError) {
      results.push({ userId: user.id, recoveredTotal: 0, fee: 0, error: 'events lookup failed' });
      continue;
    }

    const recoveredTotal = (events ?? []).reduce((sum, e) => sum + Number(e.amount), 0);
    const performanceFee = recoveredTotal > 0 ? Math.round(recoveredTotal * PERFORMANCE_FEE_RATE * 100) / 100 : 0;
    const fee = PERFORMANCE_BASE_FEE + performanceFee;
    const eventIds = (events ?? []).map((e) => e.id);

    try {
      await stripe.invoiceItems.create({
        customer: user.stripe_customer_id,
        amount: Math.round(PERFORMANCE_BASE_FEE * 100),
        currency: 'eur',
        description: 'Churnly — socle mensuel',
      });

      if (performanceFee > 0) {
        await stripe.invoiceItems.create({
          customer: user.stripe_customer_id,
          amount: Math.round(performanceFee * 100),
          currency: 'eur',
          description: `Churnly — ${PERFORMANCE_FEE_RATE * 100}% du revenu récupéré (${formatEuro(recoveredTotal)})`,
        });
      }

      const invoice = await stripe.invoices.create({
        customer: user.stripe_customer_id,
        collection_method: 'charge_automatically',
        auto_advance: true,
      });

      const finalized = await stripe.invoices.finalizeInvoice(invoice.id!);

      if (eventIds.length > 0) {
        const { error: markError } = await supabaseAdmin
          .from('recovered_revenue_events')
          .update({ billed: true, billed_at: new Date().toISOString(), stripe_invoice_id: finalized.id })
          .in('id', eventIds);
        if (markError) {
          console.error('[performanceBilling] failed to mark events billed', JSON.stringify({ userId: user.id, markError }));
        }
      }

      await logAuditEvent(supabaseAdmin, user.id, 'performance_revenue_billed', {
        recoveredTotal,
        fee,
        invoiceId: finalized.id,
      });

      results.push({ userId: user.id, recoveredTotal, fee, invoiceId: finalized.id ?? undefined });
    } catch (err) {
      console.error('[performanceBilling] invoicing failed', JSON.stringify({ userId: user.id, err: err instanceof Error ? err.message : err }));
      results.push({ userId: user.id, recoveredTotal, fee, error: err instanceof Error ? err.message : 'invoicing failed' });
    }
  }

  return results;
}
