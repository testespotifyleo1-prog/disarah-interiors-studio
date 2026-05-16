WITH keeper AS (
  SELECT store_id, product_id, COALESCE(variant_id::text,'') AS vkey,
         (array_agg(id ORDER BY updated_at DESC NULLS LAST, id))[1] AS keep_id,
         SUM(qty) AS total_qty,
         SUM(COALESCE(reserved_qty,0)) AS total_reserved
  FROM public.inventory
  GROUP BY store_id, product_id, COALESCE(variant_id::text,'')
)
UPDATE public.inventory inv
   SET qty = k.total_qty,
       qty_on_hand = k.total_qty,
       reserved_qty = k.total_reserved,
       updated_at = now()
  FROM keeper k
 WHERE inv.id = k.keep_id;

DELETE FROM public.inventory inv
 WHERE NOT EXISTS (
   SELECT 1 FROM (
     SELECT (array_agg(id ORDER BY updated_at DESC NULLS LAST, id))[1] AS keep_id
     FROM public.inventory
     GROUP BY store_id, product_id, COALESCE(variant_id::text,'')
   ) k WHERE k.keep_id = inv.id
 );

ALTER TABLE public.inventory DROP CONSTRAINT IF EXISTS inventory_store_id_product_id_variant_id_key;
DROP INDEX IF EXISTS public.inventory_store_id_product_id_variant_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS inventory_store_product_variant_uniq
  ON public.inventory (store_id, product_id, variant_id) NULLS NOT DISTINCT;