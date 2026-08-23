/*
# Ad attribution (utm_source / utm_medium / utm_campaign)

Adds the plumbing to know whether a given signup came from a paid ad
campaign — needed now that a dedicated person manages ads and wants to see
which clients actually came from their campaigns vs organic/referral.

1. New columns on users
- `utm_source`, `utm_medium`, `utm_campaign`: captured client-side from the
  ?utm_source=...&utm_medium=...&utm_campaign=... query params on any
  landing page (see components/AdSourceCapture.tsx + lib/adAttribution.ts),
  carried through signup (password flow: app/api/complete-signup ; Stripe
  Connect flow: app/api/stripe/connect/signup-callback), and stored once at
  account creation. Null for organic/direct/referral signups.

2. Security
- Same reasoning as referral_code/referred_by: informational only, no
  GRANT UPDATE — a client re-tagging their own account's ad source after
  the fact wouldn't mean anything.
*/

alter table public.users
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text;

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, company_name, language, referral_code, referred_by, utm_source, utm_medium, utm_campaign)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'company_name', ''),
    case when new.raw_user_meta_data->>'language' = 'en' then 'en' else 'fr' end,
    encode(gen_random_bytes(4), 'hex'),
    nullif(new.raw_user_meta_data->>'referred_by', ''),
    nullif(new.raw_user_meta_data->>'utm_source', ''),
    nullif(new.raw_user_meta_data->>'utm_medium', ''),
    nullif(new.raw_user_meta_data->>'utm_campaign', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;
