/*
# Add a language preference column to users

The app now supports a French/English UI toggle (see lib/i18n/). Backend
jobs that email users outside of any live request — the weekly report cron,
the day-14 welcome offer, and the risk-alert cron in
app/api/cron/risk-alerts/route.ts — have no request-scoped language to read,
so the preference needs to live on the row itself.

Not security-sensitive (unlike subscription/trial fields locked down in
20260815050000_restrict_users_self_update_columns.sql), so it's safe to add
to the same self-update grant a user already has for company_name etc.
*/

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'fr' CHECK (language IN ('fr', 'en'));

GRANT UPDATE (language) ON public.users TO authenticated;

-- Mirrors the company_name behavior: read the language chosen during
-- signup (see app/api/complete-signup/route.ts) from user_metadata so the
-- very first row already carries the right preference.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, company_name, language)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'company_name', ''),
    case when new.raw_user_meta_data->>'language' = 'en' then 'en' else 'fr' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;
