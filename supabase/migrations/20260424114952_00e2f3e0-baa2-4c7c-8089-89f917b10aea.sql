
-- 1) Adiciona coluna para idempotência do pagamento MP no payments local
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS mp_payment_ref text;
CREATE UNIQUE INDEX IF NOT EXISTS payments_mp_payment_ref_key ON public.payments (mp_payment_ref) WHERE mp_payment_ref IS NOT NULL;

-- 2) Reescreve a função usando colunas reais e idempotência por mp_payment_ref
CREATE OR REPLACE FUNCTION public.mp_finalize_sale_if_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sale RECORD;
  v_fee_percent numeric(5,2) := 0;
  v_card_type text := null;
  v_method_local text := 'pix';
  v_ref text;
BEGIN
  IF NEW.status <> 'approved' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'approved' THEN
    RETURN NEW;
  END IF;
  IF NEW.sale_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_sale FROM public.sales WHERE id = NEW.sale_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF NEW.method = 'credit_card' THEN
    v_method_local := 'card';
    v_card_type := 'credit';
    SELECT credit_fee_percent INTO v_fee_percent FROM public.mp_connections WHERE id = NEW.connection_id;
  ELSIF NEW.method = 'debit_card' THEN
    v_method_local := 'card';
    v_card_type := 'debit';
    SELECT debit_fee_percent INTO v_fee_percent FROM public.mp_connections WHERE id = NEW.connection_id;
  ELSE
    v_method_local := 'pix';
  END IF;

  v_ref := COALESCE(NEW.mp_payment_id, NEW.id::text);

  -- Idempotente via UNIQUE INDEX em payments.mp_payment_ref
  INSERT INTO public.payments (sale_id, method, paid_value, card_type, brand, installments, card_fee_percent, mp_payment_ref)
  VALUES (
    NEW.sale_id,
    v_method_local::payment_method,
    NEW.amount,
    CASE WHEN v_method_local='card' THEN v_card_type::card_type ELSE NULL END,
    CASE WHEN v_method_local = 'card' THEN COALESCE(NEW.card_brand, 'Mercado Pago') ELSE NULL END,
    COALESCE(NEW.installments, 1),
    COALESCE(v_fee_percent, 0),
    v_ref
  )
  ON CONFLICT (mp_payment_ref) WHERE mp_payment_ref IS NOT NULL DO NOTHING;

  IF v_sale.status NOT IN ('paid','canceled') THEN
    UPDATE public.sales
       SET status = 'paid', updated_at = now()
     WHERE id = NEW.sale_id
       AND status NOT IN ('paid','canceled');
  END IF;

  RETURN NEW;
END;
$function$;
