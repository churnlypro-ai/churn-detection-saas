/*
# Prevent repeat free trials

trial_end gets reset to null on subscription cancellation, which erases
any record that a trial ever happened. Without a separate permanent flag,
a customer whose trial ends (canceled/expired) can click "start free
trial" again and receive a brand new 3-day trial from Stripe, since
trial_period_days is applied per subscription, not per customer.

trial_used is set once, on the first trial ever granted, and never reset.
*/

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS trial_used boolean NOT NULL DEFAULT false;
