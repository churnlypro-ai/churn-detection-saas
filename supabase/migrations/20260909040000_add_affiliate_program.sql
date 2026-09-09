/*
# Programme d'affiliation

Distinct du parrainage client existant (users.referred_by /
lib/referralRewards.ts, qui récompense un CLIENT Churnly en crédit de
solde Stripe sur son propre abonnement) : un affilié n'est pas
nécessairement client Churnly (fondateur SaaS, créateur de contenu,
agence), et est payé en argent réel, pas en crédit — d'où deux tables
séparées plutôt que de réutiliser le mécanisme existant.

Géré par l'équipe Churnly (admin), pas d'inscription publique : les
affiliés sont ajoutés manuellement via /admin/affiliates. Le paiement
réel (virement/PayPal) reste manuel — cette table ne fait que calculer
et suivre ce qui est dû, jamais n'envoie d'argent elle-même.
*/

create table if not exists public.affiliates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  referral_code text not null unique,
  commission_rate numeric not null default 0.20 check (commission_rate > 0 and commission_rate <= 1),
  payout_method text,
  status text not null default 'active' check (status in ('active', 'paused')),
  notes text,
  created_at timestamptz not null default now()
);

alter table public.affiliates enable row level security;

-- Namespace séparé de users.referred_by (parrainage client) : un code
-- affilié n'est jamais un users.referral_code, jamais de collision
-- possible entre les deux systèmes.
alter table public.users add column if not exists affiliate_referred_by text;

create table if not exists public.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Clé d'idempotence : Stripe peut redélivrer un même événement
  -- invoice.paid plus d'une fois (voir la note dans app/api/stripe-webhook)
  -- — sans cette contrainte unique, une redélivraison compterait deux fois
  -- la même commission.
  stripe_invoice_id text not null unique,
  amount_cents integer not null,
  currency text not null default 'eur',
  period text not null,
  status text not null default 'pending' check (status in ('pending', 'paid')),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.affiliate_commissions enable row level security;

create index if not exists affiliate_commissions_affiliate_id_idx on public.affiliate_commissions(affiliate_id);
