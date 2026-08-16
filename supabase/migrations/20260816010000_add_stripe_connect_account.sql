/*
# Add Stripe Connect account id to users

Lets a Churnly user import their own customer/subscription data straight
from their Stripe account instead of a CSV (see app/api/stripe/connect/*).
This column stores only the connected account id (acct_...), never an
OAuth access token — read requests to the connected account are made with
the platform's own secret key plus a `Stripe-Account` header, so there is
no per-user secret to store or leak.

Deliberately NOT added to the authenticated self-update grant from
20260815050000_restrict_users_self_update_columns.sql: only the OAuth
callback (service role, after verifying Stripe's signed state) may set or
clear this column. A user must not be able to point their own row at an
arbitrary Stripe account id by calling the REST API directly.
*/

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id text;
