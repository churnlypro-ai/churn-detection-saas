import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { computeAdminChurnRisk } from '@/lib/adminChurnRisk';
import { isAdminEmail } from '@/lib/admin';

interface UserRow {
  id: string;
  email: string;
  company_name: string | null;
  subscription_status: string;
  subscription_tier: string | null;
  created_at: string;
  became_paying_at: string | null;
  trial_end: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referred_by: string | null;
}

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

  if (!isAdminEmail(userData.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: users, error: usersError } = await supabaseAdmin
    .from('users')
    .select('id, email, company_name, subscription_status, subscription_tier, created_at, became_paying_at, trial_end, utm_source, utm_medium, utm_campaign, referred_by')
    .order('created_at', { ascending: false });

  if (usersError) {
    console.error('[admin/overview] failed to load users', usersError);
    return NextResponse.json({ error: 'Failed to load accounts' }, { status: 500 });
  }

  // Dernière date d'analyse par compte (import CSV ou resync Stripe — les
  // deux créent une ligne csv_uploads, voir runChurnAnalysis dans
  // lib/analysis.ts) : sert de proxy d'activité réelle sur le produit,
  // séparément de la simple existence d'un abonnement.
  const { data: uploads } = await supabaseAdmin
    .from('csv_uploads')
    .select('user_id, upload_date')
    .order('upload_date', { ascending: false });

  const lastActivityByUser = new Map<string, string>();
  for (const row of uploads ?? []) {
    if (!lastActivityByUser.has(row.user_id)) {
      lastActivityByUser.set(row.user_id, row.upload_date);
    }
  }

  // Volontairement PAS "clients sauvés" — un épisode traité résolu ne
  // prouve pas que Churnly en est la cause (voir la migration
  // churn_recovery_samples et lib/performanceBilling.ts pour la vraie
  // mesure, via groupe témoin). Ce chiffre est juste informatif : combien
  // d'épisodes de risque suivis, côté traité, se sont résolus.
  const { count: treatedResolvedTotal } = await supabaseAdmin
    .from('churn_recovery_samples')
    .select('id', { count: 'exact', head: true })
    .eq('sample_group', 'treatment')
    .eq('resolved', true);

  const { count: performanceInvoicesFailed } = await supabaseAdmin
    .from('performance_invoices')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'failed');

  const now = Date.now();
  const accounts = ((users ?? []) as UserRow[]).map((u) => {
    const lastActivityAt = lastActivityByUser.get(u.id) ?? null;
    const risk = computeAdminChurnRisk({
      subscriptionStatus: u.subscription_status,
      createdAt: u.created_at,
      lastActivityAt,
    }, now);
    return {
      id: u.id,
      email: u.email,
      companyName: u.company_name,
      subscriptionStatus: u.subscription_status,
      monthlyPrice: u.subscription_tier ? Number(u.subscription_tier) : 0,
      createdAt: u.created_at,
      becamePayingAt: u.became_paying_at,
      trialEnd: u.trial_end,
      lastActivityAt,
      risk,
      utmSource: u.utm_source,
      utmMedium: u.utm_medium,
      utmCampaign: u.utm_campaign,
      referredBy: u.referred_by,
    };
  }).sort((a, b) => b.risk.score - a.risk.score);

  const summary = {
    totalAccounts: accounts.length,
    activePaying: accounts.filter((a) => a.subscriptionStatus === 'active').length,
    trialing: accounts.filter((a) => a.subscriptionStatus === 'trialing').length,
    pastDue: accounts.filter((a) => a.subscriptionStatus === 'past_due').length,
    canceled: accounts.filter((a) => a.subscriptionStatus === 'canceled').length,
    mrr: accounts.filter((a) => a.subscriptionStatus === 'active').reduce((sum, a) => sum + a.monthlyPrice, 0),
    highRiskCount: accounts.filter((a) => a.risk.level === 'high' && a.subscriptionStatus !== 'canceled').length,
    fromAds: accounts.filter((a) => !!a.utmSource).length,
    treatedResolvedTotal: treatedResolvedTotal ?? 0,
    performanceInvoicesFailed: performanceInvoicesFailed ?? 0,
  };

  return NextResponse.json({ summary, accounts });
}
