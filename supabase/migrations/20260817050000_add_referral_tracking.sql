/*
# Referral tracking (no reward mechanism)

Adds the plumbing to know who referred whom — a unique code per account and
a record of which code was used at signup. Deliberately does NOT grant any
discount, credit, or payout automatically: what the reward should be (a
free month? a percentage? a cash payout?) is a pricing/business decision,
not something to invent unilaterally in a migration. This just makes the
data available so that decision can be implemented on top later without
another schema change, and so the account owner can already see how many
signups their link produced from /settings.

1. New columns on users
- `referral_code`: unique, auto-generated for every account (existing and
  new — the backfill below covers rows that predate this migration).
- `referred_by`: the referral_code that was active at signup time, if the
  visitor came through a referral link (?ref=... on /signup, see
  app/signup/page.tsx). Null for everyone who didn't.

2. Security
- Both columns are informational, not self-editable (no GRANT UPDATE) —
  same reasoning as churn_rate: letting a client set their own referred_by
  after the fact wouldn't mean anything, and referral_code is meant to be
  stable, not something to game by regenerating it.
*/

alter table public.users
  add column if not exists referral_code text,
  add column if not exists referred_by text;

update public.users set referral_code = encode(gen_random_bytes(4), 'hex') where referral_code is null;

alter table public.users
  alter column referral_code set not null,
  add constraint users_referral_code_unique unique (referral_code);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, company_name, language, referral_code, referred_by)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'company_name', ''),
    case when new.raw_user_meta_data->>'language' = 'en' then 'en' else 'fr' end,
    encode(gen_random_bytes(4), 'hex'),
    nullif(new.raw_user_meta_data->>'referred_by', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;
