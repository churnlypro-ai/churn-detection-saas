/*
# Team accounts

Every Churnly account was strictly one login = one person: no way for the
owner to give a colleague their own access without sharing a password.
This adds a minimal team model: the owner invites a teammate by email, the
teammate gets their own login, and can view/act on the owner's dashboard
data — but never touch billing, Stripe Connect, or the owner's password.

1. New table
- `team_members`: one row per invite. `member_user_id` stays null until the
  invited person creates/logs into their own account and the invite is
  accepted (see /api/team/accept). `invite_token` is a random secret used
  to verify the accept link — not the row's primary key, so it can't be
  guessed by iterating ids.

2. Security — the important part
- SELECT is scoped to the owner or the member themselves (auth.uid() =
  owner_user_id or auth.uid() = member_user_id) — either side of the
  relationship can see it, nobody else can.
- Deliberately NO insert/update/delete policy for `authenticated`. If a
  client-side insert with status='accepted' were allowed, any authenticated
  account could grant itself access to ANY other account's data by
  inserting a row naming that account as owner — a full cross-tenant data
  leak. All writes (creating an invite, accepting one, removing a member)
  go through service-role API routes that decide what's allowed
  server-side, the same pattern already used for audit_log.
- `is_team_member_of(target_user_id)`: SECURITY DEFINER helper so it can be
  referenced from other tables' RLS policies without those policies having
  to know about team_members' own RLS. Only returns true for an ACCEPTED
  membership — a pending invite grants nothing.

3. Extending existing RLS
- `users`, `analysis_results`, `csv_uploads`, `actions`, `client_outcomes`:
  SELECT policies gain `or public.is_team_member_of(user_id)` /
  `or public.is_team_member_of(id)` so an accepted teammate can read the
  owner's dashboard data. UPDATE policies are untouched on purpose — a
  teammate can view and act (mark outcomes, send emails — both written
  server-side with the owner's id, see lib/team.ts) but never edit the
  owner's profile, billing, or password directly.
*/

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users(id) on delete cascade,
  member_user_id uuid references public.users(id) on delete cascade,
  invited_email text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  invite_token text not null default encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (owner_user_id, invited_email)
);

create index if not exists team_members_owner_idx on public.team_members(owner_user_id);
create index if not exists team_members_member_idx on public.team_members(member_user_id);

alter table public.team_members enable row level security;

drop policy if exists "select_own_team_rows" on public.team_members;
create policy "select_own_team_rows" on public.team_members
  for select to authenticated using (auth.uid() = owner_user_id or auth.uid() = member_user_id);

create or replace function public.is_team_member_of(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members
    where owner_user_id = target_user_id
      and member_user_id = auth.uid()
      and status = 'accepted'
  );
$$;

grant execute on function public.is_team_member_of(uuid) to authenticated;

-- users: un membre d'équipe doit pouvoir lire le profil du compte auquel il
-- appartient (nom d'entreprise, statut d'abonnement...) pour que le
-- dashboard s'affiche correctement — jamais le modifier (UPDATE inchangée).
drop policy if exists "users can view own row" on public.users;
create policy "users can view own row" on public.users
  for select to authenticated using (auth.uid() = id or public.is_team_member_of(id));

drop policy if exists "select_own_analysis" on public.analysis_results;
create policy "select_own_analysis" on public.analysis_results
  for select to authenticated using (auth.uid() = user_id or public.is_team_member_of(user_id));

drop policy if exists "select_own_uploads" on public.csv_uploads;
create policy "select_own_uploads" on public.csv_uploads
  for select to authenticated using (auth.uid() = user_id or public.is_team_member_of(user_id));

drop policy if exists "select_own_actions" on public.actions;
create policy "select_own_actions" on public.actions
  for select to authenticated using (auth.uid() = user_id or public.is_team_member_of(user_id));

drop policy if exists "select_own_outcomes" on public.client_outcomes;
create policy "select_own_outcomes" on public.client_outcomes
  for select to authenticated using (auth.uid() = user_id or public.is_team_member_of(user_id));
