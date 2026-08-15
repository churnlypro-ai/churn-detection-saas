/*
# Lock down email_verifications — remove public read/write access

The original policies on email_verifications allowed BOTH anon and
authenticated roles to freely SELECT (USING (true)) and INSERT
(WITH CHECK (true)) on this table, with no restriction whatsoever. That
means any anonymous visitor could read the 4-digit verification code for
ANY email address directly via the public Supabase REST API/anon key —
no brute force needed, no rate limiting relevant, the code is just
handed over on request. The same openness let anyone overwrite the
pending code for any email address too.

This was unnecessary: app/api/verify-email/route.ts already does every
read and write against this table using the service role key (bypasses
RLS entirely), which is the only code path that has ever needed access
to it. The anon/authenticated policies served no legitimate purpose and
were pure attack surface.

Removing them locks the table to service-role-only access, matching the
same pattern already used for risk_alerts.
*/

DROP POLICY IF EXISTS "anon_insert_email_verifications" ON email_verifications;
DROP POLICY IF EXISTS "anon_select_email_verifications" ON email_verifications;
