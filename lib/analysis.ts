import { getSupabaseAdmin } from '@/lib/supabase';
import { analyzeChurnRisk, type AnalysisLanguage } from '@/lib/claude';

function parseDateOrNull(value: unknown): string | null {
  if (!value || typeof value !== 'string') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

// Partagée entre l'import CSV (app/api/analyze) et l'import Stripe Connect
// (app/api/stripe/connect/import) — les deux se ramènent au même tableau de
// clients normalisés en entrée, donc à la même analyse et au même stockage
// derrière. Aucune des deux routes ne doit dupliquer cette logique.
export async function runChurnAnalysis(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  clients: Array<Record<string, unknown>>,
  filename: string | null,
  language: AnalysisLanguage,
) {
  const analysis = await analyzeChurnRisk(clients, language);

  const { data: upload, error: uploadError } = await supabaseAdmin
    .from('csv_uploads')
    .insert({ user_id: userId, client_count: clients.length, filename })
    .select()
    .single();

  if (uploadError) throw uploadError;

  // Une simple Map name -> valeur écraserait silencieusement les doublons
  // (deux clients au même nom — franchises, lignes génériques "Client",
  // saisie dupliquée) : le dernier gagnerait, et TOUS les clients de ce nom
  // hériteraient de son revenu. Une file par nom associe au contraire
  // chaque occurrence à la bonne, dans l'ordre où Claude les a reçues.
  const byName = new Map<string, Array<{ revenue: number; renewal: string | null }>>();
  for (const c of clients) {
    const name = c.name as string;
    const entry = { revenue: Number(c.revenue_monthly) || 0, renewal: parseDateOrNull(c.renewal_date) };
    const existing = byName.get(name);
    if (existing) existing.push(entry);
    else byName.set(name, [entry]);
  }

  const rows = analysis.map((item) => {
    const queue = byName.get(item.client_name);
    const matched = queue?.shift();
    return {
      user_id: userId,
      upload_id: upload.id,
      client_name: item.client_name,
      revenue_monthly: matched?.revenue ?? 0,
      renewal_date: matched?.renewal ?? null,
      churn_score: item.churn_score,
      reason: item.summary_reason,
      solution: item.recommended_actions[0]?.detail ?? '',
      confidence: item.confidence,
      details: { risk_factors: item.risk_factors, recommended_actions: item.recommended_actions },
    };
  });

  const { error: insertError } = await supabaseAdmin.from('analysis_results').insert(rows);
  if (insertError) throw insertError;

  const atRiskCount = analysis.filter((item) => item.churn_score >= 60).length;

  // On ne demande jamais le taux de churn à l'inscription — une entreprise
  // qui vient chez Churnly ne le connaît généralement pas elle-même, c'est
  // exactement ce que l'analyse résout. C'est donc ici, à partir du vrai
  // résultat (CSV ou Stripe), que le chiffre est calculé et enregistré.
  const computedChurnRate = clients.length > 0 ? (atRiskCount / clients.length) * 100 : 0;
  const { error: churnUpdateError } = await supabaseAdmin
    .from('users')
    .update({ churn_rate: Number(computedChurnRate.toFixed(1)) })
    .eq('id', userId);
  if (churnUpdateError) {
    console.error('[analysis] churn_rate update failed', JSON.stringify({ userId, churnUpdateError }));
  }

  return {
    uploadId: upload.id as string,
    clientCount: clients.length,
    atRiskCount,
    analysis,
  };
}
