/*
# Add onboarding fields to users table

Adds company onboarding data collected during the 3-step signup wizard:
client count, monthly revenue, and industry type. These power the instant
churn analysis shown to new users before they subscribe.

1. Modified Tables
- `public.users`: adds three nullable columns
  - `client_count` (int): number of clients the company has
  - `monthly_revenue` (numeric): monthly recurring revenue in euros
  - `industry` (text): industry type — 'saas', 'agency', or 'other'

2. Security
- No RLS policy changes needed — existing UPDATE policy already covers
  the new columns (it allows the owner to update any field on their row).

3. Important Notes
- All columns are nullable so existing rows are unaffected.
- No data loss — purely additive.
*/

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS client_count int,
  ADD COLUMN IF NOT EXISTS monthly_revenue numeric(12, 2),
  ADD COLUMN IF NOT EXISTS industry text CHECK (industry IN ('saas', 'agency', 'other'));
