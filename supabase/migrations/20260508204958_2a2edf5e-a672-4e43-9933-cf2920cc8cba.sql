CREATE OR REPLACE FUNCTION public.products_missing_embedding_count(_account_id uuid)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.products
  WHERE account_id = _account_id
    AND is_active = true
    AND NULLIF(TRIM(COALESCE(embedding_text, '')), '') IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.products_total_active_count(_account_id uuid)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.products
  WHERE account_id = _account_id
    AND is_active = true;
$$;

CREATE OR REPLACE FUNCTION public.products_indexed_count(_account_id uuid)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.products
  WHERE account_id = _account_id
    AND is_active = true
    AND NULLIF(TRIM(COALESCE(embedding_text, '')), '') IS NOT NULL;
$$;