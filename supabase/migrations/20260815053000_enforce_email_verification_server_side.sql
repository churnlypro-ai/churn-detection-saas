/*
# Make email verification actually enforceable server-side

email_verifications previously only stored a code and its expiry. Nothing
recorded whether a code had actually been successfully verified, and
nothing capped how many guesses were allowed. Combined with the client
calling supabase.auth.signUp() directly from the browser, this meant the
4-digit code step was purely cosmetic: it could be skipped entirely by
calling Supabase Auth directly with any email address, verified or not.

Adds:
- `verified boolean` — set true only once the correct code is submitted.
  app/api/complete-signup/route.ts checks this (and expires_at) before
  ever creating the auth account, so account creation is now actually
  gated on proving inbox ownership.
- `attempts int` — capped at 5 wrong guesses per sent code (see
  app/api/verify-email/route.ts) so the 4-digit space (10,000
  combinations) can't be brute-forced by hammering the verify endpoint.
*/

ALTER TABLE public.email_verifications
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS attempts int NOT NULL DEFAULT 0;
