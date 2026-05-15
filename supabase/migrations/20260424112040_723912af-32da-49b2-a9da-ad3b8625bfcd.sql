
ALTER TABLE public.mp_connections
  ADD COLUMN IF NOT EXISTS credit_fee_percent numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS debit_fee_percent  numeric(5,2) NOT NULL DEFAULT 0;

-- Função: ao aprovar mp_payment, gera registro em payments (se não existir) e marca a venda como paid
CREATE OR REPLACE FUNCTION public.mp_finalize_sale_if_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sale RECORD;
  v_fee_percent numeric(5,2) := 0;
  v_card_type text := null;
  v_method_local text := 'pix';
BEGIN
  IF NEW.status <> 'approved' THEN
    RETURN NEW;
  END IF;
  IF OLD IS NOT NULL AND OLD.status = 'approved' THEN
    RETURN NEW; -- já processado, idempotente
  END IF;
  IF NEW.sale_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_sale FROM public.sales WHERE id = NEW.sale_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Mapeia método MP -> método local + taxa
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

  -- Insere payment local (idempotente via mp_payment_id no notes)
  IF NOT EXISTS (
    SELECT 1 FROM public.payments
    WHERE sale_id = NEW.sale_id
      AND notes IS NOT NULL
      AND notes LIKE '%mp:' || COALESCE(NEW.mp_payment_id, NEW.id::text) || '%'
  ) THEN
    INSERT INTO public.payments (sale_id, method, paid_value, card_type, card_brand, installments, card_fee_percent, notes)
    VALUES (
      NEW.sale_id,
      v_method_local,
      NEW.amount,
      v_card_type,
      CASE WHEN v_method_local = 'card' THEN COALESCE(NEW.card_brand, 'Mercado Pago') ELSE NULL END,
      COALESCE(NEW.installments, 1),
      COALESCE(v_fee_percent, 0),
      'Mercado Pago [mp:' || COALESCE(NEW.mp_payment_id, NEW.id::text) || ']'
    );
  END IF;

  -- Marca venda como paga (somente se ainda não estiver) — dispara handle_sale_paid (estoque, comissão, etc.)
  IF v_sale.status <> 'paid' AND v_sale.status <> 'canceled' THEN
    UPDATE public.sales
       SET status = 'paid', updated_at = now()
     WHERE id = NEW.sale_id
       AND status <> 'paid';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mp_payments_finalize_sale ON public.mp_payments;
CREATE TRIGGER mp_payments_finalize_sale
AFTER INSERT OR UPDATE OF status ON public.mp_payments
FOR EACH ROW
EXECUTE FUNCTION public.mp_finalize_sale_if_paid();
