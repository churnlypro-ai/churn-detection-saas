/*
# Add proactive risk-alert support

Churnly currently only surfaces at-risk clients when a user manually opens
the dashboard after an upload. This adds the pieces needed for a daily cron
(app/api/cron/risk-alerts/route.ts) to email account owners automatically
when a client is genuinely at high risk of churning soon:

1. `analysis_results.renewal_date` — optional renewal/subscription-end date
   per client, provided via CSV upload if the account tracks it. Used to
   flag alerts as urgent when a renewal is coming up soon for an at-risk
   client, not just to store metadata.

2. `risk_alerts` — one row per (user, client) recording the last time we
   alerted about that client and at what score, so the daily cron can skip
   clients it already warned about recently instead of re-sending every
   run. Written only by the service role (the cron job), never read by end
   users directly, so RLS is enabled with no policies (locked down, service
   role bypasses RLS as usual).
*/

ALTER TABLE public.analysis_results
  ADD COLUMN IF NOT EXISTS renewal_date date;

CREATE TABLE IF NOT EXISTS public.risk_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  client_name text NOT NULL,
  churn_score int NOT NULL,
  renewal_date date,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, client_name)
);

ALTER TABLE public.risk_alerts ENABLE ROW LEVEL SECURITY;
