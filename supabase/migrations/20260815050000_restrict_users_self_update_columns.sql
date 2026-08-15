/*
# Restrict which columns a user can update on their own row

The existing RLS policy "users can update own row" only checks WHICH ROW
can be touched (auth.uid() = id) — it does not restrict WHICH COLUMNS.
Since the app calls supabase.from('users').update(...) directly from the
browser using the public anon key, any authenticated user could send a
request updating ANY column on their own row, including ones that must
only ever be written by trusted server code:

  subscription_status, subscription_tier, stripe_customer_id,
  stripe_subscription_id, trial_end, trial_used, lead_tier,
  company_verified, company_legal_name, company_siret

...meaning a user could grant themselves an active paid subscription for
free, or reset trial_used to bypass the one-trial-per-account limit,
entirely by calling the Supabase REST API directly, bypassing Stripe and
the app's own server-side checks completely.

RLS policies operate at the row level and can't express "this column but
not that one" on their own, so this is enforced with a column-level GRANT
instead, checked by Postgres independently of (and before) RLS: only the
columns a user is legitimately meant to self-report (company profile
inputs used across signup/settings/pricing) remain writable by the
`authenticated` role. Every other column can only be written by
server-side code using the service role key (getSupabaseAdmin()), which
bypasses this grant entirely, same as it already bypasses RLS.
*/

REVOKE UPDATE ON public.users FROM authenticated;

GRANT UPDATE (company_name, client_count, monthly_revenue, churn_rate, industry)
  ON public.users TO authenticated;
