import { getStripe } from '@/lib/stripe';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/auditLog';
import { sendReferralRewardEmail } from '@/lib/email';

interface RewardCandidate {
  id: string;
  email: string;
  company_name: string | null;
  referral_code: string;
  stripe_subscription_id: string | null;
  subscription_status: string;
  language: string | null;
}

// [start, end) en UTC pour le mois calendaire précédent le moment de l'appel
// — le cron tourne le 1er du mois, donc "le mois dernier" est ce sur quoi on
// récompense (voir la note métier dans /api/cron/referral-rewards).
export function previousMonthRange(now: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  return { start, end };
}

// >=3 filleuls devenus payants dans le mois -> mois prochain gratuit ; 2 ->
// moitié prix ; moins -> rien. Seuils fixés par choix produit (voir
// conversation du 18/08) : pas configurables, volontairement simples.
export function percentOffForCount(count: number): number {
  if (count >= 3) return 100;
  if (count === 2) return 50;
  return 0;
}

// Cœur de la logique, appelé par le cron mensuel. Retourne un résumé par
// utilisateur récompensé pour logging/debug — jamais bloquant : un échec
// Stripe pour un utilisateur ne doit pas empêcher les autres.
export async function applyMonthlyReferralRewards(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  now: Date = new Date(),
): Promise<{ userId: string; referralCount: number; percentOff: number; error?: string }[]> {
  const { start, end } = previousMonthRange(now);
  const stripe = getStripe();

  const { data: candidates } = await supabaseAdmin
    .from('users')
    .select('id, email, company_name, referral_code, stripe_subscription_id, subscription_status, language')
    .not('referral_code', 'is', null)
    .not('stripe_subscription_id', 'is', null)
    .in('subscription_status', ['active', 'trialing']);

  const results: { userId: string; referralCount: number; percentOff: number; error?: string }[] = [];

  for (const user of (candidates ?? []) as RewardCandidate[]) {
    const { count } = await supabaseAdmin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('referred_by', user.referral_code)
      .gte('became_paying_at', start.toISOString())
      .lt('became_paying_at', end.toISOString());

    const referralCount = count ?? 0;
    const percentOff = percentOffForCount(referralCount);
    if (percentOff === 0 || !user.stripe_subscription_id) {
      continue;
    }

    try {
      const coupon = await stripe.coupons.create({
        percent_off: percentOff,
        duration: 'once',
        max_redemptions: 1,
        name: `Récompense parrainage (${referralCount} filleul${referralCount > 1 ? 's' : ''})`,
      });
      await stripe.subscriptions.update(user.stripe_subscription_id, { discounts: [{ coupon: coupon.id }] });

      await logAuditEvent(supabaseAdmin, user.id, 'referral_reward_applied', { referralCount, percentOff });

      try {
        await sendReferralRewardEmail({
          to: user.email,
          companyName: user.company_name || 'votre entreprise',
          referralCount,
          percentOff,
          language: user.language === 'en' ? 'en' : 'fr',
        });
      } catch (emailErr) {
        console.error('[referral-rewards] email failed', JSON.stringify({ userId: user.id, err: emailErr instanceof Error ? emailErr.message : emailErr }));
      }

      results.push({ userId: user.id, referralCount, percentOff });
    } catch (err) {
      console.error('[referral-rewards] failed for user', JSON.stringify({ userId: user.id, err: err instanceof Error ? err.message : err }));
      results.push({ userId: user.id, referralCount, percentOff, error: err instanceof Error ? err.message : 'unknown error' });
    }
  }

  return results;
}
