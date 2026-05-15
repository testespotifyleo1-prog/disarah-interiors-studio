ALTER TABLE public.fiscal_documents
ADD COLUMN IF NOT EXISTS nfe_number text;

CREATE INDEX IF NOT EXISTS idx_fiscal_documents_store_purpose_status_created_at
ON public.fiscal_documents (store_id, purpose, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fiscal_documents_access_key
ON public.fiscal_documents (access_key);

CREATE INDEX IF NOT EXISTS idx_fiscal_documents_nfe_number
ON public.fiscal_documents (nfe_number);

CREATE INDEX IF NOT EXISTS idx_fiscal_documents_provider_id
ON public.fiscal_documents (provider_id);