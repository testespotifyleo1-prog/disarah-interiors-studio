-- 1) Add assembly_fee to sales
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS assembly_fee numeric(12,2) NOT NULL DEFAULT 0;

-- 2) Add assembly_fee to quotes
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS assembly_fee numeric(12,2) NOT NULL DEFAULT 0;

-- 3) Update recalc trigger to include assembly_fee in total
CREATE OR REPLACE FUNCTION public.recalculate_sale_totals()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sale_id UUID;
  v_subtotal NUMERIC(12,2);
  v_discount NUMERIC(12,2);
  v_delivery_fee NUMERIC(12,2);
  v_assembly_fee NUMERIC(12,2);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_sale_id := OLD.sale_id;
  ELSE
    v_sale_id := NEW.sale_id;
  END IF;

  SELECT COALESCE(SUM(total_line), 0) INTO v_subtotal
  FROM public.sale_items WHERE sale_id = v_sale_id;

  SELECT COALESCE(discount, 0), COALESCE(delivery_fee, 0), COALESCE(assembly_fee, 0)
  INTO v_discount, v_delivery_fee, v_assembly_fee
  FROM public.sales WHERE id = v_sale_id;

  UPDATE public.sales
  SET subtotal = v_subtotal,
      total = v_subtotal - v_discount + v_delivery_fee + v_assembly_fee,
      updated_at = now()
  WHERE id = v_sale_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;