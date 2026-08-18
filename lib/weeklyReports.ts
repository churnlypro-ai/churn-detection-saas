import { getSupabaseAdmin } from '@/lib/supabase';
import { sendWeeklyReportEmail, sendWelcomeEmail } from '@/lib/email';

interface WeeklyReportUser {
  id: string;
  email: string;
  company_name: string;
  subscription_tier: string | null;
  created_at: string;
  language: string | null;
}

// Extrait de /api/send-email (jusque-là appelable seulement à la main ou
// via un secret de cron, mais jamais réellement planifié) — voir
// app/api/cron/resync-stripe/route.ts pour où ça se déclenche maintenant.
export async function runWeeklyReports(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
): Promise<{ userId: string; sent: boolean; type: string }[]> {
  const { data: users, error: usersError } = await supabaseAdmin
    .from('users')
    .select('id, email, company_name, subscription_status, subscription_tier, created_at, language')
    .eq('subscription_status', 'active');

  if (usersError) {
    console.error('[weekly-reports] failed to load users', usersError);
    return [];
  }

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  // Fenêtre de 7 jours (14-21j après inscription) plutôt qu'un simple
  // "<= 14 jours" : ce cron tourne chaque semaine, donc un seuil sans borne
  // haute renverrait cet email de bienvenue à CHAQUE run, indéfiniment, à
  // tout compte actif depuis plus de 2 semaines — un vrai bug une fois ce
  // cron réellement planifié (il ne l'était pas jusqu'ici).
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const twentyOneDaysAgo = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();
  const results: { userId: string; sent: boolean; type: string }[] = [];

  for (const user of (users ?? []) as WeeklyReportUser[]) {
    try {
      const { data: recentAnalysis } = await supabaseAdmin
        .from('analysis_results')
        .select('churn_score, revenue_monthly')
        .eq('user_id', user.id)
        .gte('analyzed_at', oneWeekAgo);

      const { data: completedActions } = await supabaseAdmin
        .from('actions')
        .select('id')
        .eq('user_id', user.id)
        .eq('completed', true)
        .gte('created_at', oneWeekAgo);

      const rows = (recentAnalysis ?? []) as { churn_score: number; revenue_monthly: number }[];
      const atRisk = rows.filter((r) => r.churn_score >= 60);
      const churnRateNow = rows.length ? (atRisk.length / rows.length) * 100 : 0;
      const clientsSaved = completedActions?.length ?? 0;
      const revenueSaved = atRisk.reduce((sum, r) => sum + (Number(r.revenue_monthly) || 0), 0);
      const roiPercent = rows.length ? Math.round((clientsSaved / rows.length) * 100) : 0;

      const language = user.language === 'en' ? 'en' : 'fr';

      await sendWeeklyReportEmail({
        to: user.email,
        companyName: user.company_name || (language === 'en' ? 'there' : 'là'),
        clientsSaved,
        revenueSaved,
        roiPercent,
        churnRateNow: Number(churnRateNow.toFixed(1)),
        churnRateBefore: Number(churnRateNow.toFixed(1)),
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
        language,
      });
      results.push({ userId: user.id, sent: true, type: 'weekly' });

      if (user.created_at && user.created_at <= fourteenDaysAgo && user.created_at > twentyOneDaysAgo) {
        const monthlyPrice = Number(user.subscription_tier) || 300;
        await sendWelcomeEmail({
          to: user.email,
          companyName: user.company_name || '',
          monthlyPrice,
          appUrl: process.env.NEXT_PUBLIC_APP_URL || '',
          language,
        });
        results.push({ userId: user.id, sent: true, type: 'welcome' });
      }
    } catch (err) {
      console.error(`[weekly-reports] failed for user ${user.id}`, err);
      results.push({ userId: user.id, sent: false, type: 'error' });
    }
  }

  return results;
}
