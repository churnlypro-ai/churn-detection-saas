/*
# Fix handle_new_user regression: gen_random_bytes broken again

20260818013000_fix_handle_new_user_gen_random_bytes.sql fixed this
function once already: gen_random_bytes() lives in the `extensions`
schema on Supabase, not in the default search_path a SECURITY DEFINER
trigger inherits, so every signup (password, magic link, or Google) was
failing with "Database error saving new user". The fix switched to a
core-only random source (md5 + random(), no extension needed) and pinned
search_path explicitly as defense in depth.

20260823000000_add_ad_attribution.sql then did `create or replace
function public.handle_new_user()` to add utm_source/medium/campaign
columns — a full replace, not a patch, so it silently dropped both the
gen_random_bytes fix and the search_path pin, bringing the exact same
"Database error saving new user" failure back. This is exactly what
Kendal hit trying to sign up.

Re-fixing here, keeping the ad-attribution columns the 08-23 migration
was actually meant to add: same as 20260818013000, an unqualified
extension function should never be part of this trigger again.
*/

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, company_name, language, referral_code, referred_by, utm_source, utm_medium, utm_campaign)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'company_name', ''),
    case when new.raw_user_meta_data->>'language' = 'en' then 'en' else 'fr' end,
    substr(md5(random()::text || clock_timestamp()::text), 1, 8),
    nullif(new.raw_user_meta_data->>'referred_by', ''),
    nullif(new.raw_user_meta_data->>'utm_source', ''),
    nullif(new.raw_user_meta_data->>'utm_medium', ''),
    nullif(new.raw_user_meta_data->>'utm_campaign', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Rattrape les comptes auth.users créés pendant que le trigger était cassé
-- (Kendal notamment) : l'utilisateur existe côté auth mais n'a jamais reçu
-- sa ligne public.users, donc tout ce qui en dépend (dashboard, /impact,
-- /closer...) échoue derrière une connexion pourtant réussie.
insert into public.users (id, email, company_name, language, referral_code)
select
  au.id,
  au.email,
  coalesce(au.raw_user_meta_data->>'company_name', ''),
  case when au.raw_user_meta_data->>'language' = 'en' then 'en' else 'fr' end,
  substr(md5(random()::text || clock_timestamp()::text || au.id::text), 1, 8)
from auth.users au
left join public.users pu on pu.id = au.id
where pu.id is null;
