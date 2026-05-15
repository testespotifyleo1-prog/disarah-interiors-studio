
-- ============ products ============
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cost_default numeric(14,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_url text;

-- ============ customers ============
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS credit_authorized boolean NOT NULL DEFAULT false;

-- ============ sale_items ============
ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS total_line numeric(14,2),
  ADD COLUMN IF NOT EXISTS unit_cost numeric(14,4);

-- Backfill
UPDATE public.sale_items SET total_line = total WHERE total_line IS NULL;
UPDATE public.sale_items SET unit_cost = cost_at_sale WHERE unit_cost IS NULL;

CREATE OR REPLACE FUNCTION public.sale_items_sync()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  -- total_line <-> total
  IF NEW.total_line IS NULL AND NEW.total IS NOT NULL THEN NEW.total_line := NEW.total;
  ELSIF NEW.total IS NULL AND NEW.total_line IS NOT NULL THEN NEW.total := NEW.total_line;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.total_line IS DISTINCT FROM OLD.total_line AND NEW.total = OLD.total THEN NEW.total := NEW.total_line;
    ELSIF NEW.total IS DISTINCT FROM OLD.total AND NEW.total_line = OLD.total_line THEN NEW.total_line := NEW.total;
    END IF;
  END IF;
  -- unit_cost <-> cost_at_sale
  IF NEW.unit_cost IS NULL AND NEW.cost_at_sale IS NOT NULL THEN NEW.unit_cost := NEW.cost_at_sale;
  ELSIF NEW.cost_at_sale IS NULL AND NEW.unit_cost IS NOT NULL THEN NEW.cost_at_sale := NEW.unit_cost;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.unit_cost IS DISTINCT FROM OLD.unit_cost AND NEW.cost_at_sale = OLD.cost_at_sale THEN NEW.cost_at_sale := NEW.unit_cost;
    ELSIF NEW.cost_at_sale IS DISTINCT FROM OLD.cost_at_sale AND NEW.unit_cost = OLD.unit_cost THEN NEW.unit_cost := NEW.cost_at_sale;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS sale_items_sync_trg ON public.sale_items;
CREATE TRIGGER sale_items_sync_trg BEFORE INSERT OR UPDATE ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.sale_items_sync();

-- ============ purchase_order_items ============
ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS total_line numeric(14,2);

UPDATE public.purchase_order_items SET total_line = total WHERE total_line IS NULL;

CREATE OR REPLACE FUNCTION public.poi_sync()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.total_line IS NULL AND NEW.total IS NOT NULL THEN NEW.total_line := NEW.total;
  ELSIF NEW.total IS NULL AND NEW.total_line IS NOT NULL THEN NEW.total := NEW.total_line;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.total_line IS DISTINCT FROM OLD.total_line AND NEW.total = OLD.total THEN NEW.total := NEW.total_line;
    ELSIF NEW.total IS DISTINCT FROM OLD.total AND NEW.total_line = OLD.total_line THEN NEW.total_line := NEW.total;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS poi_sync_trg ON public.purchase_order_items;
CREATE TRIGGER poi_sync_trg BEFORE INSERT OR UPDATE ON public.purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION public.poi_sync();

-- ============ quote_items ============
ALTER TABLE public.quote_items
  ADD COLUMN IF NOT EXISTS total_line numeric(14,2);

UPDATE public.quote_items SET total_line = total WHERE total_line IS NULL;

CREATE OR REPLACE FUNCTION public.qi_sync()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.total_line IS NULL AND NEW.total IS NOT NULL THEN NEW.total_line := NEW.total;
  ELSIF NEW.total IS NULL AND NEW.total_line IS NOT NULL THEN NEW.total := NEW.total_line;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.total_line IS DISTINCT FROM OLD.total_line AND NEW.total = OLD.total THEN NEW.total := NEW.total_line;
    ELSIF NEW.total IS DISTINCT FROM OLD.total AND NEW.total_line = OLD.total_line THEN NEW.total_line := NEW.total;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS qi_sync_trg ON public.quote_items;
CREATE TRIGGER qi_sync_trg BEFORE INSERT OR UPDATE ON public.quote_items
  FOR EACH ROW EXECUTE FUNCTION public.qi_sync();

-- ============ focus_nfe_settings ============
ALTER TABLE public.focus_nfe_settings
  ADD COLUMN IF NOT EXISTS block_sale_without_fiscal_data boolean NOT NULL DEFAULT false;
