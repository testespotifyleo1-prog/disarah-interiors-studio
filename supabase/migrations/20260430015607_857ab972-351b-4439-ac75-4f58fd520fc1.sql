-- Add business_type column with safe default
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS business_type text NOT NULL DEFAULT 'furniture';

-- Constrain to known values (extensible later)
ALTER TABLE public.accounts
  DROP CONSTRAINT IF EXISTS accounts_business_type_check;
ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_business_type_check
  CHECK (business_type IN ('furniture', 'party', 'general'));

-- Mark known party-store accounts (Ponto da Festa, TOP FESTAS) as 'party'
UPDATE public.accounts
SET business_type = 'party'
WHERE id IN (
  '2480b8ae-c3a4-4a39-ad76-e6b41013f25e',
  '794d95b6-15e2-4ada-8aea-32998477f235'
);