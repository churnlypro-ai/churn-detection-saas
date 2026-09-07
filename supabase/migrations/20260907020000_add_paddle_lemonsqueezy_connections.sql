/*
# Connexions Paddle et Lemon Squeezy (import de clients par clé API)

Deux nouvelles sources d'import, au même titre que Stripe Connect (voir
20260816010000_add_stripe_connect_account.sql) et le CSV : un compte
Churnly peut connecter son compte Paddle ou Lemon Squeezy pour importer
directement ses abonnés actifs, sans fichier à préparer.

Différence structurelle importante avec Stripe Connect : Stripe Connect ne
stocke qu'un identifiant de compte (acct_...), jamais de secret, parce que
les lectures se font avec la clé secrète de la PLATEFORME Churnly plus un
header Stripe-Account — Churnly n'a jamais besoin du secret du client.
Paddle et Lemon Squeezy n'ont pas cette notion de plateforme : la seule
façon de lire les données d'un compte est sa propre clé API, il n'existe
pas d'OAuth "Connect" tiers pour l'un ou l'autre à ce jour. Chaque ligne
stocke donc un vrai secret, chiffré au repos (même mécanisme que
customer_email_connection.refresh_token_encrypted, voir lib/tokenCrypto.ts)
— jamais en clair, jamais renvoyé au navigateur une fois enregistré.

- paddle_connection : une ligne par compte. `environment` distingue un
  compte sandbox (tests) d'un compte production — les deux ont des clés et
  une URL de base différentes chez Paddle, contrairement à Lemon Squeezy où
  une seule URL sert les clés live et test indifféremment.
- lemonsqueezy_connection : une ligne par compte, pas de notion
  d'environnement séparée (voir ci-dessus).

Service-role uniquement, comme customer_email_connection : aucune policy
RLS, les routes /api/paddle/* et /api/lemonsqueezy/* vérifient l'auth et la
propriété du compte elles-mêmes (voir requireOwnerId dans lib/team.ts —
connecter/déconnecter une clé API est réservé au propriétaire, jamais un
membre d'équipe, même logique que Stripe Connect et la facturation).
*/

create table if not exists public.paddle_connection (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references auth.users(id) on delete cascade,
  environment text not null default 'production' check (environment in ('production', 'sandbox')),
  api_key_encrypted text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.paddle_connection enable row level security;

create table if not exists public.lemonsqueezy_connection (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references auth.users(id) on delete cascade,
  api_key_encrypted text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lemonsqueezy_connection enable row level security;
