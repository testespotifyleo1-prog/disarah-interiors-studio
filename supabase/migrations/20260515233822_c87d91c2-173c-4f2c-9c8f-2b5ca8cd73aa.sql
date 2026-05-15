
-- deliveries
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS delivery_type text NOT NULL DEFAULT 'delivery',
  ADD COLUMN IF NOT EXISTS eta_at timestamptz;

-- accounts_receivable.category
ALTER TABLE public.accounts_receivable
  ADD COLUMN IF NOT EXISTS category text;

-- cash_registers extras
ALTER TABLE public.cash_registers
  ADD COLUMN IF NOT EXISTS closed_by uuid,
  ADD COLUMN IF NOT EXISTS total_sales numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_cash numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_card numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_pix numeric(14,2) DEFAULT 0;

-- fiscal_entry_items.quantity alias <-> qty
ALTER TABLE public.fiscal_entry_items
  ADD COLUMN IF NOT EXISTS quantity numeric(14,4);
UPDATE public.fiscal_entry_items SET quantity = qty WHERE quantity IS NULL;

CREATE OR REPLACE FUNCTION public.fei_sync()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.quantity IS NULL AND NEW.qty IS NOT NULL THEN NEW.quantity := NEW.qty;
  ELSIF NEW.qty IS NULL AND NEW.quantity IS NOT NULL THEN NEW.qty := NEW.quantity;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.quantity IS DISTINCT FROM OLD.quantity AND NEW.qty = OLD.qty THEN NEW.qty := NEW.quantity;
    ELSIF NEW.qty IS DISTINCT FROM OLD.qty AND NEW.quantity = OLD.quantity THEN NEW.quantity := NEW.qty;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS fei_sync_trg ON public.fiscal_entry_items;
CREATE TRIGGER fei_sync_trg BEFORE INSERT OR UPDATE ON public.fiscal_entry_items
  FOR EACH ROW EXECUTE FUNCTION public.fei_sync();

ALTER TABLE public.fiscal_entry_items ALTER COLUMN qty DROP NOT NULL;

-- credit_override_requests extras
ALTER TABLE public.credit_override_requests
  ADD COLUMN IF NOT EXISTS sale_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS excess_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS current_limit numeric(14,2),
  ADD COLUMN IF NOT EXISTS used_balance numeric(14,2),
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';

-- payment_method enum: add 'card' and 'financeira'
DO $$ BEGIN
  ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'card';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'financeira';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- get_public_tracking: rename param to _token
DROP FUNCTION IF EXISTS public.get_public_tracking(text);
CREATE OR REPLACE FUNCTION public.get_public_tracking(_token text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT to_jsonb(d) - 'account_id' - 'created_by' FROM public.deliveries d WHERE tracking_token = _token
$$;
