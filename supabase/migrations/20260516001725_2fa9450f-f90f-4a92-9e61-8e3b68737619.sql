
-- ============ STORE TRANSFERS ============
ALTER TABLE public.store_transfers
  ADD COLUMN IF NOT EXISTS from_store_id uuid,
  ADD COLUMN IF NOT EXISTS to_store_id uuid;

UPDATE public.store_transfers SET from_store_id = origin_store_id WHERE from_store_id IS NULL;
UPDATE public.store_transfers SET to_store_id = dest_store_id WHERE to_store_id IS NULL;

CREATE OR REPLACE FUNCTION public.store_transfers_sync()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.from_store_id IS NULL AND NEW.origin_store_id IS NOT NULL THEN NEW.from_store_id := NEW.origin_store_id;
  ELSIF NEW.origin_store_id IS NULL AND NEW.from_store_id IS NOT NULL THEN NEW.origin_store_id := NEW.from_store_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.from_store_id IS DISTINCT FROM OLD.from_store_id AND NEW.origin_store_id = OLD.origin_store_id THEN NEW.origin_store_id := NEW.from_store_id;
    ELSIF NEW.origin_store_id IS DISTINCT FROM OLD.origin_store_id AND NEW.from_store_id = OLD.from_store_id THEN NEW.from_store_id := NEW.origin_store_id;
    END IF;
  END IF;
  IF NEW.to_store_id IS NULL AND NEW.dest_store_id IS NOT NULL THEN NEW.to_store_id := NEW.dest_store_id;
  ELSIF NEW.dest_store_id IS NULL AND NEW.to_store_id IS NOT NULL THEN NEW.dest_store_id := NEW.to_store_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.to_store_id IS DISTINCT FROM OLD.to_store_id AND NEW.dest_store_id = OLD.dest_store_id THEN NEW.dest_store_id := NEW.to_store_id;
    ELSIF NEW.dest_store_id IS DISTINCT FROM OLD.dest_store_id AND NEW.to_store_id = OLD.to_store_id THEN NEW.to_store_id := NEW.dest_store_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_store_transfers_sync ON public.store_transfers;
CREATE TRIGGER trg_store_transfers_sync BEFORE INSERT OR UPDATE ON public.store_transfers
FOR EACH ROW EXECUTE FUNCTION public.store_transfers_sync();

-- ============ STORE CREDITS ============
ALTER TABLE public.store_credits
  ADD COLUMN IF NOT EXISTS customer_name_manual text,
  ADD COLUMN IF NOT EXISTS original_amount numeric,
  ADD COLUMN IF NOT EXISTS remaining_amount numeric,
  ADD COLUMN IF NOT EXISTS used_at timestamptz,
  ADD COLUMN IF NOT EXISTS used_in_sale_id uuid,
  ADD COLUMN IF NOT EXISTS sale_id uuid,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

UPDATE public.store_credits SET original_amount = COALESCE(original_amount, amount);
UPDATE public.store_credits SET remaining_amount = COALESCE(remaining_amount, GREATEST(COALESCE(amount,0) - COALESCE(used_amount,0), 0));
UPDATE public.store_credits SET sale_id = COALESCE(sale_id, origin_sale_id);

CREATE OR REPLACE FUNCTION public.store_credits_sync()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  -- amount <-> original_amount
  IF NEW.original_amount IS NULL AND NEW.amount IS NOT NULL THEN NEW.original_amount := NEW.amount;
  ELSIF NEW.amount IS NULL AND NEW.original_amount IS NOT NULL THEN NEW.amount := NEW.original_amount;
  END IF;
  -- remaining_amount default
  IF NEW.remaining_amount IS NULL THEN NEW.remaining_amount := GREATEST(COALESCE(NEW.original_amount,NEW.amount,0) - COALESCE(NEW.used_amount,0), 0); END IF;
  -- keep used_amount in sync if remaining changes
  IF TG_OP = 'UPDATE' AND NEW.remaining_amount IS DISTINCT FROM OLD.remaining_amount THEN
    NEW.used_amount := GREATEST(COALESCE(NEW.original_amount,NEW.amount,0) - COALESCE(NEW.remaining_amount,0), 0);
  END IF;
  -- sale_id <-> origin_sale_id
  IF NEW.sale_id IS NULL AND NEW.origin_sale_id IS NOT NULL THEN NEW.sale_id := NEW.origin_sale_id;
  ELSIF NEW.origin_sale_id IS NULL AND NEW.sale_id IS NOT NULL THEN NEW.origin_sale_id := NEW.sale_id;
  END IF;
  -- status derivation
  IF NEW.status IS NULL THEN
    NEW.status := CASE WHEN COALESCE(NEW.remaining_amount,0) <= 0 THEN 'used' WHEN NEW.is_active = false THEN 'inactive' ELSE 'active' END;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_store_credits_sync ON public.store_credits;
CREATE TRIGGER trg_store_credits_sync BEFORE INSERT OR UPDATE ON public.store_credits
FOR EACH ROW EXECUTE FUNCTION public.store_credits_sync();

-- ============ HELD SALES ============
ALTER TABLE public.held_sales
  ADD COLUMN IF NOT EXISTS cart_json jsonb;

UPDATE public.held_sales SET cart_json = cart_snapshot WHERE cart_json IS NULL;

CREATE OR REPLACE FUNCTION public.held_sales_sync()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.cart_json IS NULL AND NEW.cart_snapshot IS NOT NULL THEN NEW.cart_json := NEW.cart_snapshot;
  ELSIF NEW.cart_snapshot IS NULL AND NEW.cart_json IS NOT NULL THEN NEW.cart_snapshot := NEW.cart_json;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.cart_json IS DISTINCT FROM OLD.cart_json AND NEW.cart_snapshot = OLD.cart_snapshot THEN NEW.cart_snapshot := NEW.cart_json;
    ELSIF NEW.cart_snapshot IS DISTINCT FROM OLD.cart_snapshot AND NEW.cart_json = OLD.cart_json THEN NEW.cart_json := NEW.cart_snapshot;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_held_sales_sync ON public.held_sales;
CREATE TRIGGER trg_held_sales_sync BEFORE INSERT OR UPDATE ON public.held_sales
FOR EACH ROW EXECUTE FUNCTION public.held_sales_sync();

-- ============ PICKING ITEMS ============
ALTER TABLE public.picking_items
  ADD COLUMN IF NOT EXISTS barcode text,
  ADD COLUMN IF NOT EXISTS sku text;

-- ============ PRODUCTS ============
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cfop_default text,
  ADD COLUMN IF NOT EXISTS barcode text,
  ADD COLUMN IF NOT EXISTS ai_training text;

UPDATE public.products SET cfop_default = cfop WHERE cfop_default IS NULL;
UPDATE public.products SET barcode = gtin WHERE barcode IS NULL;

CREATE OR REPLACE FUNCTION public.products_sync()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.cfop_default IS NULL AND NEW.cfop IS NOT NULL THEN NEW.cfop_default := NEW.cfop;
  ELSIF NEW.cfop IS NULL AND NEW.cfop_default IS NOT NULL THEN NEW.cfop := NEW.cfop_default;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.cfop_default IS DISTINCT FROM OLD.cfop_default AND NEW.cfop = OLD.cfop THEN NEW.cfop := NEW.cfop_default;
    ELSIF NEW.cfop IS DISTINCT FROM OLD.cfop AND NEW.cfop_default = OLD.cfop_default THEN NEW.cfop_default := NEW.cfop;
    END IF;
  END IF;
  IF NEW.barcode IS NULL AND NEW.gtin IS NOT NULL THEN NEW.barcode := NEW.gtin;
  ELSIF NEW.gtin IS NULL AND NEW.barcode IS NOT NULL THEN NEW.gtin := NEW.barcode;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.barcode IS DISTINCT FROM OLD.barcode AND NEW.gtin = OLD.gtin THEN NEW.gtin := NEW.barcode;
    ELSIF NEW.gtin IS DISTINCT FROM OLD.gtin AND NEW.barcode = OLD.barcode THEN NEW.barcode := NEW.gtin;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_products_sync ON public.products;
CREATE TRIGGER trg_products_sync BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.products_sync();

-- ============ SALE ITEMS ============
ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS presentation_id uuid,
  ADD COLUMN IF NOT EXISTS presentation_name text,
  ADD COLUMN IF NOT EXISTS sold_qty numeric,
  ADD COLUMN IF NOT EXISTS base_qty numeric;

-- ============ MP PAYMENTS ============
ALTER TABLE public.mp_payments
  ADD COLUMN IF NOT EXISTS provider text;

UPDATE public.mp_payments SET provider = type WHERE provider IS NULL;

CREATE OR REPLACE FUNCTION public.mp_payments_sync()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.provider IS NULL AND NEW.type IS NOT NULL THEN NEW.provider := NEW.type;
  ELSIF NEW.type IS NULL AND NEW.provider IS NOT NULL THEN NEW.type := NEW.provider;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.provider IS DISTINCT FROM OLD.provider AND NEW.type = OLD.type THEN NEW.type := NEW.provider;
    ELSIF NEW.type IS DISTINCT FROM OLD.type AND NEW.provider = OLD.provider THEN NEW.provider := NEW.type;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_mp_payments_sync ON public.mp_payments;
CREATE TRIGGER trg_mp_payments_sync BEFORE INSERT OR UPDATE ON public.mp_payments
FOR EACH ROW EXECUTE FUNCTION public.mp_payments_sync();
