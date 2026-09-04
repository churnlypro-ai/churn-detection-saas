/*
# Suivi des factures de facturation à la performance

Jusqu'ici, une facture créée par lib/performanceBilling.ts n'était tracée
nulle part côté Churnly une fois envoyée à Stripe — si le paiement du
client échouait, on ne le savait jamais : aucun webhook n'était géré pour
invoice.payment_failed (voir app/api/stripe-webhook/route.ts). Ironique vu
que tout ce système de facturation est né d'un problème de paiements
échoués côté clients de nos clients — on doit avoir la même rigueur sur nos
propres factures. performance_invoices donne un endroit où suivre chaque
facture émise et son statut réel.

recovered_revenue_events.counts_for_billing distingue les événements
détectés alors que le compte était déjà en mode performance (facturables,
voir lib/performanceBilling.ts) de ceux détectés pendant que le compte
était encore en abonnement classique — désormais enregistrés dans tous les
cas (voir lib/analysis.ts) pour permettre un comparatif classique/
performance basé sur de vraies données dans /settings, sans jamais
facturer rétroactivement un historique accumulé avant que le client
n'ait choisi ce mode.
*/

alter table public.recovered_revenue_events
  add column if not exists counts_for_billing boolean not null default true;

create table if not exists public.performance_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_invoice_id text not null unique,
  amount numeric not null,
  status text not null default 'open' check (status in ('open', 'paid', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.performance_invoices enable row level security;

create index if not exists performance_invoices_user_status_idx
  on public.performance_invoices(user_id, status);
