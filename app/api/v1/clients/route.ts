import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hashApiKey } from '@/lib/apiKeys';

interface ResultRow {
  client_name: string;
  revenue_monthly: number;
  churn_score: number;
  reason: string;
  solution: string;
  confidence: number | null;
  analyzed_at: string;
}

// API en lecture seule : sert exactement les mêmes données que /dashboard,
// pour qu'un client puisse les brancher dans son propre CRM/Slack/outil
// interne sans avoir à parser le HTML du dashboard. Volontairement sans
// écriture — une clé API compromise ne peut jamais modifier de données.
export async function GET(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '');
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing API key (X-API-Key header or Authorization: Bearer <key>)' }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: keyRow } = await supabaseAdmin
    .from('api_keys')
    .select('id, user_id')
    .eq('key_hash', hashApiKey(apiKey))
    .maybeSingle();

  if (!keyRow) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
  }

  // Best-effort — sert uniquement à afficher "dernière utilisation" dans
  // /settings, ne doit jamais bloquer la réponse si ça échoue.
  supabaseAdmin.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyRow.id).then(
    () => {},
    () => {},
  );

  const { data: results } = await supabaseAdmin
    .from('analysis_results')
    .select('client_name, revenue_monthly, churn_score, reason, solution, confidence, analyzed_at')
    .eq('user_id', keyRow.user_id)
    .order('analyzed_at', { ascending: false });

  const latestByClient = new Map<string, ResultRow>();
  for (const row of (results ?? []) as ResultRow[]) {
    if (!latestByClient.has(row.client_name)) latestByClient.set(row.client_name, row);
  }

  const clients = Array.from(latestByClient.values())
    .sort((a, b) => b.churn_score - a.churn_score)
    .map((r) => ({
      name: r.client_name,
      revenue_monthly: r.revenue_monthly,
      churn_score: r.churn_score,
      reason: r.reason,
      solution: r.solution,
      confidence: r.confidence,
    }));

  return NextResponse.json({ clients, count: clients.length });
}
