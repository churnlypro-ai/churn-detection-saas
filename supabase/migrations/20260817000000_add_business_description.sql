/*
# Add a mandatory business description column to users

The churn-risk prompt in lib/claude.ts previously reasoned with universal
thresholds (e.g. "N days inactive = risk") applied identically to every
account. That is wrong across business types: a daily-habit product
(Spotify-like) sees very different normal usage cadence than a B2B tool
naturally used once a week or once a month. The coarse `industry` dropdown
(saas/agency/ecommerce/manager/other) is not enough to calibrate this —
Claude needs to know what the business actually does.

This column stores that free-text description, collected at signup (see
app/signup/page.tsx step3, app/api/complete-signup/route.ts) and editable
from /settings. Nullable at the DB level (existing accounts predate this
field and a NOT NULL/CHECK constraint would break them retroactively) —
"mandatory" is enforced at the application layer: complete-signup requires
a non-empty value for new accounts, and the dashboard nudges existing
accounts that don't have one yet.

Same self-update GRANT pattern as company_name / language: not security or
billing sensitive, safe for a user to edit directly.
*/

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS business_description text;

GRANT UPDATE (business_description) ON public.users TO authenticated;
