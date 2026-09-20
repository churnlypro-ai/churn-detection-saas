-- Prospects trouvés via les réseaux sociaux (X, Instagram, LinkedIn...) plutôt
-- que par téléphone — distinct de cold_call_prospects (voir sa migration)
-- qui suppose toujours un numéro exploitable. Ici le contact se fait par DM,
-- donc phone n'a pas de sens ; website/handle/email servent à la fois de
-- contexte de recherche et de clé de dédoublonnage.
--
-- RLS activé sans policy, même logique que cold_call_prospects — accès
-- uniquement via service role, depuis /api/admin/social-prospects.
create table if not exists social_prospects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company_name text not null,
  website text,
  platform text not null default 'other' check (platform in ('x', 'instagram', 'linkedin', 'other')),
  handle text,
  email text,
  notes text,
  suggested_message text,
  status text not null default 'to_contact' check (status in ('to_contact', 'messaged', 'replied', 'interested', 'not_interested')),
  contacted_by text,
  contacted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table social_prospects enable row level security;
