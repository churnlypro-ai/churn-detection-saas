/*
# Facturation à la performance (revenu récupéré, pas CA du client)

Un prospect a relevé que facturer un % du CA du client est régressif : à
21 000€ de CA le prix (800€) pèse 3,8% du CA, à 100 000€ (1200€) seulement
1,2% — le compte le plus fragile paie proportionnellement le plus. Sa
proposition : facturer un % du revenu que Churnly a concrètement fait
récupérer (ex: un paiement en échec relancé avec succès), pas du CA du
client — l'attribution y est nette ("c'est toi ou personne"), et le client
ne paie que si ça marche.

Ce mode de facturation est strictement optionnel et additif : billing_mode
vaut 'revenue_tier' par défaut pour TOUS les comptes existants — rien ne
change pour personne tant qu'un client ne bascule pas explicitement depuis
/settings. Voir lib/performanceBilling.ts et la route
/api/settings/billing-mode pour la logique de bascule et de facturation.
*/

alter table public.users
  add column if not exists billing_mode text not null default 'revenue_tier' check (billing_mode in ('revenue_tier', 'performance')),
  add column if not exists performance_billing_started_at timestamptz;

-- Un événement par client dont le paiement en échec a été détecté comme
-- résolu lors d'un re-sync Stripe, pendant que le compte est en mode
-- performance — voir detectRecoveredRevenue() dans lib/analysis.ts.
-- "billed" passe à true une fois inclus dans une facture mensuelle
-- (voir lib/performanceBilling.ts), jamais remis à false ensuite.
create table if not exists public.recovered_revenue_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_name text not null,
  amount numeric not null,
  detected_at timestamptz not null default now(),
  billed boolean not null default false,
  billed_at timestamptz,
  stripe_invoice_id text
);

alter table public.recovered_revenue_events enable row level security;

create index if not exists recovered_revenue_events_user_billed_idx on public.recovered_revenue_events(user_id, billed);
