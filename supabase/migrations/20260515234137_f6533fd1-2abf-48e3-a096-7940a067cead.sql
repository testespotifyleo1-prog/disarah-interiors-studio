
-- Phase 7.7: residual columns to match frontend

-- 1) fiscal_documents.purpose (normal | return)
ALTER TABLE public.fiscal_documents ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'normal';
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_purpose ON public.fiscal_documents(purpose);

-- 2) customer_returns.requested_at synced with created_at
ALTER TABLE public.customer_returns ADD COLUMN IF NOT EXISTS requested_at timestamptz;
UPDATE public.customer_returns SET requested_at = created_at WHERE requested_at IS NULL;
CREATE OR REPLACE FUNCTION public.cr_returns_sync_requested_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.requested_at IS NULL THEN NEW.requested_at := COALESCE(NEW.created_at, now()); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_cr_returns_sync_requested_at ON public.customer_returns;
CREATE TRIGGER trg_cr_returns_sync_requested_at BEFORE INSERT OR UPDATE ON public.customer_returns
  FOR EACH ROW EXECUTE FUNCTION public.cr_returns_sync_requested_at();

-- 3) cancel columns on purchase_orders, store_transfers, fiscal_entries
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz,
  ADD COLUMN IF NOT EXISTS canceled_by uuid,
  ADD COLUMN IF NOT EXISTS cancel_reason text;

ALTER TABLE public.store_transfers
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz,
  ADD COLUMN IF NOT EXISTS canceled_by uuid,
  ADD COLUMN IF NOT EXISTS cancel_reason text;

ALTER TABLE public.fiscal_entries
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz,
  ADD COLUMN IF NOT EXISTS canceled_by uuid,
  ADD COLUMN IF NOT EXISTS cancel_reason text;

-- 4) sales.canceled_at / cancel_reason sync with cancelled_at / cancelled_reason
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text;

CREATE OR REPLACE FUNCTION public.sales_sync_cancel() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.canceled_at IS NULL AND NEW.cancelled_at IS NOT NULL THEN NEW.canceled_at := NEW.cancelled_at;
  ELSIF NEW.cancelled_at IS NULL AND NEW.canceled_at IS NOT NULL THEN NEW.cancelled_at := NEW.canceled_at;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.canceled_at IS DISTINCT FROM OLD.canceled_at AND NEW.cancelled_at = OLD.cancelled_at THEN NEW.cancelled_at := NEW.canceled_at;
    ELSIF NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at AND NEW.canceled_at = OLD.canceled_at THEN NEW.canceled_at := NEW.cancelled_at;
    END IF;
  END IF;
  IF NEW.cancel_reason IS NULL AND NEW.cancelled_reason IS NOT NULL THEN NEW.cancel_reason := NEW.cancelled_reason;
  ELSIF NEW.cancelled_reason IS NULL AND NEW.cancel_reason IS NOT NULL THEN NEW.cancelled_reason := NEW.cancel_reason;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.cancel_reason IS DISTINCT FROM OLD.cancel_reason AND NEW.cancelled_reason = OLD.cancelled_reason THEN NEW.cancelled_reason := NEW.cancel_reason;
    ELSIF NEW.cancelled_reason IS DISTINCT FROM OLD.cancelled_reason AND NEW.cancel_reason = OLD.cancel_reason THEN NEW.cancel_reason := NEW.cancelled_reason;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_sales_sync_cancel ON public.sales;
CREATE TRIGGER trg_sales_sync_cancel BEFORE INSERT OR UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.sales_sync_cancel();
UPDATE public.sales SET canceled_at = cancelled_at, cancel_reason = cancelled_reason WHERE cancelled_at IS NOT NULL OR cancelled_reason IS NOT NULL;
