-- Passage d'une file de prospects partagée entre tous les closers à une
-- file assignée individuellement — voir app/api/closer/prospects (filtre
-- désormais par assigned_to) et /admin/closer-prospects (répartition).
-- Nullable : les prospects déjà en base avant ce changement restent non
-- assignés jusqu'à répartition manuelle via l'admin.
alter table public.cold_call_prospects add column if not exists assigned_to text;

create index if not exists cold_call_prospects_assigned_to_idx on public.cold_call_prospects(assigned_to);
