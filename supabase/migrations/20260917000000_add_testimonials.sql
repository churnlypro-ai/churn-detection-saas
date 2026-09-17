-- Avis clients affichés sur la page d'accueil (voir la section témoignages
-- dans app/page.tsx). Soumis par un client connecté depuis /avis, modérés
-- par un admin depuis /admin/testimonials avant de devenir publics — jamais
-- affiché tel quel dès la soumission, pour éviter tout avis inapproprié ou
-- non désiré en ligne sans relecture.
--
-- Une seule ligne par client (user_id unique) : une nouvelle soumission met
-- à jour la même ligne plutôt que d'en créer une deuxième, et repasse le
-- statut à 'pending' pour une nouvelle relecture.
--
-- RLS activé sans policy, comme cold_call_prospects — accès uniquement via
-- service role, depuis /api/testimonials (soumission + lecture publique des
-- avis approuvés) et /api/admin/testimonials (modération).
create table if not exists testimonials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references users(id) on delete cascade,
  author_name text not null,
  company_name text,
  role_title text,
  rating smallint not null check (rating between 1 and 5),
  content text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table testimonials enable row level security;

create index if not exists testimonials_status_idx on testimonials (status, created_at desc);
