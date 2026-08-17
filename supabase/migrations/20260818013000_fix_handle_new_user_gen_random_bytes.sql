/*
# Fix handle_new_user: gen_random_bytes not visible in trigger context

pgcrypto lives in the `extensions` schema on Supabase, but this
SECURITY DEFINER trigger function has no explicit search_path, so it
inherits whatever search_path the auth service's role has — which does
not include `extensions`. Every signup (password or OAuth) has been
failing since the referral_tracking migration with:

  function gen_random_bytes(integer) does not exist

confirmed in Postgres logs. Swap referral_code generation to core
functions only (md5 + random), which never depend on which schema an
extension happens to be installed in, and pin search_path explicitly
as defense in depth for this SECURITY DEFINER function.
*/

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, company_name, language, referral_code, referred_by)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'company_name', ''),
    case when new.raw_user_meta_data->>'language' = 'en' then 'en' else 'fr' end,
    substr(md5(random()::text || clock_timestamp()::text), 1, 8),
    nullif(new.raw_user_meta_data->>'referred_by', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;
