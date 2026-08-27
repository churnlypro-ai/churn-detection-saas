import { getStripe } from '@/lib/stripe';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/auditLog';
import { sendReferralRewardEmail } from '@/lib/email';

// Un seul filleul devenu payant suffit à offrir un mois gratuit au parrain
// — récompensé immédiatement à la conversion (webhook Stripe), pas en lot
// mensuel avec des paliers. Jamais bloquant : un échec ici ne doit jamais
// faire échouer le webhook qui l'appelle.
export async function rewardReferrerForConversion(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  referredByCode: string,
): Promise<void> {
  try {
    const { data: referrer } = await supabaseAdmin
      .from('users')
      .select('id, email, company_name, stripe_customer_id, stripe_subscription_id, subscription_status, language')
      .eq('referral_code', referredByCode)
      .maybeSingle();

    if (
      !referrer?.stripe_subscription_id ||
      !referrer.stripe_customer_id ||
      !['active', 'trialing'].includes(referrer.subscription_status)
    ) {
      return;
    }

    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(referrer.stripe_subscription_id);
    const price = subscription.items.data[0]?.price;
    const unitAmount = price?.unit_amount ?? 0;
    if (unitAmount <= 0) return;

    // Un crédit de solde plutôt qu'un coupon appliqué à l'abonnement : un
    // coupon posé via `subscriptions.update({ discounts: [...] })` REMPLACE
    // le discount existant au lieu de s'y ajouter — si un 2e filleul du même
    // parrain devient payant avant que le 1er mois offert ait été consommé
    // par une facture, le 2e appel écraserait silencieusement le 1er. Un
    // crédit de solde, lui, s'additionne à chaque appel et s'applique
    // automatiquement sur les prochaines factures, dans l'ordre.
    await stripe.customers.createBalanceTransaction(referrer.stripe_customer_id, {
      amount: -unitAmount,
      currency: price?.currency ?? 'eur',
      description: 'Mois offert — parrainage',
    });

    await logAuditEvent(supabaseAdmin, referrer.id, 'referral_reward_applied');

    try {
      await sendReferralRewardEmail({
        to: referrer.email,
        companyName: referrer.company_name || 'votre entreprise',
        language: referrer.language === 'en' ? 'en' : 'fr',
      });
    } catch (emailErr) {
      console.error('[referral-rewards] email failed', JSON.stringify({ referrerId: referrer.id, err: emailErr instanceof Error ? emailErr.message : emailErr }));
    }
  } catch (err) {
    console.error('[referral-rewards] failed to reward referrer', JSON.stringify({ referredByCode, err: err instanceof Error ? err.message : err }));
  }
}
