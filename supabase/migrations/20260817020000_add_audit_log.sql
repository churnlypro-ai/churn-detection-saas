/*
# Audit log for security/billing-sensitive actions

A larger customer evaluating Churnly (or their security team) will
eventually ask "can we see who did what on this account, and when" — there
was nothing to show them. This adds a minimal, append-only trail for the
actions that actually matter: connecting/disconnecting Stripe, and
subscription tier changes.

1. New table
- `audit_log`: user_id, action (short machine-readable string), optional
  metadata (jsonb, kept minimal — never raw secrets/tokens), created_at.

2. Security
- SELECT is owner-scoped like every other table (auth.uid() = user_id), so
  a user can see their own trail from /settings.
- Deliberately NO insert/update/delete policy for the `authenticated` role:
  an audit trail a user could edit or delete via the client isn't a trail.
  All writes go through service-role API routes (see lib/auditLog.ts),
  which bypass RLS the same way the rest of the write-path already does
  (analysis_results, csv_uploads, etc.).
*/

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  action text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_user_id_created_at_idx on public.audit_log(user_id, created_at desc);

alter table public.audit_log enable row level security;

drop policy if exists "select_own_audit_log" on public.audit_log;
create policy "select_own_audit_log" on public.audit_log
  for select to authenticated using (auth.uid() = user_id);
