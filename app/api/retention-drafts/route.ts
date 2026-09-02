import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { resolveAccountId } from '@/lib/team';
import { generateClientEmail, pickBestTemplate, type AnalysisLanguage, type ModelTier, type RiskFactor, type RecommendedAction } from '@/lib/claude';

// Même seuil que la stat de précision affichée sur le dashboard
// (churn_score >= 60 = "à risque" ou plus) — pas la peine d'un brouillon de
// rétention pour un client stable.
const AT_RISK_THRESHOLD = 60;

// Un brouillon par client est généré au plus une fois : s'il existe déjà
// (modifié ou déjà envoyé), on ne le régénère jamais tout seul — regénérer
// écraserait silencieusement une modification manuelle. Voir la contrainte
// unique(account_id, client_name).
export const maxDuration = 300;

interface AnalysisRowLite {
  client_name: string;
  client_email: string | null;
  revenue_monthly: number;
  churn_score: number;
  reason: string;
  solution: string;
  details: { risk_factors: RiskFactor[]; recommended_actions: RecommendedAction[] } | null;
  analyzed_at: string;
}

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }
  const accountId = await resolveAccountId(supabaseAdmin, userData.user.id);

  const language: AnalysisLanguage = req.nextUrl.searchParams.get('language') === 'en' ? 'en' : 'fr';

  // Même règle que runChurnAnalysis (lib/analysis.ts) : Opus réservé aux
  // comptes réellement abonnés, un essai gratuit reçoit Haiku 4.5 — la
  // génération de brouillons de rétention ne doit pas coûter plus cher
  // qu'un essai ne rapporte.
  const { data: businessProfile } = await supabaseAdmin
    .from('users')
    .select('subscription_status')
    .eq('id', accountId)
    .maybeSingle();
  const modelTier: ModelTier = businessProfile?.subscription_status === 'active' ? 'premium' : 'standard';

  const { data: rows, error: rowsError } = await supabaseAdmin
    .from('analysis_results')
    .select('client_name, client_email, revenue_monthly, churn_score, reason, solution, details, analyzed_at')
    .eq('user_id', accountId)
    .order('analyzed_at', { ascending: false });

  if (rowsError) return NextResponse.json({ error: 'Lecture des analyses échouée.' }, { status: 500 });

  const latestByClient = new Map<string, AnalysisRowLite>();
  for (const row of (rows ?? []) as AnalysisRowLite[]) {
    if (!latestByClient.has(row.client_name)) latestByClient.set(row.client_name, row);
  }

  // Le groupe témoin (voir lib/analysis.ts et la migration
  // churn_recovery_samples) ne doit JAMAIS recevoir de relance tant que son
  // épisode est ouvert — sinon la mesure de l'incrément réel n'a plus de
  // sens. On ne génère donc simplement aucun brouillon pour ces clients-là,
  // pas de bouton à retenir de ne pas cliquer.
  const { data: controlSamples } = await supabaseAdmin
    .from('churn_recovery_samples')
    .select('client_name')
    .eq('user_id', accountId)
    .eq('sample_group', 'control')
    .eq('resolved', false);
  const withheldNames = new Set((controlSamples ?? []).map((s) => s.client_name));

  const atRiskClients = Array.from(latestByClient.values())
    .filter((r) => r.churn_score >= AT_RISK_THRESHOLD && !withheldNames.has(r.client_name));

  const { data: existingDrafts, error: draftsError } = await supabaseAdmin
    .from('client_retention_drafts')
    .select('id, client_name, client_email, template_id, subject, body, status, error_message, sent_at, updated_at')
    .eq('account_id', accountId);

  if (draftsError) return NextResponse.json({ error: 'Lecture des brouillons échouée.' }, { status: 500 });

  const draftByClient = new Map((existingDrafts ?? []).map((d) => [d.client_name, d]));
  const missing = atRiskClients.filter((c) => !draftByClient.has(c.client_name));

  // Génération bornée en parallèle (3 à la fois) — un client à risque
  // manquant appelle Claude une fois, pas de quoi paralléliser à l'infini,
  // mais pas non plus séquentiel si la liste est longue.
  const CONCURRENCY = 3;
  for (let i = 0; i < missing.length; i += CONCURRENCY) {
    const chunk = missing.slice(i, i + CONCURRENCY);
    const generated = await Promise.all(chunk.map(async (client) => {
      const templateId = pickBestTemplate({
        reason: client.reason,
        risk_factors: client.details?.risk_factors,
        recommended_actions: client.details?.recommended_actions,
      });
      try {
        const email = await generateClientEmail(templateId, {
          client_name: client.client_name,
          churn_score: client.churn_score,
          reason: client.reason,
          solution: client.solution,
          revenue_monthly: client.revenue_monthly,
          risk_factors: client.details?.risk_factors,
          recommended_actions: client.details?.recommended_actions,
        }, language, modelTier);
        return { client, templateId, email, error: null as string | null };
      } catch (err) {
        return { client, templateId, email: null, error: err instanceof Error ? err.message : 'Génération échouée.' };
      }
    }));

    const toInsert = generated
      .filter((g) => g.email)
      .map((g) => ({
        account_id: accountId,
        client_name: g.client.client_name,
        client_email: g.client.client_email,
        template_id: g.templateId,
        subject: g.email!.subject,
        body: g.email!.body,
        status: 'draft' as const,
      }));

    if (toInsert.length > 0) {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('client_retention_drafts')
        .upsert(toInsert, { onConflict: 'account_id,client_name' })
        .select('id, client_name, client_email, template_id, subject, body, status, error_message, sent_at, updated_at');
      if (insertError) {
        console.error('[retention-drafts] insert failed', JSON.stringify(insertError));
      } else {
        for (const row of inserted ?? []) draftByClient.set(row.client_name, row);
      }
    }
  }

  const drafts = atRiskClients
    .map((c) => draftByClient.get(c.client_name))
    .filter((d): d is NonNullable<typeof d> => !!d)
    .sort((a, b) => (a.status === 'draft' ? 0 : 1) - (b.status === 'draft' ? 0 : 1));

  return NextResponse.json({ drafts, atRiskCount: atRiskClients.length });
}
