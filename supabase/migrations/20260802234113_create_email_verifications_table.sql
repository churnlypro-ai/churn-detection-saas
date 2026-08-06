/*
# Create email_verifications table

1. New Tables
- `email_verifications`
  - `email` (text, primary key) — the email being verified
  - `code` (text, not null) — 4-digit verification code
  - `expires_at` (timestamptz, not null) — when the code expires (10 min)
  - `created_at` (timestamptz, default now())
2. Security
- Enable RLS on `email_verifications`.
- Allow anon + authenticated to insert/select (verification codes are used during signup before auth).
- No update or delete policies needed — codes are managed server-side via service role.
*/

CREATE TABLE IF NOT EXISTS email_verifications (
  email text PRIMARY KEY,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_email_verifications" ON email_verifications;
CREATE POLICY "anon_insert_email_verifications"
ON email_verifications FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_email_verifications" ON email_verifications;
CREATE POLICY "anon_select_email_verifications"
ON email_verifications FOR SELECT
TO anon, authenticated USING (true);
