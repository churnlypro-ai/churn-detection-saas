/*
# Add trial support (3-day Stripe trial)

Checkout now starts subscriptions with a 3-day trial_period_days. During
the trial, Stripe reports the subscription status as 'trialing', not
'active' — the existing subscription_status CHECK constraint didn't allow
that value. Also adds trial_end so the app can show a countdown.
*/

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS trial_end timestamptz;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_subscription_status_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_subscription_status_check
  CHECK (subscription_status IN ('inactive', 'trialing', 'active', 'canceled', 'past_due'));
