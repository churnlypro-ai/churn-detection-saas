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
      .select('id, email, company_name, stripe_subscription_id, subscription_status, language')
      .eq('referral_code', referredByCode)
      .maybeSingle();

    if (!referrer?.stripe_subscription_id || !['active', 'trialing'].includes(referrer.subscription_status)) {
      return;
    }

    const stripe = getStripe();
    const coupon = await stripe.coupons.create({
      percent_off: 100,
      duration: 'once',
      max_redemptions: 1,
      name: 'Mois offert — parrainage',
    });
    await stripe.subscriptions.update(referrer.stripe_subscription_id, { discounts: [{ coupon: coupon.id }] });

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
