-- Liste de prospects à froid pour les closers (espace /closer), distincte de
-- call_bookings (qui gère les demandes de call entrantes depuis le site).
-- RLS activé sans policy : accès uniquement via service role, depuis les
-- routes /api/closer/prospects (voir isCloserEmail dans lib/closer.ts).
create table if not exists cold_call_prospects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company_name text not null,
  phone text not null,
  sector text,
  status text not null default 'to_call' check (status in ('to_call', 'interested', 'not_interested', 'no_answer', 'callback')),
  notes text,
  called_by text,
  called_at timestamptz,
  created_at timestamptz not null default now()
);

alter table cold_call_prospects enable row level security;

-- Volontairement pas de seed ici : les prospects (noms + téléphones réels de
-- tiers) ne doivent pas vivre dans l'historique git / GitHub. Insérer les
-- lignes directement depuis l'éditeur SQL Supabase après cette migration.
