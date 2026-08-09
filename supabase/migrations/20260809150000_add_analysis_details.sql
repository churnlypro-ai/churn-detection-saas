/*
# Add structured detail to analysis_results

The churn analysis engine now returns, per client: a short summary
reason (kept in the existing `reason` column for backward compatibility
with anything reading it), plus a full breakdown of risk factors (each
grounded in an actual data point from the upload) and multiple ranked,
justified recommended actions. `details` stores that full breakdown as
JSON so the UI can show a short view by default and a deep drill-down
on demand, without ever fabricating data the analysis didn't actually
produce.
*/

ALTER TABLE public.analysis_results
  ADD COLUMN IF NOT EXISTS details jsonb;
