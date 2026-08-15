/*
# churn_rate is now computed by Churnly, not self-reported

Asking a prospective customer for their own churn rate at signup never
made sense — most businesses don't actually know it, which is precisely
the problem Churnly solves. churn_rate is now computed automatically by
app/api/analyze/route.ts from real analysis results (service role,
bypasses this grant as usual) and is no longer part of the signup or
settings forms.

Removes churn_rate from the column-level UPDATE grant added in
20260815050000_restrict_users_self_update_columns.sql — the client can
no longer write it directly, whether through the app UI (already removed)
or by calling the Supabase REST API directly.
*/

REVOKE UPDATE (churn_rate) ON public.users FROM authenticated;
