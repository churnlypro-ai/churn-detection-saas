/*
# Fix analysis_results: production had the wrong (legacy) column set

Discovered during the first real end-to-end CSV upload test tonight:
production's public.analysis_results table had id, user_id,
clients_at_risk, detailed_data, created_at, details, renewal_date --
a completely different shape than what the current v2 analysis
engine (lib/analysis.ts, this repo's own base migration
20260728030916_create_churn_detection_schema.sql) inserts and reads.
Every insert was failing with PGRST204 (column not found).

Adds the columns the current code actually needs, additively --
leaves the old clients_at_risk/detailed_data/created_at columns in
place rather than dropping them, since we don't know what (if
anything) still reads them, and nullable extra columns are harmless.
No NOT NULL/CHECK constraints added: this table may already have
legacy rows from the old shape, and backfilling those is out of scope
for this fix.
*/

alter table public.analysis_results
  add column if not exists upload_id uuid references public.csv_uploads(id) on delete set null,
  add column if not exists client_name text,
  add column if not exists revenue_monthly float8 default 0,
  add column if not exists churn_score int,
  add column if not exists reason text,
  add column if not exists solution text,
  add column if not exists confidence float8,
  add column if not exists analyzed_at timestamptz default now();

create index if not exists analysis_results_user_id_idx on public.analysis_results(user_id);
create index if not exists analysis_results_analyzed_at_idx on public.analysis_results(analyzed_at desc);
create index if not exists analysis_results_upload_id_idx on public.analysis_results(upload_id);
