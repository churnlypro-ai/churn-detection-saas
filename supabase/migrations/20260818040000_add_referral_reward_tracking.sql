/*
# Referral rewards: track when an account first became a paying customer

The referral program (see 20260817050000_add_referral_tracking.sql) only
tracked who referred whom, deliberately with no reward mechanism — the
business decision was made later: an owner who brings in 2 paying
referrals in a calendar month gets 50% off their next month, 3+ gets it
free (see /api/cron/referral-rewards).

To compute that monthly, we need to know exactly when a referred account
went from trial/nothing to an actual paying subscription — subscription
tier/status alone don't capture that "first time" moment (status flips
back and forth on renewal, upgrade, etc). `became_paying_at` is set once,
by the Stripe webhook, the first time a user's subscription_status
transitions to 'active', and never overwritten after that.
*/

alter table public.users
  add column if not exists became_paying_at timestamptz;
