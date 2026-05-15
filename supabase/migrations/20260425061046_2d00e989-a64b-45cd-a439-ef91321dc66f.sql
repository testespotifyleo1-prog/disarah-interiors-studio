-- 1) Add 'crediario' to sale_status enum
ALTER TYPE public.sale_status ADD VALUE IF NOT EXISTS 'crediario';

-- 2) Add notes column to payments for tracking crediário receipts
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS notes text;

-- 3) Update trigger handle_sale_paid to also process when status becomes 'crediario'
CREATE OR REPLACE FUNCTION public.handle_sale_paid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_commission_percent NUMERIC(5,2);
  v_commission_value NUMERIC(12,2);
  v_net_value NUMERIC(12,2);
  v_total_card_fees NUMERIC(12,2);
  v_item RECORD;
  v_skip_auto_delivery BOOLEAN := false;
  v_monthly_total NUMERIC(12,2);
  v_should_finalize BOOLEAN := false;
BEGIN
  -- Trigger fires when sale becomes 'paid' OR 'crediario' (first time)
  IF (NEW.status = 'paid' AND OLD.status NOT IN ('paid', 'crediario'))
     OR (NEW.status = 'crediario' AND OLD.status NOT IN ('paid', 'crediario')) THEN
    v_should_finalize := true;
  END IF;

  IF NOT v_should_finalize THEN
    RETURN NEW;
  END IF;

  -- 1. Decrease inventory
  FOR v_item IN SELECT product_id, qty FROM public.sale_items WHERE sale_id = NEW.id
  LOOP
    UPDATE public.inventory
    SET qty_on_hand = qty_on_hand - v_item.qty, updated_at = now()
    WHERE store_id = NEW.store_id AND product_id = v_item.product_id;
    IF NOT FOUND THEN
      INSERT INTO public.inventory (store_id, product_id, qty_on_hand)
      VALUES (NEW.store_id, v_item.product_id, -v_item.qty);
    END IF;
  END LOOP;

  -- 2. Calculate card fees
  UPDATE public.payments
  SET card_fee_value = ROUND(paid_value * card_fee_percent / 100, 2)
  WHERE sale_id = NEW.id AND method = 'card';

  SELECT COALESCE(SUM(card_fee_value), 0) INTO v_total_card_fees
  FROM public.payments
  WHERE sale_id = NEW.id AND method = 'card';

  v_net_value := NEW.total - v_total_card_fees;

  -- 3. Commission
  v_commission_percent := 0;
  SELECT COALESCE(percent_default, 0) INTO v_commission_percent
  FROM public.seller_commission_rules
  WHERE account_id = NEW.account_id AND seller_user_id = NEW.seller_user_id AND is_active = true
  LIMIT 1;

  IF v_commission_percent = 0 THEN
    SELECT percent INTO v_commission_percent
    FROM public.commission_tiers
    WHERE account_id = NEW.account_id
      AND seller_user_id = NEW.seller_user_id
      AND tier_type = 'per_sale'
      AND is_active = true
      AND v_net_value >= min_value
      AND (max_value IS NULL OR v_net_value <= max_value)
    ORDER BY min_value DESC LIMIT 1;

    IF v_commission_percent IS NULL OR v_commission_percent = 0 THEN
      SELECT COALESCE(SUM(total), 0) INTO v_monthly_total
      FROM public.sales
      WHERE account_id = NEW.account_id
        AND seller_user_id = NEW.seller_user_id
        AND status IN ('paid', 'crediario')
        AND created_at >= date_trunc('month', now())
        AND id != NEW.id;
      v_monthly_total := v_monthly_total + NEW.total;

      SELECT percent INTO v_commission_percent
      FROM public.commission_tiers
      WHERE account_id = NEW.account_id
        AND seller_user_id = NEW.seller_user_id
        AND tier_type = 'monthly_accumulated'
        AND is_active = true
        AND v_monthly_total >= min_value
        AND (max_value IS NULL OR v_monthly_total <= max_value)
      ORDER BY min_value DESC LIMIT 1;
    END IF;
  END IF;

  v_commission_percent := COALESCE(v_commission_percent, 0);

  IF v_commission_percent > 0 THEN
    v_commission_value := ROUND(v_net_value * v_commission_percent / 100, 2);
    INSERT INTO public.commissions (sale_id, seller_user_id, percent, value, status)
    VALUES (NEW.id, NEW.seller_user_id, v_commission_percent, v_commission_value, 'pending');
  END IF;

  -- 4. Auto delivery
  IF NEW.account_id IN (
    '2480b8ae-c3a4-4a39-ad76-e6b41013f25e',
    '794d95b6-15e2-4ada-8aea-32998477f235'
  ) AND COALESCE(NEW.source, 'pdv') != 'ecommerce' THEN
    v_skip_auto_delivery := true;
  END IF;

  IF NOT v_skip_auto_delivery THEN
    INSERT INTO public.deliveries (sale_id, account_id, store_id, status, delivery_type)
    VALUES (NEW.id, NEW.account_id, NEW.store_id, 'pending', 'delivery');
  END IF;

  RETURN NEW;
END;
$function$;

-- 4) RPC to receive a crediário installment
CREATE OR REPLACE FUNCTION public.receive_crediario_installment(
  _receivable_id uuid,
  _payment_method text,
  _amount numeric,
  _store_id uuid,
  _notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_receivable RECORD;
  v_sale RECORD;
  v_remaining_open INT;
  v_label text;
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF _payment_method NOT IN ('cash', 'pix', 'card') THEN
    RAISE EXCEPTION 'Forma de pagamento inválida (use cash, pix ou card)';
  END IF;

  IF _amount <= 0 THEN
    RAISE EXCEPTION 'Valor deve ser maior que zero';
  END IF;

  -- Load the receivable
  SELECT * INTO v_receivable FROM public.accounts_receivable WHERE id = _receivable_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parcela não encontrada';
  END IF;
  IF v_receivable.status != 'open' THEN
    RAISE EXCEPTION 'Parcela já foi % anteriormente', v_receivable.status;
  END IF;

  -- Permission check
  IF NOT public.has_account_role(v_user_id, v_receivable.account_id,
       ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role, 'seller'::account_role]) THEN
    RAISE EXCEPTION 'Sem permissão para registrar recebimento';
  END IF;

  -- Mark as paid
  UPDATE public.accounts_receivable
  SET status = 'paid', paid_at = now()
  WHERE id = _receivable_id;

  -- If linked to a sale, register a payment row + cash movement on that sale's cash register
  IF v_receivable.sale_id IS NOT NULL THEN
    SELECT * INTO v_sale FROM public.sales WHERE id = v_receivable.sale_id;

    v_label := 'Recebimento Crediário'
      || CASE WHEN v_receivable.installment_number IS NOT NULL
              THEN ' - Parcela ' || v_receivable.installment_number
                   || COALESCE('/' || v_receivable.total_installments, '')
              ELSE '' END;
    IF _notes IS NOT NULL AND length(_notes) > 0 THEN
      v_label := v_label || ' — ' || _notes;
    END IF;

    -- Insert payment record so it shows on cash register summary
    INSERT INTO public.payments (sale_id, method, paid_value, installments, card_fee_percent, notes)
    VALUES (
      v_receivable.sale_id,
      _payment_method::payment_method,
      _amount,
      1,
      0,
      v_label
    );

    -- Check if all installments are now paid → finalize the sale
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