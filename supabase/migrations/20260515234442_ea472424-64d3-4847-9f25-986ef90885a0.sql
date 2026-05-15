
-- 1) deliveries: scheduled_date / scheduled_time synced with scheduled_at
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS scheduled_date date,
  ADD COLUMN IF NOT EXISTS scheduled_time time;
CREATE OR REPLACE FUNCTION public.deliveries_sync_schedule() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.scheduled_at IS NULL AND (NEW.scheduled_date IS NOT NULL OR NEW.scheduled_time IS NOT NULL) THEN
    NEW.scheduled_at := ((COALESCE(NEW.scheduled_date, CURRENT_DATE)::text)||' '||COALESCE(NEW.scheduled_time,'12:00'::time)::text)::timestamptz;
  END IF;
  IF NEW.scheduled_at IS NOT NULL THEN
    IF NEW.scheduled_date IS NULL THEN NEW.scheduled_date := NEW.scheduled_at::date; END IF;
    IF NEW.scheduled_time IS NULL THEN NEW.scheduled_time := NEW.scheduled_at::time; END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_deliveries_sync_schedule ON public.deliveries;
CREATE TRIGGER trg_deliveries_sync_schedule BEFORE INSERT OR UPDATE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.deliveries_sync_schedule();

-- 2) fiscal_entries: aliases
ALTER TABLE public.fiscal_entries
  ADD COLUMN IF NOT EXISTS nfe_number numeric,
  ADD COLUMN IF NOT EXISTS nfe_series numeric,
  ADD COLUMN IF NOT EXISTS issue_date timestamptz,
  ADD COLUMN IF NOT EXISTS total_products numeric,
  ADD COLUMN IF NOT EXISTS total_freight numeric,
  ADD COLUMN IF NOT EXISTS total_discount numeric,
  ADD COLUMN IF NOT EXISTS total_nfe numeric,
  ADD COLUMN IF NOT EXISTS xml_path text,
  ADD COLUMN IF NOT EXISTS pdf_path text,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE OR REPLACE FUNCTION public.fe_sync() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.nfe_number IS NULL AND NEW.number IS NOT NULL THEN NEW.nfe_number := NEW.number;
  ELSIF NEW.number IS NULL AND NEW.nfe_number IS NOT NULL THEN NEW.number := NEW.nfe_number; END IF;
  IF NEW.nfe_series IS NULL AND NEW.series IS NOT NULL THEN NEW.nfe_series := NEW.series;
  ELSIF NEW.series IS NULL AND NEW.nfe_series IS NOT NULL THEN NEW.series := NEW.nfe_series; END IF;
  IF NEW.issue_date IS NULL AND NEW.issued_at IS NOT NULL THEN NEW.issue_date := NEW.issued_at;
  ELSIF NEW.issued_at IS NULL AND NEW.issue_date IS NOT NULL THEN NEW.issued_at := NEW.issue_date; END IF;
  IF NEW.total_nfe IS NULL AND NEW.total_amount IS NOT NULL THEN NEW.total_nfe := NEW.total_amount;
  ELSIF NEW.total_amount IS NULL AND NEW.total_nfe IS NOT NULL THEN NEW.total_amount := NEW.total_nfe; END IF;
  IF NEW.xml_path IS NULL AND NEW.xml_url IS NOT NULL THEN NEW.xml_path := NEW.xml_url;
  ELSIF NEW.xml_url IS NULL AND NEW.xml_path IS NOT NULL THEN NEW.xml_url := NEW.xml_path; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_fe_sync ON public.fiscal_entries;
CREATE TRIGGER trg_fe_sync BEFORE INSERT OR UPDATE ON public.fiscal_entries
  FOR EACH ROW EXECUTE FUNCTION public.fe_sync();

-- 3) fiscal_entry_items: extras
ALTER TABLE public.fiscal_entry_items
  ADD COLUMN IF NOT EXISTS xml_code text,
  ADD COLUMN IF NOT EXISTS unit_price numeric,
  ADD COLUMN IF NOT EXISTS matched boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_product boolean DEFAULT false;

-- 4) purchase_orders: type/subtotal/expected_delivery_date
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS type text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS subtotal numeric,
  ADD COLUMN IF NOT EXISTS expected_delivery_date date;
CREATE OR REPLACE FUNCTION public.po_sync() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.expected_delivery_date IS NULL AND NEW.expected_at IS NOT NULL THEN NEW.expected_delivery_date := NEW.expected_at::date;
  ELSIF NEW.expected_at IS NULL AND NEW.expected_delivery_date IS NOT NULL THEN NEW.expected_at := NEW.expected_delivery_date::timestamptz; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_po_sync ON public.purchase_orders;
CREATE TRIGGER trg_po_sync BEFORE INSERT OR UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.po_sync();

-- 5) purchase_order_items: qty_ordered alias + notes
ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS qty_ordered numeric,
  ADD COLUMN IF NOT EXISTS notes text;
CREATE OR REPLACE FUNCTION public.poi_sync_qty() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.qty_ordered IS NULL AND NEW.qty IS NOT NULL THEN NEW.qty_ordered := NEW.qty;
  ELSIF NEW.qty IS NULL AND NEW.qty_ordered IS NOT NULL THEN NEW.qty := NEW.qty_ordered; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_poi_sync_qty ON public.purchase_order_items;
CREATE TRIGGER trg_poi_sync_qty BEFORE INSERT OR UPDATE ON public.purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION public.poi_sync_qty();

-- 6) purchase_order_status: requested
ALTER TYPE public.purchase_order_status ADD VALUE IF NOT EXISTS 'requested';

-- 7) generate_next_sku: optional _account_id arg
CREATE OR REPLACE FUNCTION public.generate_next_sku(_account_id uuid DEFAULT NULL, prefix text DEFAULT 'SKU')
  RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(sku, '\D','','g'),'')::int),0)+1 INTO n
  FROM public.products WHERE account_id = COALESCE(_account_id, public.current_account_id());
  RETURN prefix || lpad(n::text, 6, '0');
END $$;
