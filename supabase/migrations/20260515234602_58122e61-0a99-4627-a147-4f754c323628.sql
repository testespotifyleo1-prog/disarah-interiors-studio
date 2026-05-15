
ALTER TABLE public.fiscal_entry_items ALTER COLUMN total DROP NOT NULL, ALTER COLUMN unit_cost DROP NOT NULL;

ALTER TABLE public.store_transfer_items
  ADD COLUMN IF NOT EXISTS transfer_id uuid,
  ADD COLUMN IF NOT EXISTS qty_requested numeric;
CREATE OR REPLACE FUNCTION public.sti_sync() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.store_transfer_id IS NULL AND NEW.transfer_id IS NOT NULL THEN NEW.store_transfer_id := NEW.transfer_id;
  ELSIF NEW.transfer_id IS NULL AND NEW.store_transfer_id IS NOT NULL THEN NEW.transfer_id := NEW.store_transfer_id; END IF;
  IF NEW.qty IS NULL AND NEW.qty_requested IS NOT NULL THEN NEW.qty := NEW.qty_requested;
  ELSIF NEW.qty_requested IS NULL AND NEW.qty IS NOT NULL THEN NEW.qty_requested := NEW.qty; END IF;
  RETURN NEW;
END $$;
ALTER TABLE public.store_transfer_items ALTER COLUMN store_transfer_id DROP NOT NULL, ALTER COLUMN qty DROP NOT NULL;
DROP TRIGGER IF EXISTS trg_sti_sync ON public.store_transfer_items;
CREATE TRIGGER trg_sti_sync BEFORE INSERT OR UPDATE ON public.store_transfer_items
  FOR EACH ROW EXECUTE FUNCTION public.sti_sync();

ALTER TABLE public.store_memberships ADD COLUMN IF NOT EXISTS manager_pin text;
