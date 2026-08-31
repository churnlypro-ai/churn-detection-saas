import { getSupabaseAdmin } from '@/lib/supabase';
import { analyzeChurnRisk, type AnalysisLanguage, type ModelTier } from '@/lib/claude';
import { triggerRiskWebhooks } from '@/lib/webhooks';

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
  // Le contexte métier (secteur + description libre) est lu ici plutôt que
  // passé par l'appelant : les deux points d'entrée (CSV et Stripe Connect,
  // voir app/api/analyze et app/api/stripe/connect/import) partagent cette
  // fonction et ne devraient pas avoir à redupliquer cette lecture.
  const { data: businessProfile } = await supabaseAdmin
    .from('users')
    .select('company_name, industry, business_description, subscription_status, trial_used, billing_mode')
    .eq('id', userId)
    .maybeSingle();

  // Opus 5 (le plus cher) n'est déclenché que pour un compte réellement
  // abonné — un essai ou un compte gratuit reçoit une analyse Haiku 4.5. Voir
  // la note dans lib/claude.ts pour la décision produit derrière ce choix.
  const modelTier: ModelTier = businessProfile?.subscription_status === 'active' ? 'premium' : 'standard';
  const isPaying = businessProfile?.subscription_status === 'active' || businessProfile?.subscription_status === 'trialing';

  const analysis = await analyzeChurnRisk(clients, language, {
    companyName: businessProfile?.company_name ?? null,
    industry: businessProfile?.industry ?? null,
    description: businessProfile?.business_description ?? null,
  }, modelTier);

  // Doit être lu AVANT d'insérer les nouveaux résultats plus bas : c'est la
  // photo "avant ce ré-import" qui sert de référence pour détecter les
  // clients disparus (voir plus bas, après l'insert).
  const { data: previousResults } = await supabaseAdmin
    .from('analysis_results')
    .select('client_name, churn_score, reason, analyzed_at')
    .eq('user_id', userId)
    .order('analyzed_at', { ascending: false });

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
  const byName = new Map<string, Array<{ revenue: number; renewal: string | null; email: string | null }>>();
  for (const c of clients) {
    const name = c.name as string;
    const rawEmail = c.email;
    const entry = {
      revenue: Number(c.revenue_monthly) || 0,
      renewal: parseDateOrNull(c.renewal_date),
      // Vient soit d'une colonne "email" du CSV, soit de l'import Stripe
      // Connect (voir StripeSourcedClient dans lib/stripeConnect.ts) —
      // jamais deviné, laissé vide si absent des deux.
      email: typeof rawEmail === 'string' && rawEmail.trim() ? rawEmail.trim() : null,
    };
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
      client_email: matched?.email ?? null,
      churn_score: item.churn_score,
      reason: item.summary_reason,
      solution: item.recommended_actions[0]?.detail ?? '',
      confidence: item.confidence,
      details: { risk_factors: item.risk_factors, recommended_actions: item.recommended_actions },
    };
  });

  const { error: insertError } = await supabaseAdmin.from('analysis_results').insert(rows);
  if (insertError) throw insertError;

  // Un client présent lors du dernier import et absent de celui-ci a de
  // fortes chances d'être parti — heuristique raisonnable, pas une
  // certitude (un ré-upload partiel peut produire un faux positif), d'où
  // 'auto_reimport' comme source et 'ignoreDuplicates' pour ne jamais
  // écraser une correction manuelle déjà enregistrée (voir la contrainte
  // unique(user_id, client_name) dans la migration correspondante).
  const previousLatestByClient = new Map<string, number>();
  for (const r of previousResults ?? []) {
    if (!previousLatestByClient.has(r.client_name)) previousLatestByClient.set(r.client_name, r.churn_score);
  }
  const newClientNames = new Set(analysis.map((item) => item.client_name));
  const disappearedClients = Array.from(previousLatestByClient.entries()).filter(([name]) => !newClientNames.has(name));

  if (disappearedClients.length > 0) {
    const outcomeRows = disappearedClients.map(([client_name, churn_score]) => ({
      user_id: userId,
      client_name,
      outcome: 'churned' as const,
      churn_score_at_outcome: churn_score,
      source: 'auto_reimport' as const,
      resolved_at: new Date().toISOString(),
    }));
    const { error: outcomeError } = await supabaseAdmin
      .from('client_outcomes')
      .upsert(outcomeRows, { onConflict: 'user_id,client_name', ignoreDuplicates: true });
    if (outcomeError) {
      console.error('[analysis] auto outcome detection failed', JSON.stringify({ userId, outcomeError }));
    }
  }

  // Facturation à la performance (voir lib/performanceBilling.ts) : compter
  // un client comme "récupéré" exige deux choses, pas une seule — (1) il
  // était à risque, ET (2) Churnly a fait quelque chose de concret pour lui
  // (un email de rétention réellement envoyé depuis le compte, voir
  // client_retention_drafts), après quoi il est toujours là au scan suivant.
  // Jamais juste "le score est redescendu tout seul" : un score IA peut
  // bouger pour mille raisons sans rapport avec nous, alors qu'un email
  // envoyé est une action traçable qu'on peut montrer à un client qui doute.
  //
  // Même règle pour tout le monde, Stripe ou CSV : on ne s'appuie plus sur
  // payment_status (absent d'un import CSV) mais sur la présence du client
  // dans CE ré-import — s'il a disparu, on l'a perdu (voir plus haut,
  // disappearedClients) ; s'il est encore là, on l'a sauvé.
  if (businessProfile?.billing_mode === 'performance') {
    const previousByClient = new Map<string, { churn_score: number; analyzedAt: string }>();
    for (const r of previousResults ?? []) {
      if (!previousByClient.has(r.client_name)) previousByClient.set(r.client_name, { churn_score: r.churn_score, analyzedAt: r.analyzed_at });
    }

    const { data: sentDrafts } = await supabaseAdmin
      .from('client_retention_drafts')
      .select('client_name, sent_at')
      .eq('account_id', userId)
      .eq('status', 'sent');

    // Un seul brouillon existe par (compte, client) — voir la contrainte
    // unique dans la migration correspondante — donc pas besoin de garder le
    // plus récent parmi plusieurs, juste sa date d'envoi.
    const emailSentAt = new Map<string, string>();
    for (const d of sentDrafts ?? []) {
      if (d.sent_at) emailSentAt.set(d.client_name, d.sent_at);
    }

    const recoveredRows = rows
      .filter((row) => {
        const previous = previousByClient.get(row.client_name);
        if (!previous || previous.churn_score < 60) return false;
        const sentAt = emailSentAt.get(row.client_name);
        // L'email doit avoir été envoyé APRÈS ce signalement précis — sinon
        // un vieil email envoyé pour un tout autre épisode de risque
        // suffirait à justifier n'importe quelle récupération ultérieure.
        return !!sentAt && sentAt >= previous.analyzedAt;
      })
      .map((row) => ({
        user_id: userId,
        client_name: row.client_name,
        amount: row.revenue_monthly,
      }));

    if (recoveredRows.length > 0) {
      const { error: recoveredError } = await supabaseAdmin.from('recovered_revenue_events').insert(recoveredRows);
      if (recoveredError) {
        console.error('[analysis] recovered revenue insert failed', JSON.stringify({ userId, recoveredError }));
      }
    }
  }

  const atRiskCount = analysis.filter((item) => item.churn_score >= 60).length;

  // On ne demande jamais le taux de churn à l'inscription — une entreprise
  // qui vient chez Churnly ne le connaît généralement pas elle-même, c'est
  // exactement ce que l'analyse résout. C'est donc ici, à partir du vrai
  // résultat (CSV ou Stripe), que le chiffre est calculé et enregistré.
  const computedChurnRate = clients.length > 0 ? (atRiskCount / clients.length) * 100 : 0;
  const { error: churnUpdateError } = await supabaseAdmin
    .from('users')
    .update({
      churn_rate: Number(computedChurnRate.toFixed(1)),
      // Un compte gratuit n'a droit qu'à une seule analyse (voir le
      // garde-fou dans app/api/analyze et app/api/stripe/connect/import,
      // qui autorise cette analyse précisément parce que trial_used est
      // encore false) — on la marque consommée seulement une fois qu'elle a
      // réellement abouti, jamais avant l'appel Claude.
      ...(isPaying ? {} : { trial_used: true }),
    })
    .eq('id', userId);
  if (churnUpdateError) {
    console.error('[analysis] churn_rate update failed', JSON.stringify({ userId, churnUpdateError }));
  }

  // Best-effort, ne doit jamais faire échouer l'analyse elle-même — voir
  // lib/webhooks.ts.
  try {
    await triggerRiskWebhooks(supabaseAdmin, userId, businessProfile?.company_name ?? '', analysis);
  } catch (err) {
    console.error('[analysis] webhook trigger failed', JSON.stringify({ userId, err: err instanceof Error ? err.message : err }));
  }

  return {
    uploadId: upload.id as string,
    clientCount: clients.length,
    atRiskCount,
    analysis,
  };
}
