/*
# Track real outcomes for churn predictions

Churnly predicts a churn_score per client but never records whether that
prediction was actually right. Without this, there is no way to prove the
analysis works, tune it, or show a customer "we flagged this client and we
were correct N% of the time" — which matters for retention of Churnly's
own customers and for larger accounts asking for proof of ROI.

1. New table
- `client_outcomes`: one row per (user_id, client_name) recording whether
  that client actually churned or was retained, the churn_score that was
  in effect when the outcome was recorded (so precision/recall can be
  computed later), and how the row was created:
  - 'manual': the account owner marked it from the dashboard.
  - 'auto_reimport': a client present in a previous analysis silently
    disappeared from a new CSV/Stripe import — see runChurnAnalysis in
    lib/analysis.ts. A reasonable heuristic (re-importing your client list
    and a name is gone strongly suggests they left), not a certainty — a
    partial re-upload can produce a false positive, which is why a manual
    mark always overrides an auto one (see the upsert conflict handling
    below), never the other way around.

2. Security
- Same owner-scoped RLS pattern as analysis_results/actions: full CRUD for
  the authenticated owner via auth.uid() = user_id.
- Writes happen through service-role API routes (like the rest of the
  analysis pipeline), RLS mainly protects the direct client-side SELECT
  used to render the precision stat on /dashboard.

3. Uniqueness
- unique(user_id, client_name): only the latest known outcome per client
  is kept. Upserts on this key let a manual correction ("actually they
  stayed") cleanly override a stale auto-detected one.
*/

create table if not exists public.client_outcomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  client_name text not null,
  outcome text not null check (outcome in ('churned', 'retained')),
  churn_score_at_outcome int,
  source text not null default 'manual' check (source in ('manual', 'auto_reimport')),
  resolved_at timestamptz not null default now(),
  unique (user_id, client_name)
);

create index if not exists client_outcomes_user_id_idx on public.client_outcomes(user_id);

alter table public.client_outcomes enable row level security;

drop policy if exists "select_own_outcomes" on public.client_outcomes;
create policy "select_own_outcomes" on public.client_outcomes
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "insert_own_outcomes" on public.client_outcomes;
create policy "insert_own_outcomes" on public.client_outcomes
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "update_own_outcomes" on public.client_outcomes;
create policy "update_own_outcomes" on public.client_outcomes
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete_own_outcomes" on public.client_outcomes;
create policy "delete_own_outcomes" on public.client_outcomes
  for delete to authenticated using (auth.uid() = user_id);
