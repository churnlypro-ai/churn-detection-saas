/*
# Allow 'manager' as an industry value

The signup wizard now offers a fifth industry option ('manager') with its
own pricing path (priced by headcount managed, no free trial). The CHECK
constraint on users.industry only allows 'saas', 'agency', 'ecommerce',
'other' — so saving a profile with industry set to 'manager' would violate
the constraint and fail, exactly like the 'ecommerce' issue fixed in
20260806120000_fix_industry_check_constraint.sql.
*/

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_industry_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_industry_check
  CHECK (industry IS NULL OR industry IN ('saas', 'agency', 'ecommerce', 'manager', 'other'));
