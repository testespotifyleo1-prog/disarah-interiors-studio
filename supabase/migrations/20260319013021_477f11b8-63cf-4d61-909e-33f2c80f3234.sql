
-- Trigger function to auto-generate SKU when null on INSERT
CREATE OR REPLACE FUNCTION public.auto_generate_sku()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.sku IS NULL OR TRIM(NEW.sku) = '' THEN
    NEW.sku := generate_next_sku(NEW.account_id);
  END IF;
  RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER trg_auto_generate_sku
  BEFORE INSERT ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_sku();
