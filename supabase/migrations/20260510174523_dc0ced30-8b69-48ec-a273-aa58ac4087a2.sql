ALTER TYPE fiscal_doc_type ADD VALUE IF NOT EXISTS 'nfse';
ALTER TYPE fiscal_doc_type ADD VALUE IF NOT EXISTS 'nfe_complementar';

ALTER TABLE public.nfeio_settings
  ADD COLUMN IF NOT EXISTS block_sale_without_fiscal_data boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nfse_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nfse_service_code text,
  ADD COLUMN IF NOT EXISTS nfse_cnae text,
  ADD COLUMN IF NOT EXISTS nfse_aliquota numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nfse_item_description text,
  ADD COLUMN IF NOT EXISTS nfse_iss_retido boolean NOT NULL DEFAULT false;