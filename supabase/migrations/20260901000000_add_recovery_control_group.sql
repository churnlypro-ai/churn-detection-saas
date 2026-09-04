/*
# Groupe témoin pour mesurer l'incrément réel de récupération

Un prospect (Kevin) a démontré que "relance envoyée + client toujours là"
ne prouve pas que Churnly a causé la récupération — une relance qui part
avant que Stripe ne réussisse son propre retry ne fait que précéder
l'événement, pas le causer. La seule mesure qui prouve un effet causal :
un groupe témoin. Sur chaque nouvel épisode de risque (voir
detectRecoveredRevenue-like logique dans lib/analysis.ts), 5% des clients
sont tirés au sort et volontairement PAS relancés (la génération de
brouillon de rétention est supprimée pour eux, voir
app/api/retention-drafts/route.ts). On compare ensuite le taux de
résolution spontanée du groupe témoin à celui du groupe traité — l'écart
est l'incrément réellement imputable à Churnly.

Remplace l'ancien recovered_revenue_events (facturation par client nommé)
par une facturation sur l'écart statistique mesuré chaque mois (voir
lib/performanceBilling.ts) : on ne peut plus dire "CE client précis a été
sauvé", seulement "on récupère X points de plus que le taux spontané" —
moins narratif, mais imputable et défendable.

Uniquement pour les comptes en mode performance : withhold une relance à
un client, c'est un vrai coût pour le compte, on ne l'impose pas à un
compte qui n'a pas explicitement choisi ce mode de facturation.
*/

create table if not exists public.churn_recovery_samples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_name text not null,
  sample_group text not null check (sample_group in ('treatment', 'control')),
  revenue_monthly numeric not null,
  flagged_at timestamptz not null default now(),
  resolved boolean not null default false,
  resolved_at timestamptz,
  -- Posé une fois inclus dans le calcul d'une facture (voir
  -- lib/performanceBilling.ts) : jamais recompté dans une période
  -- ultérieure, résolu ou non à ce moment-là.
  billed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.churn_recovery_samples enable row level security;

create index if not exists churn_recovery_samples_user_billed_idx
  on public.churn_recovery_samples(user_id, billed_at);

-- Un seul épisode ouvert à la fois par client : s'il redevient à risque
-- après une résolution, c'est un nouvel épisode (nouveau tirage au sort),
-- pas une réouverture du précédent.
create unique index if not exists churn_recovery_samples_user_client_open_idx
  on public.churn_recovery_samples(user_id, client_name)
  where resolved = false;
