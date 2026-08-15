import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendRiskAlertEmail } from '@/lib/email';

// Score au-dessus duquel un client mérite une interruption (email) plutôt
// que d'attendre que le badge "Risque" du dashboard soit remarqué.
const ALERT_THRESHOLD = 70;
// On ne ré-alerte pas sur le même client avant ce délai, sauf si son score
// grimpe nettement ou qu'un renouvellement vient de devenir imminent.
const COOLDOWN_DAYS = 7;
const RENEWAL_URGENT_DAYS = 14;

interface LatestResultRow {
  client_name: string;
  churn_score: number;
  reason: string;
  revenue_monthly: number;
  renewal_date: string | null;
  analyzed_at: string;
}

interface ExistingAlertRow {
  client_name: string;
  churn_score: number;
  sent_at: string;
}

function daysBetween(from: number, to: number): number {
  return Math.ceil((to - from) / (24 * 60 * 60 * 1000));
}

async function processUserAlerts(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  user: { id: string; email: string; company_name: string | null; language: string | null },
): Promise<number> {
  const { data: results } = await supabaseAdmin
    .from('analysis_results')
    .select('client_name, churn_score, reason, revenue_monthly, renewal_date, analyzed_at')
    .eq('user_id', user.id)
    .order('analyzed_at', { ascending: false });

  const latestByClient = new Map<string, LatestResultRow>();
  for (const row of (results ?? []) as LatestResultRow[]) {
    if (!latestByClient.has(row.client_name)) latestByClient.set(row.client_name, row);
  }

  const candidates = Array.from(latestByClient.values()).filter((c) => c.churn_score >= ALERT_THRESHOLD);
  if (candidates.length === 0) return 0;

  const { data: existingAlerts } = await supabaseAdmin
    .from('risk_alerts')
    .select('client_name, churn_score, sent_at')
    .eq('user_id', user.id)
    .in('client_name', candidates.map((c) => c.client_name));

  const alertByClient = new Map(
    ((existingAlerts ?? []) as ExistingAlertRow[]).map((a) => [a.client_name, a]),
  );

  const now = Date.now();

  const toAlert = candidates.filter((c) => {
    const prev = alertByClient.get(c.client_name);
    if (!prev) return true;
    const daysSinceLastAlert = daysBetween(new Date(prev.sent_at).getTime(), now);
    const renewalSoon = c.renewal_date != null && daysBetween(now, new Date(c.renewal_date).getTime()) <= RENEWAL_URGENT_DAYS;
    return daysSinceLastAlert >= COOLDOWN_DAYS || c.churn_score >= prev.churn_score + 10 || renewalSoon;
  });

  if (toAlert.length === 0 || !user.email) return 0;

  const clientsForEmail = toAlert
    .map((c) => ({
      name: c.client_name,
      churnScore: c.churn_score,
      reason: c.reason,
      revenueMonthly: Number(c.revenue_monthly) || 0,
      daysUntilRenewal: c.renewal_date ? daysBetween(now, new Date(c.renewal_date).getTime()) : null,
    }))
    .sort((a, b) => {
      const aUrgent = a.daysUntilRenewal !== null && a.daysUntilRenewal <= RENEWAL_URGENT_DAYS;
      const bUrgent = b.daysUntilRenewal !== null && b.daysUntilRenewal <= RENEWAL_URGENT_DAYS;
      if (aUrgent !== bUrgent) return aUrgent ? -1 : 1;
      return b.churnScore - a.churnScore;
    });

  await sendRiskAlertEmail({
    to: user.email,
    companyName: user.company_name || '',
    clients: clientsForEmail,
    dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
    language: user.language === 'en' ? 'en' : 'fr',
  });

  const upsertRows = toAlert.map((c) => ({
    user_id: user.id,
    client_name: c.client_name,
    churn_score: c.churn_score,
    renewal_date: c.renewal_date,
    sent_at: new Date().toISOString(),
  }));
  await supabaseAdmin.from('risk_alerts').upsert(upsertRows, { onConflict: 'user_id,client_name' });

  return toAlert.length;
}

async function handleCron(req: NextRequest) {
  const providedSecret =
    req.headers.get('authorization')?.replace('Bearer ', '') ??
    req.headers.get('x-cron-secret') ??
    new URL(req.url).searchParams.get('secret');

  if (!process.env.CRON_SECRET || providedSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: users, error: usersError } = await supabaseAdmin
    .from('users')
    .select('id, email, company_name, subscription_status, language')
    .in('subscription_status', ['active', 'trialing']);

  if (usersError) {
    console.error('[cron/risk-alerts] failed to load users', usersError);
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 });
  }

  const results: { userId: string; alerted: number }[] = [];

  for (const user of (users ?? []) as { id: string; email: string; company_name: string | null; language: string | null }[]) {
    try {
      const alerted = await processUserAlerts(supabaseAdmin, user);
      results.push({ userId: user.id, alerted });
    } catch (err) {
      console.error(`[cron/risk-alerts] failed for user ${user.id}`, err);
      results.push({ userId: user.id, alerted: 0 });
    }
  }

  return NextResponse.json({ results });
}

export async function GET(req: NextRequest) {
  return handleCron(req);
}

export async function POST(req: NextRequest) {
  return handleCron(req);
}
