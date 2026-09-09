import type Stripe from 'stripe';
import { getSupabaseAdmin } from '@/lib/supabase';

// Appelé depuis le webhook invoice.paid (voir app/api/stripe-webhook) — pour
// CHAQUE facture payée, pas seulement à la conversion, contrairement au
// parrainage client (lib/referralRewards.ts) qui récompense une fois. Une
// commission d'affiliation est récurrente tant que le client référé reste
// payant, donc calculée à chaque facture, pas juste à la première.
export async function recordAffiliateCommission(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  invoice: Stripe.Invoice,
): Promise<void> {
  if (!invoice.customer || !invoice.id || invoice.amount_paid <= 0) return;

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, affiliate_referred_by')
    .eq('stripe_customer_id', String(invoice.customer))
    .maybeSingle();

  if (!user?.affiliate_referred_by) return;

  const { data: affiliate } = await supabaseAdmin
    .from('affiliates')
    .select('id, commission_rate, status')
    .eq('referral_code', user.affiliate_referred_by)
    .maybeSingle();

  // Un affilié mis en pause continue de générer des factures pour ses
  // filleuls déjà signés, mais ne doit plus accumuler de nouvelle commission
  // — status vérifié à chaque facture, pas seulement à l'attribution.
  if (!affiliate || affiliate.status !== 'active') return;

  const amountCents = Math.round(invoice.amount_paid * affiliate.commission_rate);
  if (amountCents <= 0) return;

  const paidAt = invoice.status_transitions?.paid_at
    ? new Date(invoice.status_transitions.paid_at * 1000)
    : new Date();

  const { error } = await supabaseAdmin.from('affiliate_commissions').insert({
    affiliate_id: affiliate.id,
    user_id: user.id,
    stripe_invoice_id: invoice.id,
    amount_cents: amountCents,
    currency: invoice.currency ?? 'eur',
    period: paidAt.toISOString().slice(0, 7), // YYYY-MM
  });

  // Code d'erreur Postgres 23505 = violation de contrainte unique — c'est
  // exactement le cas attendu d'une redélivraison Stripe du même événement,
  // pas une vraie erreur à logger comme un échec.
  if (error && error.code !== '23505') {
    console.error('[affiliates] commission insert failed', JSON.stringify({ invoiceId: invoice.id, error }));
  }
}

// Génère un code court et unique à partir du nom — jamais deviné par
// l'affilié lui-même (contrairement à users.referral_code qui est
// généralement l'email ou un code choisi côté client) : c'est nous qui
// créons l'affilié, donc c'est nous qui générons son code.
export function generateAffiliateCode(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 12) || 'affilie';
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}${suffix}`;
}
