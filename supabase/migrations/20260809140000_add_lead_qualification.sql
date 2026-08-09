/*
# Add lead qualification fields

Adds two things to public.users, computed at signup and refreshed on
profile updates:

1. lead_tier: the self-reported pricing tier ('Petit'/'Moyen'/'Enterprise'/
   etc., from lib/pricing.ts's tierName()) so the site owner can see at a
   glance what kind of prospect signed up, directly in the Supabase table
   editor — no client-facing UI needed for this.
2. company_verified / company_legal_name / company_siret: best-effort
   enrichment from the free French government company registry
   (recherche-entreprises.api.gouv.fr, no API key required). Never blocks
   signup — a company just not being found isn't treated as suspicious,
   since sole proprietors, very new companies, or non-French businesses
   won't always match.
*/

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS lead_tier text,
  ADD COLUMN IF NOT EXISTS company_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS company_legal_name text,
  ADD COLUMN IF NOT EXISTS company_siret text;
