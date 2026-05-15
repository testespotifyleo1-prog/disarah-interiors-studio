-- Make customer_id nullable on store_credits
ALTER TABLE public.store_credits ALTER COLUMN customer_id DROP NOT NULL;

-- Add manual customer name field for unlinked credits
ALTER TABLE public.store_credits ADD COLUMN IF NOT EXISTS customer_name_manual text;