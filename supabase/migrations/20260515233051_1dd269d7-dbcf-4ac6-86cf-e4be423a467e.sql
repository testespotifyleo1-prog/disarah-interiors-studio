
-- ============== FASE 7.1 — MIGRATION CORRETIVA ==============
-- Adiciona colunas que o frontend consome mas o schema não tem.

-- ===== sales =====
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS delivery_fee numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assembly_fee numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'pdv',
  ADD COLUMN IF NOT EXISTS payment_on_delivery boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS down_payment numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remaining_balance numeric(14,2) NOT NULL DEFAULT 0;

-- ===== payments =====
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS paid_value numeric(14,2),
  ADD COLUMN IF NOT EXISTS card_fee_value numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS card_fee_percent numeric(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS card_type text,
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS notes text;

-- Sincroniza paid_value <-> amount (quem escreve em um popula o outro)
UPDATE public.payments SET paid_value = amount WHERE paid_value IS NULL;

CREATE OR REPLACE FUNCTION public.payments_sync_amount()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.paid_value IS NULL AND NEW.amount IS NOT NULL THEN
    NEW.paid_value := NEW.amount;
  ELSIF NEW.amount IS NULL AND NEW.paid_value IS NOT NULL THEN
    NEW.amount := NEW.paid_value;
  ELSIF TG_OP = 'UPDATE' THEN
    -- se um foi alterado e o outro não, propaga
    IF NEW.paid_value IS DISTINCT FROM OLD.paid_value AND NEW.amount = OLD.amount THEN
      NEW.amount := NEW.paid_value;
    ELSIF NEW.amount IS DISTINCT FROM OLD.amount AND NEW.paid_value = OLD.paid_value THEN
      NEW.paid_value := NEW.amount;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS payments_sync_amount_trg ON public.payments;
CREATE TRIGGER payments_sync_amount_trg
BEFORE INSERT OR UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.payments_sync_amount();

ALTER TABLE public.payments ALTER COLUMN amount DROP NOT NULL;

-- ===== commissions =====
ALTER TABLE public.commissions
  ADD COLUMN IF NOT EXISTS value numeric(14,2),
  ADD COLUMN IF NOT EXISTS status text;

UPDATE public.commissions SET value = amount WHERE value IS NULL;
UPDATE public.commissions SET status = CASE WHEN paid THEN 'paid' ELSE 'pending' END WHERE status IS NULL;

CREATE OR REPLACE FUNCTION public.commissions_sync()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.value IS NULL AND NEW.amount IS NOT NULL THEN NEW.value := NEW.amount;
  ELSIF NEW.amount IS NULL AND NEW.value IS NOT NULL THEN NEW.amount := NEW.value;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.value IS DISTINCT FROM OLD.value AND NEW.amount = OLD.amount THEN NEW.amount := NEW.value;
    ELSIF NEW.amount IS DISTINCT FROM OLD.amount AND NEW.value = OLD.value THEN NEW.value := NEW.amount;
    END IF;
  END IF;

  IF NEW.status IS NULL THEN
    NEW.status := CASE WHEN NEW.paid THEN 'paid' ELSE 'pending' END;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.paid = OLD.paid THEN
      NEW.paid := (NEW.status = 'paid');
      IF NEW.paid AND NEW.paid_at IS NULL THEN NEW.paid_at := now(); END IF;
    ELSIF NEW.paid IS DISTINCT FROM OLD.paid AND NEW.status = OLD.status THEN
      NEW.status := CASE WHEN NEW.paid THEN 'paid' ELSE 'pending' END;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS commissions_sync_trg ON public.commissions;
CREATE TRIGGER commissions_sync_trg
BEFORE INSERT OR UPDATE ON public.commissions
FOR EACH ROW EXECUTE FUNCTION public.commissions_sync();

ALTER TABLE public.commissions ALTER COLUMN amount DROP NOT NULL;

-- ===== commission_tiers =====
ALTER TABLE public.commission_tiers
  ADD COLUMN IF NOT EXISTS seller_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS min_value numeric(14,2),
  ADD COLUMN IF NOT EXISTS max_value numeric(14,2),
  ADD COLUMN IF NOT EXISTS percent numeric(6,2),
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.commission_tiers
  ALTER COLUMN goal_percent_min DROP NOT NULL,
  ALTER COLUMN commission_percent DROP NOT NULL;

-- ===== seller_commission_rules =====
ALTER TABLE public.seller_commission_rules
  ADD COLUMN IF NOT EXISTS percent_default numeric(6,2);

UPDATE public.seller_commission_rules SET percent_default = base_percent WHERE percent_default IS NULL;

CREATE OR REPLACE FUNCTION public.scr_sync()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.percent_default IS NULL AND NEW.base_percent IS NOT NULL THEN NEW.percent_default := NEW.base_percent;
  ELSIF NEW.base_percent IS NULL AND NEW.percent_default IS NOT NULL THEN NEW.base_percent := NEW.percent_default;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.percent_default IS DISTINCT FROM OLD.percent_default AND NEW.base_percent = OLD.base_percent THEN NEW.base_percent := NEW.percent_default;
    ELSIF NEW.base_percent IS DISTINCT FROM OLD.base_percent AND NEW.percent_default = OLD.percent_default THEN NEW.percent_default := NEW.base_percent;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS scr_sync_trg ON public.seller_commission_rules;
CREATE TRIGGER scr_sync_trg
BEFORE INSERT OR UPDATE ON public.seller_commission_rules
FOR EACH ROW EXECUTE FUNCTION public.scr_sync();

ALTER TABLE public.seller_commission_rules ALTER COLUMN base_percent DROP NOT NULL;

-- ===== sales_goals =====
ALTER TABLE public.sales_goals
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'seller';

-- ===== quotes =====
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS delivery_fee numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assembly_fee numeric(14,2) NOT NULL DEFAULT 0;

-- ===== customers =====
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS document text,
  ADD COLUMN IF NOT EXISTS address_json jsonb;

UPDATE public.customers SET document = doc WHERE document IS NULL;

CREATE OR REPLACE FUNCTION public.customers_sync_doc()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.document IS NULL AND NEW.doc IS NOT NULL THEN NEW.document := NEW.doc;
  ELSIF NEW.doc IS NULL AND NEW.document IS NOT NULL THEN NEW.doc := NEW.document;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.document IS DISTINCT FROM OLD.document AND NEW.doc = OLD.doc THEN NEW.doc := NEW.document;
    ELSIF NEW.doc IS DISTINCT FROM OLD.doc AND NEW.document = OLD.document THEN NEW.document := NEW.doc;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS customers_sync_doc_trg ON public.customers;
CREATE TRIGGER customers_sync_doc_trg
BEFORE INSERT OR UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.customers_sync_doc();

-- ===== stores =====
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS address_json jsonb,
  ADD COLUMN IF NOT EXISTS logo_path text,
  ADD COLUMN IF NOT EXISTS logo_updated_at timestamptz;

UPDATE public.stores SET logo_path = logo_url WHERE logo_path IS NULL AND logo_url IS NOT NULL;

CREATE OR REPLACE FUNCTION public.stores_sync_logo()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.logo_path IS NULL AND NEW.logo_url IS NOT NULL THEN NEW.logo_path := NEW.logo_url;
  ELSIF NEW.logo_url IS NULL AND NEW.logo_path IS NOT NULL THEN NEW.logo_url := NEW.logo_path;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.logo_path IS DISTINCT FROM OLD.logo_path AND NEW.logo_url = OLD.logo_url THEN NEW.logo_url := NEW.logo_path;
    ELSIF NEW.logo_url IS DISTINCT FROM OLD.logo_url AND NEW.logo_path = OLD.logo_path THEN NEW.logo_path := NEW.logo_url;
    END IF;
    IF NEW.logo_path IS DISTINCT FROM OLD.logo_path OR NEW.logo_url IS DISTINCT FROM OLD.logo_url THEN
      NEW.logo_updated_at := now();
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS stores_sync_logo_trg ON public.stores;
CREATE TRIGGER stores_sync_logo_trg
BEFORE INSERT OR UPDATE ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.stores_sync_logo();

-- ===== deliveries =====
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS address_json jsonb;

-- ===== Atualiza receive_crediario_installment para usar paid_value =====
CREATE OR REPLACE FUNCTION public.receive_crediario_installment(receivable_id uuid, amount numeric, method public.payment_method DEFAULT 'cash'::payment_method)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r public.accounts_receivable%ROWTYPE;
BEGIN
  IF NOT public.is_account_member(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO r FROM public.accounts_receivable WHERE id = receivable_id;
  UPDATE public.accounts_receivable
     SET paid_amount = paid_amount + amount,
         status = CASE WHEN paid_amount + amount >= public.accounts_receivable.amount THEN 'paid'::public.receivable_status ELSE 'partial'::public.receivable_status END,
         paid_at = CASE WHEN paid_amount + amount >= public.accounts_receivable.amount THEN now() ELSE paid_at END
   WHERE id = receivable_id;
  INSERT INTO public.payments (account_id, receivable_id, method, paid_value)
  VALUES (r.account_id, receivable_id, method, amount);
END $$;
