/*
# Prospection X / Twitter (admin uniquement)

Même modèle que linkedin_prospecting et instagram_prospecting (voir
20260828000000_add_linkedin_prospecting.sql et
20260906000000_add_instagram_prospecting.sql) et pour la même raison : il
n'existe pas d'API publique permettant d'envoyer un DM X à la place de
l'utilisateur — l'automatiser exposerait le compte réel à un bannissement.
Cette table sert donc de file d'attente semi-automatisée : chaque contact
porte un nom, un lien de profil et un message déjà rédigé par l'admin
(jamais généré par l'IA au moment de l'envoi) ; l'envoi reste un geste
manuel sur X (le front ouvre le profil et copie le message dans le
presse-papiers), cette table ne fait qu'enregistrer que le geste a été
fait.

Même modèle d'accès que linkedin_prospecting/instagram_prospecting :
service-role uniquement, les routes /api/admin/* vérifient isAdminEmail()
avant tout accès.
*/

create table if not exists public.x_prospecting (
  id uuid primary key default gen_random_uuid(),
  contact_name text not null,
  x_url text not null,
  message text not null,
  status text not null default 'queued' check (status in ('queued', 'sent')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

alter table public.x_prospecting enable row level security;

create index if not exists x_prospecting_status_idx on public.x_prospecting(status, created_at);
