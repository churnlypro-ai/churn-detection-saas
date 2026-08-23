/*
# Réservation de call (bouton "Réserver un call" sur l'accueil)

Un visiteur indique ses disponibilités depuis la landing page ; l'équipe
Churnly confirme ensuite un créneau précis, ce qui déclenche l'email de
confirmation. Service-role uniquement, comme prospecting_emails — aucune
policy RLS n'autorise un accès direct depuis le navigateur : l'insertion
publique passe par /api/call-bookings (route serveur), la lecture/mise à
jour par /api/admin/call-bookings/* (isAdminEmail()).

- status 'pending' : demande reçue, en attente de confirmation d'un créneau
  par l'équipe.
- status 'confirmed' : un créneau (confirmed_slot, texte libre) a été fixé
  et l'email de confirmation envoyé au visiteur.
- status 'canceled' : demande écartée (spam, doublon...), pas d'email
  envoyé automatiquement.
*/

create table if not exists public.call_bookings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  company_name text,
  availability text not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'canceled')),
  confirmed_slot text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.call_bookings enable row level security;

create index if not exists call_bookings_status_idx on public.call_bookings(status, created_at);
