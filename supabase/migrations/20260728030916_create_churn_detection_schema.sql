/*
# Create Churn Detection SaaS schema

Creates the full database schema for the Churn Detection SaaS app:
user profiles, CSV uploads, AI churn analysis results, and engagement actions.

1. New Tables
- `users`: one row per authenticated account, mirrors auth.users. Stores
  company name, Stripe subscription info, and integration flags.
- `csv_uploads`: one row per CSV import. Tracks upload date, client count,
  and filename.
- `analysis_results`: churn score per client, per analysis run. Stores the
  client name, monthly revenue, churn score (0-100), reason, recommended
  solution, confidence, and analysis timestamp.
- `actions`: engagement actions taken against at-risk clients (email, call,
  offer). Tracks completion state and timestamp.

2. Security
- Row Level Security enabled on all four tables.
- `users`: users can SELECT and UPDATE only their own row.
- `csv_uploads`, `analysis_results`, `actions`: full CRUD scoped to the
  owning user via auth.uid() = user_id.
- All owner columns default to auth.uid() so client inserts that omit
  user_id still satisfy the WITH CHECK policies.

3. Automation
- A trigger on auth.users automatically creates a public.users profile row
  whenever a new auth user signs up, copying email and company_name from
  the signup metadata.

4. Important Notes
- Email confirmation stays OFF (default).
- Uses gen_random_uuid() (pgcrypto, built into Supabase) for primary keys.
- All policies are idempotent (DROP IF EXISTS before CREATE).
*/

create extension if not exists "pgcrypto";

-- ============================================================
-- users: one row per authenticated account, mirrors auth.users
-- ============================================================
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  company_name text not null default '',
  subscription_tier text check (subscription_tier in ('300', '500', '1000')),
  subscription_status text default 'inactive' check (subscription_status in ('inactive', 'active', 'canceled', 'past_due')),
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_connected boolean default false,
  intercom_connected boolean default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- csv_uploads: one row per CSV import
-- ============================================================
create table if not exists public.csv_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  upload_date timestamptz not null default now(),
  client_count int not null default 0,
  filename text
);

-- ============================================================
-- analysis_results: churn score per client, per analysis run
-- ============================================================
create table if not exists public.analysis_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  upload_id uuid references public.csv_uploads(id) on delete set null,
  client_name text not null,
  revenue_monthly float8 not null default 0,
  churn_score int not null check (churn_score >= 0 and churn_score <= 100),
  reason text not null,
  solution text not null,
  confidence float8,
  analyzed_at timestamptz not null default now()
);

create index if not exists analysis_results_user_id_idx on public.analysis_results(user_id);
create index if not exists analysis_results_analyzed_at_idx on public.analysis_results(analyzed_at desc);
create index if not exists analysis_results_upload_id_idx on public.analysis_results(upload_id);

-- ============================================================
-- actions: engagement actions taken against at-risk clients
-- ============================================================
create table if not exists public.actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  client_name text not null,
  action_type text not null check (action_type in ('email', 'call', 'offer')),
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists actions_user_id_idx on public.actions(user_id);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.users enable row level security;
alter table public.csv_uploads enable row level security;
alter table public.analysis_results enable row level security;
alter table public.actions enable row level security;

-- users: SELECT + UPDATE own row only
drop policy if exists "users can view own row" on public.users;
create policy "users can view own row" on public.users
  for select to authenticated using (auth.uid() = id);

drop policy if exists "users can update own row" on public.users;
create policy "users can update own row" on public.users
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- csv_uploads: full CRUD, owner-scoped
drop policy if exists "select_own_uploads" on public.csv_uploads;
create policy "select_own_uploads" on public.csv_uploads
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "insert_own_uploads" on public.csv_uploads;
create policy "insert_own_uploads" on public.csv_uploads
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "update_own_uploads" on public.csv_uploads;
create policy "update_own_uploads" on public.csv_uploads
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete_own_uploads" on public.csv_uploads;
create policy "delete_own_uploads" on public.csv_uploads
  for delete to authenticated using (auth.uid() = user_id);

-- analysis_results: full CRUD, owner-scoped
drop policy if exists "select_own_analysis" on public.analysis_results;
create policy "select_own_analysis" on public.analysis_results
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "insert_own_analysis" on public.analysis_results;
create policy "insert_own_analysis" on public.analysis_results
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "update_own_analysis" on public.analysis_results;
create policy "update_own_analysis" on public.analysis_results
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete_own_analysis" on public.analysis_results;
create policy "delete_own_analysis" on public.analysis_results
  for delete to authenticated using (auth.uid() = user_id);

-- actions: full CRUD, owner-scoped
drop policy if exists "select_own_actions" on public.actions;
create policy "select_own_actions" on public.actions
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "insert_own_actions" on public.actions;
create policy "insert_own_actions" on public.actions
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "update_own_actions" on public.actions;
create policy "update_own_actions" on public.actions
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete_own_actions" on public.actions;
create policy "delete_own_actions" on public.actions
  for delete to authenticated using (auth.uid() = user_id);

-- ============================================================
-- Auto-create a public.users row whenever a new auth user signs up
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, company_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'company_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
