/*
# Envoi de prospection depuis Gmail (admin uniquement)

Deux tables pour la fonctionnalité "envoyer des emails de prospection
depuis churnly.pro@gmail.com sans copier-coller manuel" :

- admin_gmail_connection : une seule ligne, le refresh token OAuth Gmail
  chiffré (jamais en clair en base). Accès service-role uniquement, comme
  audit_log — aucune policy RLS n'autorise un accès direct depuis le
  client, cette table ne doit jamais transiter par le navigateur.
- prospecting_emails : la file d'attente des emails à envoyer, avec leur
  statut. Idem, service-role uniquement — les routes /api/admin/* vérifient
  isAdminEmail() avant tout accès.
*/

create table if not exists public.admin_gmail_connection (
  id uuid primary key default gen_random_uuid(),
  connected_email text not null,
  refresh_token_encrypted text not null,
  connected_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_gmail_connection enable row level security;

create table if not exists public.prospecting_emails (
  id uuid primary key default gen_random_uuid(),
  company_name text,
  recipient_email text not null,
  subject text not null,
  body text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

alter table public.prospecting_emails enable row level security;

create index if not exists prospecting_emails_status_idx on public.prospecting_emails(status, created_at);
