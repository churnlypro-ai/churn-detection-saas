/*
# Prospection LinkedIn (admin uniquement)

Contrairement à Gmail, il n'existe pas d'API publique permettant d'envoyer
un message LinkedIn à la place de l'utilisateur — l'automatiser exposerait
le compte LinkedIn réel à un bannissement. Cette table sert donc de file
d'attente semi-automatisée : chaque contact porte un nom, un lien de profil
et un message déjà rédigé par l'admin (jamais généré par l'IA, contrairement
à prospecting_emails) ; l'envoi reste un geste manuel sur LinkedIn (le front
ouvre le profil et copie le message dans le presse-papiers), cette table ne
fait qu'enregistrer que le geste a été fait.

Même modèle d'accès que prospecting_emails : service-role uniquement, les
routes /api/admin/* vérifient isAdminEmail() avant tout accès.
*/

create table if not exists public.linkedin_prospecting (
  id uuid primary key default gen_random_uuid(),
  contact_name text not null,
  linkedin_url text not null,
  message text not null,
  status text not null default 'queued' check (status in ('queued', 'sent')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

alter table public.linkedin_prospecting enable row level security;

create index if not exists linkedin_prospecting_status_idx on public.linkedin_prospecting(status, created_at);
