
-- 1) sale_items.total nullable + auto-fill via trigger (já existe sync; remover NOT NULL)
ALTER TABLE public.sale_items ALTER COLUMN total DROP NOT NULL;

-- 2) customers.birth_date <-> birthday
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS birth_date date;
UPDATE public.customers SET birth_date = birthday WHERE birth_date IS NULL;

CREATE OR REPLACE FUNCTION public.customers_sync_birthday()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.birth_date IS NULL AND NEW.birthday IS NOT NULL THEN NEW.birth_date := NEW.birthday;
  ELSIF NEW.birthday IS NULL AND NEW.birth_date IS NOT NULL THEN NEW.birthday := NEW.birth_date;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.birth_date IS DISTINCT FROM OLD.birth_date AND NEW.birthday = OLD.birthday THEN NEW.birthday := NEW.birth_date;
    ELSIF NEW.birthday IS DISTINCT FROM OLD.birthday AND NEW.birth_date = OLD.birth_date THEN NEW.birth_date := NEW.birthday;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS customers_sync_birthday_trg ON public.customers;
CREATE TRIGGER customers_sync_birthday_trg BEFORE INSERT OR UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.customers_sync_birthday();

-- 3) accounts_receivable: description (alias of notes), installment_number (alias of installment_no), store_id
ALTER TABLE public.accounts_receivable
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS installment_number int,
  ADD COLUMN IF NOT EXISTS store_id uuid;

UPDATE public.accounts_receivable SET description = notes WHERE description IS NULL;
UPDATE public.accounts_receivable SET installment_number = installment_no WHERE installment_number IS NULL;
UPDATE public.accounts_receivable SET store_id = public.current_store_id() WHERE store_id IS NULL;
ALTER TABLE public.accounts_receivable ALTER COLUMN store_id SET DEFAULT public.current_store_id();

CREATE OR REPLACE FUNCTION public.ar_sync()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.description IS NULL AND NEW.notes IS NOT NULL THEN NEW.description := NEW.notes;
  ELSIF NEW.notes IS NULL AND NEW.description IS NOT NULL THEN NEW.notes := NEW.description;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.description IS DISTINCT FROM OLD.description AND NEW.notes = OLD.notes THEN NEW.notes := NEW.description;
    ELSIF NEW.notes IS DISTINCT FROM OLD.notes AND NEW.description = OLD.description THEN NEW.description := NEW.notes;
    END IF;
  END IF;
  IF NEW.installment_number IS NULL AND NEW.installment_no IS NOT NULL THEN NEW.installment_number := NEW.installment_no;
  ELSIF NEW.installment_no IS NULL AND NEW.installment_number IS NOT NULL THEN NEW.installment_no := NEW.installment_number;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.installment_number IS DISTINCT FROM OLD.installment_number AND NEW.installment_no = OLD.installment_no THEN NEW.installment_no := NEW.installment_number;
    ELSIF NEW.installment_no IS DISTINCT FROM OLD.installment_no AND NEW.installment_number = OLD.installment_number THEN NEW.installment_number := NEW.installment_no;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ar_sync_trg ON public.accounts_receivable;
CREATE TRIGGER ar_sync_trg BEFORE INSERT OR UPDATE ON public.accounts_receivable
  FOR EACH ROW EXECUTE FUNCTION public.ar_sync();

-- 4) cash_registers.opened_by (alias of operator_id)
ALTER TABLE public.cash_registers ADD COLUMN IF NOT EXISTS opened_by uuid;
UPDATE public.cash_registers SET opened_by = operator_id WHERE opened_by IS NULL;

CREATE OR REPLACE FUNCTION public.cr_sync()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.opened_by IS NULL AND NEW.operator_id IS NOT NULL THEN NEW.opened_by := NEW.operator_id;
  ELSIF NEW.operator_id IS NULL AND NEW.opened_by IS NOT NULL THEN NEW.operator_id := NEW.opened_by;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.opened_by IS DISTINCT FROM OLD.opened_by AND NEW.operator_id = OLD.operator_id THEN NEW.operator_id := NEW.opened_by;
    ELSIF NEW.operator_id IS DISTINCT FROM OLD.operator_id AND NEW.opened_by = OLD.opened_by THEN NEW.opened_by := NEW.operator_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS cr_sync_trg ON public.cash_registers;
CREATE TRIGGER cr_sync_trg BEFORE INSERT OR UPDATE ON public.cash_registers
  FOR EACH ROW EXECUTE FUNCTION public.cr_sync();

-- Allow inserting cash_registers without explicit operator_id when opened_by is given
ALTER TABLE public.cash_registers ALTER COLUMN operator_id DROP NOT NULL;

-- 5) commission_tiers: tier_type, min_value, max_value, percent
ALTER TABLE public.commission_tiers
  ADD COLUMN IF NOT EXISTS tier_type text DEFAULT 'accumulated',
  ADD COLUMN IF NOT EXISTS min_value numeric,
  ADD COLUMN IF NOT EXISTS max_value numeric,
  ADD COLUMN IF NOT EXISTS percent numeric;

UPDATE public.commission_tiers SET
  min_value = COALESCE(min_value, goal_percent_min),
  max_value = COALESCE(max_value, goal_percent_max),
  percent = COALESCE(percent, commission_percent);

CREATE OR REPLACE FUNCTION public.ct_sync()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.min_value IS NULL AND NEW.goal_percent_min IS NOT NULL THEN NEW.min_value := NEW.goal_percent_min;
  ELSIF NEW.goal_percent_min IS NULL AND NEW.min_value IS NOT NULL THEN NEW.goal_percent_min := NEW.min_value;
  END IF;
  IF NEW.max_value IS NULL AND NEW.goal_percent_max IS NOT NULL THEN NEW.max_value := NEW.goal_percent_max;
  ELSIF NEW.goal_percent_max IS NULL AND NEW.max_value IS NOT NULL THEN NEW.goal_percent_max := NEW.max_value;
  END IF;
  IF NEW.percent IS NULL AND NEW.commission_percent IS NOT NULL THEN NEW.percent := NEW.commission_percent;
  ELSIF NEW.commission_percent IS NULL AND NEW.percent IS NOT NULL THEN NEW.commission_percent := NEW.percent;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ct_sync_trg ON public.commission_tiers;
CREATE TRIGGER ct_sync_trg BEFORE INSERT OR UPDATE ON public.commission_tiers
  FOR EACH ROW EXECUTE FUNCTION public.ct_sync();

-- Make canonical commission_tiers fields nullable so inserts with only alias names work
ALTER TABLE public.commission_tiers
  ALTER COLUMN goal_percent_min DROP NOT NULL,
  ALTER COLUMN goal_percent_max DROP NOT NULL,
  ALTER COLUMN commission_percent DROP NOT NULL;

-- 6) assemblies: scheduled_date + scheduled_time, derived from scheduled_at
ALTER TABLE public.assemblies
  ADD COLUMN IF NOT EXISTS scheduled_date date,
  ADD COLUMN IF NOT EXISTS scheduled_time time;

UPDATE public.assemblies SET
  scheduled_date = COALESCE(scheduled_date, scheduled_at::date),
  scheduled_time = COALESCE(scheduled_time, scheduled_at::time);

CREATE OR REPLACE FUNCTION public.assemblies_sync()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  -- If frontend sent date/time but not scheduled_at, compose it
  IF NEW.scheduled_at IS NULL AND NEW.scheduled_date IS NOT NULL THEN
    NEW.scheduled_at := (NEW.scheduled_date::text || ' ' || COALESCE(NEW.scheduled_time, '12:00')::text)::timestamptz;
  END IF;
  -- If scheduled_at was set but the date/time fields are empty, derive them
  IF NEW.scheduled_at IS NOT NULL THEN
    IF NEW.scheduled_date IS NULL THEN NEW.scheduled_date := NEW.scheduled_at::date; END IF;
    IF NEW.scheduled_time IS NULL THEN NEW.scheduled_time := NEW.scheduled_at::time; END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS assemblies_sync_trg ON public.assemblies;
CREATE TRIGGER assemblies_sync_trg BEFORE INSERT OR UPDATE ON public.assemblies
  FOR EACH ROW EXECUTE FUNCTION public.assemblies_sync();

ALTER TABLE public.assemblies ALTER COLUMN scheduled_at DROP NOT NULL;

-- 7) Recriar receive_crediario_installment com a assinatura esperada pelo frontend
DROP FUNCTION IF EXISTS public.receive_crediario_installment(uuid, numeric, payment_method);

CREATE OR REPLACE FUNCTION public.receive_crediario_installment(
  _receivable_id uuid,
  _payment_method payment_method DEFAULT 'cash'::payment_method,
  _amount numeric DEFAULT 0,
  _store_id uuid DEFAULT NULL,
  _notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  r public.accounts_receivable%ROWTYPE;
  remaining numeric;
  sale_finalized boolean := false;
BEGIN
  IF NOT public.is_account_member(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO r FROM public.accounts_receivable WHERE id = _receivable_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Receivable not found'; END IF;

  UPDATE public.accounts_receivable
     SET paid_amount = paid_amount + _amount,
         status = CASE WHEN paid_amount + _amount >= public.accounts_receivable.amount THEN 'paid'::public.receivable_status ELSE 'partial'::public.receivable_status END,
         paid_at = CASE WHEN paid_amount + _amount >= public.accounts_receivable.amount THEN now() ELSE paid_at END,
         notes = CASE WHEN _notes IS NOT NULL THEN COALESCE(notes,'') || E'\n' || _notes ELSE notes END
   WHERE id = _receivable_id;

  INSERT INTO public.payments (account_id, store_id, receivable_id, sale_id, method, paid_value, notes)
  VALUES (r.account_id, COALESCE(_store_id, public.current_store_id()), _receivable_id, r.sale_id, _payment_method, _amount, _notes);

  -- If all installments of the sale are paid, mark sale paid
  IF r.sale_id IS NOT NULL THEN
    SELECT NOT EXISTS (
      SELECT 1 FROM public.accounts_receivable
      WHERE sale_id = r.sale_id AND status NOT IN ('paid')
    ) INTO sale_finalized;
    IF sale_finalized THEN
      UPDATE public.sales SET status = 'paid', paid_at = now() WHERE id = r.sale_id AND status <> 'paid';
    END IF;
  END IF;

  RETURN jsonb_build_object('sale_finalized', sale_finalized);
END $$;
