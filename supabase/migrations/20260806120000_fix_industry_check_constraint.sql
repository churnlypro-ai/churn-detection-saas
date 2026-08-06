/*
# Fix industry CHECK constraint to allow 'ecommerce'

The signup wizard (app/signup/page.tsx) lets users pick one of four
industries: 'saas', 'agency', 'ecommerce', 'other'. The CHECK constraint
added in 20260729184333_add_onboarding_fields.sql only allowed
'saas', 'agency', 'other' — so saving a profile with industry set to
'ecommerce' always violated the constraint and failed.

This widens the constraint to match the UI's actual options.
*/

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_industry_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_industry_check
  CHECK (industry IS NULL OR industry IN ('saas', 'agency', 'ecommerce', 'other'));
