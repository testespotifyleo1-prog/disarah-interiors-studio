
ALTER TABLE public.store_ecommerce_settings
  ADD COLUMN IF NOT EXISTS footer_cnpj text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS footer_address text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS footer_phone text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS footer_email text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS policy_privacy text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS policy_terms text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS policy_purchase text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS policy_exchange text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS policy_shipping text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS about_us text DEFAULT NULL;
