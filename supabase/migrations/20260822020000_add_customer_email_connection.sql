/*
# Connexion email par compte + brouillons de rétention

Permet à un compte Churnly (pas seulement l'admin) de connecter son
propre Gmail pour envoyer, depuis sa propre adresse, les emails de
rétention déjà rédigés pour ses clients à risque — jamais depuis le
domaine Churnly, voir la note dans lib/analysis.ts sur client_email.

- customer_email_connection : une ligne par compte (unique sur
  account_id), même principe que admin_gmail_connection (refresh token
  chiffré, jamais en clair) mais scopé par compte plutôt qu'une seule
  ligne globale. Service-role uniquement — aucune policy RLS, les
  routes /api/gmail/* vérifient l'auth elles-mêmes.
- client_retention_drafts : le brouillon d'email de rétention par
  client à risque (sujet/corps déjà rédigés par l'IA, modifiables avant
  envoi). unique(account_id, client_name) : un seul brouillon actif par
  client, jamais régénéré s'il existe déjà pour ne pas écraser une
  modification manuelle.
*/

create table if not exists public.customer_email_connection (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references auth.users(id) on delete cascade,
  provider text not null default 'gmail' check (provider in ('gmail')),
  connected_email text not null,
  refresh_token_encrypted text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customer_email_connection enable row level security;

create table if not exists public.client_retention_drafts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references auth.users(id) on delete cascade,
  client_name text not null,
  client_email text,
  template_id text not null,
  subject text not null,
  body text not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (account_id, client_name)
);

alter table public.client_retention_drafts enable row level security;

create index if not exists client_retention_drafts_account_status_idx
  on public.client_retention_drafts(account_id, status);
