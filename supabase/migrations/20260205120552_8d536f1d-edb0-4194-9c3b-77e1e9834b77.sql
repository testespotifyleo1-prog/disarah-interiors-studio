-- Add company_id column to nfeio_settings for NFe.io integration
ALTER TABLE public.nfeio_settings
ADD COLUMN company_id TEXT;