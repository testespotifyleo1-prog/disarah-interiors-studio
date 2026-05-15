
ALTER TABLE public.picking_orders
  ADD COLUMN IF NOT EXISTS public_token text UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', '');

UPDATE public.picking_orders
  SET public_token = replace(gen_random_uuid()::text, '-', '')
  WHERE public_token IS NULL;

CREATE INDEX IF NOT EXISTS idx_picking_orders_public_token ON public.picking_orders(public_token);

CREATE OR REPLACE FUNCTION public.get_public_tracking(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _order RECORD;
  _items jsonb;
  _store RECORD;
  _sale RECORD;
BEGIN
  SELECT id, sale_id, store_id, status, shipping_provider, tracking_code,
         shipping_label_url, started_at, finished_at, created_at, updated_at
  INTO _order
  FROM public.picking_orders
  WHERE public_token = _token
  LIMIT 1;

  IF _order.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT name, slug, address_json INTO _store FROM public.stores WHERE id = _order.store_id;

  SELECT order_number, total, customer_id INTO _sale FROM public.sales WHERE id = _order.sale_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'product_name', product_name,
    'qty_required', qty_required,
    'qty_picked', qty_picked
  ) ORDER BY created_at), '[]'::jsonb) INTO _items
  FROM public.picking_items WHERE picking_order_id = _order.id;

  RETURN jsonb_build_object(
    'status', _order.status,
    'shipping_provider', _order.shipping_provider,
    'tracking_code', _order.tracking_code,
    'shipping_label_url', _order.shipping_label_url,
    'started_at', _order.started_at,
    'finished_at', _order.finished_at,
    'created_at', _order.created_at,
    'updated_at', _order.updated_at,
    'order_number', _sale.order_number,
    'store_name', _store.name,
    'store_slug', _store.slug,
    'items', _items
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_tracking(text) TO anon, authenticated;
