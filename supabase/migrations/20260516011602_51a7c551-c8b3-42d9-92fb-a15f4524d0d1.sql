ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS pdv_auto_print_receipt boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pdv_auto_print_fiscal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pdv_receipt_format text NOT NULL DEFAULT 'thermal';