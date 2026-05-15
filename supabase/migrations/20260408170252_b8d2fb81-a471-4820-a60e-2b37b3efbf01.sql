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
BEGIN
  IF NEW.status = 'paid' AND OLD.status != 'paid' THEN
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
    
    -- 2b. Calculate net value (total minus card fees)
    SELECT COALESCE(SUM(card_fee_value), 0) INTO v_total_card_fees
    FROM public.payments
    WHERE sale_id = NEW.id AND method = 'card';
    
    v_net_value := NEW.total - v_total_card_fees;
    
    -- 3. Commission (only for sellers with rules configured)
    v_commission_percent := 0;
    
    -- 3a. Check seller_commission_rules (fixed percentage)
    SELECT COALESCE(percent_default, 0) INTO v_commission_percent
    FROM public.seller_commission_rules
    WHERE account_id = NEW.account_id AND seller_user_id = NEW.seller_user_id AND is_active = true
    LIMIT 1;
    
    -- 3b. Check commission_tiers if no fixed rule
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
          AND status = 'paid'
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
  END IF;
  
  RETURN NEW;
END;
$function$;