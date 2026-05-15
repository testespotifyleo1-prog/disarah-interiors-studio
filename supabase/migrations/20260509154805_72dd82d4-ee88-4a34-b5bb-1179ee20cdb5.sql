
CREATE OR REPLACE FUNCTION public.receive_crediario_installment(_receivable_id uuid, _payment_method text, _amount numeric, _store_id uuid, _notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_receivable RECORD;
  v_sale RECORD;
  v_customer_name text;
  v_remaining_open INT;
  v_label text;
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF _payment_method NOT IN ('cash', 'pix', 'card', 'crediario', 'financeira', 'store_credit') THEN
    RAISE EXCEPTION 'Forma de pagamento inválida';
  END IF;

  IF _amount <= 0 THEN
    RAISE EXCEPTION 'Valor deve ser maior que zero';
  END IF;

  SELECT * INTO v_receivable FROM public.accounts_receivable WHERE id = _receivable_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parcela não encontrada';
  END IF;
  IF v_receivable.status != 'open' THEN
    RAISE EXCEPTION 'Parcela já foi % anteriormente', v_receivable.status;
  END IF;

  IF NOT public.has_account_role(v_user_id, v_receivable.account_id,
       ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role, 'seller'::account_role]) THEN
    RAISE EXCEPTION 'Sem permissão para registrar recebimento';
  END IF;

  UPDATE public.accounts_receivable
  SET status = 'paid', paid_at = now()
  WHERE id = _receivable_id;

  IF v_receivable.sale_id IS NOT NULL THEN
    SELECT * INTO v_sale FROM public.sales WHERE id = v_receivable.sale_id;

    SELECT name INTO v_customer_name FROM public.customers WHERE id = v_receivable.customer_id;

    v_label := 'Recebimento Crediário';
    IF v_receivable.installment_number IS NOT NULL THEN
      v_label := v_label || ' - Parcela ' || v_receivable.installment_number
                || COALESCE('/' || v_receivable.total_installments, '');
    END IF;
    IF v_customer_name IS NOT NULL THEN
      v_label := v_label || ' - ' || v_customer_name;
    END IF;
    IF _notes IS NOT NULL AND length(_notes) > 0 THEN
      v_label := v_label || ' — ' || _notes;
    END IF;

    INSERT INTO public.payments (sale_id, method, paid_value, installments, card_fee_percent, notes)
    VALUES (
      v_receivable.sale_id,
      _payment_method::payment_method,
      _amount,
      1,
      0,
      v_label
    );

    SELECT COUNT(*) INTO v_remaining_open
    FROM public.accounts_receivable
    WHERE sale_id = v_receivable.sale_id AND status = 'open';

    IF v_remaining_open = 0 AND v_sale.status = 'crediario' THEN
      UPDATE public.sales
      SET status = 'paid', updated_at = now()
      WHERE id = v_receivable.sale_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'receivable_id', _receivable_id,
    'amount', _amount,
    'method', _payment_method,
    'sale_finalized', COALESCE(v_remaining_open, 1) = 0
  );
END;
$function$;
