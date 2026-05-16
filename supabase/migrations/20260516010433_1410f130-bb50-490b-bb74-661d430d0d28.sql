ALTER TABLE public.focus_nfe_settings
  ADD COLUMN IF NOT EXISTS nfse_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nfse_service_code text,
  ADD COLUMN IF NOT EXISTS nfse_cnae text,
  ADD COLUMN IF NOT EXISTS nfse_aliquota numeric(6,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nfse_item_description text,
  ADD COLUMN IF NOT EXISTS nfse_iss_retido boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nfse_next_number integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS nfse_series integer DEFAULT 1;