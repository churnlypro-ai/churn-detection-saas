import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin';

interface AnalysisRow {
  id: string;
  client_name: string;
  revenue_monthly: number;
  churn_score: number;
  reason: string;
  solution: string;
  analyzed_at: string;
}

// Lecture seule, réservée à ADMIN_EMAILS : permet de voir exactement le
// dashboard d'un compte donné (support, préparation d'un appel de vente)
// sans jamais pouvoir agir à sa place — aucune route d'écriture équivalente
// n'existe côté admin.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  if (!isAdminEmail(userData.user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('users')
    .select('id, email, company_name, client_count, monthly_revenue, churn_rate, subscription_status, subscription_tier, industry, business_description')
    .eq('id', id)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  const { data: results } = await supabaseAdmin
    .from('analysis_results')
    .select('id, client_name, revenue_monthly, churn_score, reason, solution, analyzed_at')
    .eq('user_id', id)
    .order('analyzed_at', { ascending: false });

  const latestByClient = new Map<string, AnalysisRow>();
  for (const row of (results ?? []) as AnalysisRow[]) {
    if (!latestByClient.has(row.client_name)) latestByClient.set(row.client_name, row);
  }
  const clients = Array.from(latestByClient.values()).sort((a, b) => b.churn_score - a.churn_score);

  // Même formule que app/dashboard/page.tsx (metrics useMemo) — répliquée
  // ici pour que cette vue admin corresponde exactement à ce que le client
  // voit chez lui, pas une approximation.
  const clientCount = profile.client_count ?? clients.length ?? 0;
  const mrr = profile.monthly_revenue ?? clients.reduce((sum, c) => sum + (Number(c.revenue_monthly) || 0), 0);
  const churnRate = profile.churn_rate ?? 0;
  const atRisk = clients.length > 0
    ? clients.filter((c) => c.churn_score >= 60).length
    : (clientCount > 0 && churnRate > 0 ? Math.max(1, Math.round((clientCount * churnRate) / 100)) : 0);
  const ltv = clientCount ? mrr / clientCount : 0;

  return NextResponse.json({
    profile,
    clients,
    metrics: { mrr, churnRate, ltv, clientCount, atRisk },
  });
}
