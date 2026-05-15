
-- product_expiration_dates extras
ALTER TABLE public.product_expiration_dates
  ADD COLUMN IF NOT EXISTS quantity numeric,
  ADD COLUMN IF NOT EXISTS fiscal_entry_id uuid,
  ADD COLUMN IF NOT EXISTS batch_label text;
CREATE OR REPLACE FUNCTION public.ped_sync() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.expiration_date IS NULL AND NEW.expires_at IS NOT NULL THEN NEW.expiration_date := NEW.expires_at;
  ELSIF NEW.expires_at IS NULL AND NEW.expiration_date IS NOT NULL THEN NEW.expires_at := NEW.expiration_date; END IF;
  IF NEW.qty_on_hand IS NULL AND NEW.qty IS NOT NULL THEN NEW.qty_on_hand := NEW.qty;
  ELSIF NEW.qty IS NULL AND NEW.qty_on_hand IS NOT NULL THEN NEW.qty := NEW.qty_on_hand; END IF;
  IF NEW.quantity IS NULL AND NEW.qty IS NOT NULL THEN NEW.quantity := NEW.qty;
  ELSIF NEW.qty IS NULL AND NEW.quantity IS NOT NULL THEN NEW.qty := NEW.quantity; NEW.qty_on_hand := NEW.quantity; END IF;
  RETURN NEW;
END $$;

-- fiscal_entries: nfe_number / nfe_series as text
ALTER TABLE public.fiscal_entries
  ALTER COLUMN nfe_number TYPE text USING nfe_number::text,
  ALTER COLUMN nfe_series TYPE text USING nfe_series::text;

-- purchase_order_items: nullable qty/total + total_line sync
ALTER TABLE public.purchase_order_items
  ALTER COLUMN qty DROP NOT NULL,
  ALTER COLUMN total DROP NOT NULL;
CREATE OR REPLACE FUNCTION public.poi_sync() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.qty_ordered IS NULL AND NEW.qty IS NOT NULL THEN NEW.qty_ordered := NEW.qty;
  ELSIF NEW.qty IS NULL AND NEW.qty_ordered IS NOT NULL THEN NEW.qty := NEW.qty_ordered; END IF;
  IF NEW.total_line IS NULL AND NEW.total IS NOT NULL THEN NEW.total_line := NEW.total;
  ELSIF NEW.total IS NULL AND NEW.total_line IS NOT NULL THEN NEW.total := NEW.total_line; END IF;
  IF NEW.total IS NULL AND NEW.qty IS NOT NULL AND NEW.unit_cost IS NOT NULL THEN
    NEW.total := NEW.qty * NEW.unit_cost;
    NEW.total_line := NEW.total;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_poi_sync ON public.purchase_order_items;
CREATE TRIGGER trg_poi_sync BEFORE INSERT OR UPDATE ON public.purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION public.poi_sync();

-- fiscal_entry_items: total_line trigger
CREATE OR REPLACE FUNCTION public.fei_total_sync() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.total_line IS NULL AND NEW.total IS NOT NULL THEN NEW.total_line := NEW.total;
  ELSIF NEW.total IS NULL AND NEW.total_line IS NOT NULL THEN NEW.total := NEW.total_line; END IF;
  RETURN NEW;
END $$;
ALTER TABLE public.fiscal_entry_items ADD COLUMN IF NOT EXISTS total_line numeric;
DROP TRIGGER IF EXISTS trg_fei_total_sync ON public.fiscal_entry_items;
CREATE TRIGGER trg_fei_total_sync BEFORE INSERT OR UPDATE ON public.fiscal_entry_items
  FOR EACH ROW EXECUTE FUNCTION public.fei_total_sync();

-- quote_items: allow total NULL, sync total_line
ALTER TABLE public.quote_items ALTER COLUMN total DROP NOT NULL;
CREATE OR REPLACE FUNCTION public.qi_sync() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.total_line IS NULL AND NEW.total IS NOT NULL THEN NEW.total_line := NEW.total;
  ELSIF NEW.total IS NULL AND NEW.total_line IS NOT NULL THEN NEW.total := NEW.total_line; END IF;
  IF NEW.total IS NULL AND NEW.qty IS NOT NULL AND NEW.unit_price IS NOT NULL THEN
    NEW.total := NEW.qty * NEW.unit_price - COALESCE(NEW.discount,0);
    NEW.total_line := NEW.total;
  END IF;
  RETURN NEW;
END $$;

-- quote_status: add draft/sent
ALTER TYPE public.quote_status ADD VALUE IF NOT EXISTS 'draft';
ALTER TYPE public.quote_status ADD VALUE IF NOT EXISTS 'sent';
