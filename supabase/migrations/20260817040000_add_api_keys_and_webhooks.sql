/*
# Outgoing API access and webhooks

Until now the only way to see Churnly's results was to log into the
dashboard. Bigger customers want to pull data into their own tools (CRM,
internal app) or get pushed a notification the moment a client becomes
risky, without a human checking the dashboard. This adds both, scoped to
the account owner only (same reasoning as billing/Stripe Connect in the
team_members migration: these are account-infrastructure actions, not
something a team member should be able to create on someone else's data).

1. New tables
- `api_keys`: only the SHA-256 hash of the key is stored (`key_hash`),
  never the plaintext — same principle as a password. `key_prefix` keeps
  a few non-secret characters so the owner can recognize which key is
  which in the UI without being able to reconstruct the full secret.
  The plaintext key is shown to the owner exactly once, at creation time,
  in the API response — never persisted, never retrievable again.
- `webhooks`: a URL the owner controls, plus a per-webhook `secret` used
  to HMAC-sign outgoing payloads (see lib/webhooks.ts) so the receiving
  endpoint can verify a payload actually came from Churnly.

2. Security
- RLS SELECT/DELETE scoped to the owner (auth.uid() = user_id) so the
  owner can list/revoke their own keys and webhooks from /settings.
- No INSERT/UPDATE policy for `authenticated`: creating a key or a webhook
  goes through a service-role API route, which is what actually generates
  the secret server-side — a direct client insert could never produce a
  correctly-hashed key_hash anyway, but keeping write access service-role
  keeps this consistent with the rest of the account-infrastructure tables.
*/

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  key_hash text not null unique,
  key_prefix text not null,
  label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists api_keys_user_id_idx on public.api_keys(user_id);

alter table public.api_keys enable row level security;

drop policy if exists "select_own_api_keys" on public.api_keys;
create policy "select_own_api_keys" on public.api_keys
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "delete_own_api_keys" on public.api_keys;
create policy "delete_own_api_keys" on public.api_keys
  for delete to authenticated using (auth.uid() = user_id);

create table if not exists public.webhooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  url text not null,
  secret text not null default encode(gen_random_bytes(24), 'hex'),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists webhooks_user_id_idx on public.webhooks(user_id);

alter table public.webhooks enable row level security;

drop policy if exists "select_own_webhooks" on public.webhooks;
create policy "select_own_webhooks" on public.webhooks
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "delete_own_webhooks" on public.webhooks;
create policy "delete_own_webhooks" on public.webhooks
  for delete to authenticated using (auth.uid() = user_id);
