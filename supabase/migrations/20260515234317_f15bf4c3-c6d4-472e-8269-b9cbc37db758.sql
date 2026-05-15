
-- 1) assemblers / drivers: optional store_id
ALTER TABLE public.assemblers ADD COLUMN IF NOT EXISTS store_id uuid;
ALTER TABLE public.drivers    ADD COLUMN IF NOT EXISTS store_id uuid;

-- 2) suppliers: cnpj/trade_name/address_json kept in sync with doc/legal_name
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS trade_name text,
  ADD COLUMN IF NOT EXISTS address_json jsonb;
UPDATE public.suppliers SET cnpj = doc WHERE cnpj IS NULL AND doc IS NOT NULL;
UPDATE public.suppliers SET trade_name = legal_name WHERE trade_name IS NULL AND legal_name IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_account_cnpj_unique ON public.suppliers(account_id, cnpj) WHERE cnpj IS NOT NULL;
CREATE OR REPLACE FUNCTION public.suppliers_sync() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.cnpj IS NULL AND NEW.doc IS NOT NULL THEN NEW.cnpj := NEW.doc;
  ELSIF NEW.doc IS NULL AND NEW.cnpj IS NOT NULL THEN NEW.doc := NEW.cnpj;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.cnpj IS DISTINCT FROM OLD.cnpj AND NEW.doc = OLD.doc THEN NEW.doc := NEW.cnpj;
    ELSIF NEW.doc IS DISTINCT FROM OLD.doc AND NEW.cnpj = OLD.cnpj THEN NEW.cnpj := NEW.doc;
    END IF;
  END IF;
  IF NEW.trade_name IS NULL AND NEW.legal_name IS NOT NULL THEN NEW.trade_name := NEW.legal_name;
  ELSIF NEW.legal_name IS NULL AND NEW.trade_name IS NOT NULL THEN NEW.legal_name := NEW.trade_name;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_suppliers_sync ON public.suppliers;
CREATE TRIGGER trg_suppliers_sync BEFORE INSERT OR UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.suppliers_sync();

-- 3) inventory: min_qty + expiration_date
ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS min_qty numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expiration_date date;

-- 4) fiscal_xml_backups.backed_up_at
ALTER TABLE public.fiscal_xml_backups ADD COLUMN IF NOT EXISTS backed_up_at timestamptz;
UPDATE public.fiscal_xml_backups SET backed_up_at = created_at WHERE backed_up_at IS NULL;
CREATE OR REPLACE FUNCTION public.fxb_sync() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.backed_up_at IS NULL THEN NEW.backed_up_at := COALESCE(NEW.created_at, now()); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_fxb_sync ON public.fiscal_xml_backups;
CREATE TRIGGER trg_fxb_sync BEFORE INSERT OR UPDATE ON public.fiscal_xml_backups
  FOR EACH ROW EXECUTE FUNCTION public.fxb_sync();

-- 5) nfe_destination_manifest.status
ALTER TABLE public.nfe_destination_manifest ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
CREATE INDEX IF NOT EXISTS idx_nfe_dest_manifest_status ON public.nfe_destination_manifest(status);

-- 6) focus_nfe_settings placeholder api_key (real key lives in vault)
ALTER TABLE public.focus_nfe_settings ADD COLUMN IF NOT EXISTS api_key text DEFAULT '';

-- 7) assembly_status: add 'completed'
ALTER TYPE public.assembly_status ADD VALUE IF NOT EXISTS 'completed';
