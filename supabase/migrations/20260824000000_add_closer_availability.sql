/*
# Espace closer (disponibilités + créneaux réels sur le formulaire public)

Jusqu'ici le visiteur choisissait une date/heure libre sur le formulaire de
l'accueil, et l'équipe confirmait un créneau ensuite par email. Le closer a
maintenant son propre espace (/closer, accès distinct de /admin) pour poser
ses disponibilités récurrentes ; le formulaire public ne propose plus que
les créneaux réellement libres, calculés à partir de ça.

1. closer_availability — disponibilité hebdomadaire récurrente
- day_of_week : 0 (dimanche) à 6 (samedi), comme JS Date.getDay()
- start_time / end_time : heures locales (Europe/Paris), pas de gestion
  multi-fuseau pour l'instant — un seul closer, un seul fuseau
- Service-role uniquement, comme call_bookings : la lecture publique des
  créneaux passe par /api/available-slots (route serveur qui calcule les
  slots libres), jamais un accès direct à cette table depuis le navigateur

2. call_bookings.slot_start — le créneau exact choisi (nullable)
- Rempli quand la réservation vient du nouveau sélecteur de créneaux ;
  reste null pour d'éventuelles anciennes lignes en texte libre. Sert à
  bloquer ce créneau pour qu'il ne soit plus proposé à quelqu'un d'autre.
*/

create table if not exists public.closer_availability (
  id uuid primary key default gen_random_uuid(),
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  constraint closer_availability_valid_range check (start_time < end_time)
);

alter table public.closer_availability enable row level security;

alter table public.call_bookings
  add column if not exists slot_start timestamptz;

create index if not exists call_bookings_slot_start_idx on public.call_bookings(slot_start);
