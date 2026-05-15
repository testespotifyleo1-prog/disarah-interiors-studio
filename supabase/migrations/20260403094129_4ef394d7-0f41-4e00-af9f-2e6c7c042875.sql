
CREATE OR REPLACE FUNCTION public.handle_sale_paid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_commission_percent NUMERIC(5,2);
  v_commission_value NUMERIC(12,2);
  v_item RECORD;
  v_skip_auto_delivery BOOLEAN := false;
BEGIN
  -- Only process when status changes TO 'paid'
  IF NEW.status = 'paid' AND OLD.status != 'paid' THEN
    -- 1. Decrease inventory for each item
    FOR v_item IN SELECT product_id, qty FROM public.sale_items WHERE sale_id = NEW.id
    LOOP
      UPDATE public.inventory
      SET qty_on_hand = qty_on_hand - v_item.qty,
          updated_at = now()
      WHERE store_id = NEW.store_id AND product_id = v_item.product_id;
      
      -- Create inventory record if not exists
      IF NOT FOUND THEN
        INSERT INTO public.inventory (store_id, product_id, qty_on_hand)
        VALUES (NEW.store_id, v_item.product_id, -v_item.qty);
      END IF;
    END LOOP;
    
    -- 2. Calculate card fees for card payments
    UPDATE public.payments
    SET card_fee_value = ROUND(paid_value * card_fee_percent / 100, 2)
    WHERE sale_id = NEW.id AND method = 'card';
    
    -- 3. Create commission for seller
    SELECT COALESCE(percent_default, 0) INTO v_commission_percent
    FROM public.seller_commission_rules
    WHERE account_id = NEW.account_id AND seller_user_id = NEW.seller_user_id AND is_active = true
    LIMIT 1;
    
    IF v_commission_percent > 0 THEN
      v_commission_value := ROUND(NEW.total * v_commission_percent / 100, 2);
      INSERT INTO public.commissions (sale_id, seller_user_id, percent, value, status)
      VALUES (NEW.id, NEW.seller_user_id, v_commission_percent, v_commission_value, 'pending');
    END IF;
    
    -- 4. Check if auto-delivery should be skipped for specific accounts
    -- Ponto da Festa and TOP FESTAS: only create delivery for ecommerce orders
    IF NEW.account_id IN (
      '2480b8ae-c3a4-4a39-ad76-e6b41013f25e',
      '794d95b6-15e2-4ada-8aea-32998477f235'
    ) AND COALESCE(NEW.source, 'pdv') != 'ecommerce' THEN
      v_skip_auto_delivery := true;
    END IF;
    
    -- Create delivery record only if not skipped
    IF NOT v_skip_auto_delivery THEN
      INSERT INTO public.deliveries (sale_id, account_id, store_id, status, delivery_type)
      VALUES (NEW.id, NEW.account_id, NEW.store_id, 'pending', 'delivery');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
