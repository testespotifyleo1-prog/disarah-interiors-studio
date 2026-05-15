
-- Add order_number column to sales
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS order_number integer;

-- Create a function to auto-generate order_number per account
CREATE OR REPLACE FUNCTION public.auto_generate_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    SELECT COALESCE(MAX(order_number), 0) + 1 INTO NEW.order_number
    FROM public.sales
    WHERE account_id = NEW.account_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER trg_auto_generate_order_number
  BEFORE INSERT ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_order_number();

-- Backfill existing sales with order numbers per account
WITH numbered AS (
  SELECT id, account_id, ROW_NUMBER() OVER (PARTITION BY account_id ORDER BY created_at) AS rn
  FROM public.sales
  WHERE order_number IS NULL
)
UPDATE public.sales s
SET order_number = n.rn
FROM numbered n
WHERE s.id = n.id;
