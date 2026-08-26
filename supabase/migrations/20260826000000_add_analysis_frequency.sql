/*
# Add a user-configurable churn re-analysis frequency

Connected Stripe accounts are currently re-analyzed by the daily
app/api/cron/resync-stripe cron for every single paying/trialing user,
every day, with no choice — that's a full Claude API pass over each
account's entire customer list, daily, whether their data changes often
or not. Clients should be able to pick a cadence that matches how often
their data actually moves, or opt out of the automatic cron entirely and
trigger a re-analysis themselves from /upload whenever they want.

Not security-sensitive (unlike subscription/trial fields locked down in
20260815050000_restrict_users_self_update_columns.sql) — same category as
language/business_description, safe to add to the self-update grant.
*/

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS analysis_frequency text NOT NULL DEFAULT 'daily'
  CHECK (analysis_frequency IN ('daily', 'weekly', 'monthly', 'manual'));

GRANT UPDATE (analysis_frequency) ON public.users TO authenticated;
