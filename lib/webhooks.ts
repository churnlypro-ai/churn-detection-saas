import crypto from 'crypto';
import type { getSupabaseAdmin } from '@/lib/supabase';

const RISK_THRESHOLD = 70;
const REQUEST_TIMEOUT_MS = 5000;

interface AtRiskClient {
  client_name: string;
  churn_score: number;
  reason: string;
}

// Best-effort et jamais bloquant pour l'analyse elle-même : un webhook lent
// ou mort ne doit jamais retarder la réponse à l'utilisateur qui vient de
// lancer une analyse. Regroupé en UN seul appel par webhook plutôt qu'un
// appel par client à risque — un gros upload avec beaucoup de clients à
// risque ne doit pas spammer l'URL du client avec des centaines de requêtes.
export async function triggerRiskWebhooks(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  companyName: string,
  analysis: Array<{ client_name: string; churn_score: number; summary_reason: string }>,
): Promise<void> {
  const atRisk: AtRiskClient[] = analysis
    .filter((item) => item.churn_score >= RISK_THRESHOLD)
    .map((item) => ({ client_name: item.client_name, churn_score: item.churn_score, reason: item.summary_reason }));

  if (atRisk.length === 0) return;

  const { data: webhooks } = await supabaseAdmin
    .from('webhooks')
    .select('id, url, secret')
    .eq('user_id', userId)
    .eq('enabled', true);

  if (!webhooks || webhooks.length === 0) return;

  const payload = JSON.stringify({
    event: 'clients_at_risk',
    company_name: companyName,
    threshold: RISK_THRESHOLD,
    clients: atRisk,
    triggered_at: new Date().toISOString(),
  });

  await Promise.allSettled(
    webhooks.map(async (webhook) => {
      const signature = crypto.createHmac('sha256', webhook.secret).update(payload).digest('hex');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        await fetch(webhook.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Churnly-Signature': signature },
          body: payload,
          signal: controller.signal,
        });
      } catch (err) {
        console.error('[webhooks] delivery failed', JSON.stringify({ webhookId: webhook.id, err: err instanceof Error ? err.message : err }));
      } finally {
        clearTimeout(timeout);
      }
    }),
  );
}
