/*
# Add churn_rate column to users table

Lets users input their own estimated monthly churn rate during onboarding,
instead of using a hardcoded industry average. All dashboard calculations
are based on this real user-provided number.

1. Modified Tables
- `public.users`: adds `churn_rate` (numeric, nullable) — user-entered monthly churn %.

2. Security
- No policy changes needed — existing UPDATE policy covers the new column.

3. Important Notes
- Nullable so existing rows are unaffected. Purely additive.
*/

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS churn_rate numeric(5, 2);
