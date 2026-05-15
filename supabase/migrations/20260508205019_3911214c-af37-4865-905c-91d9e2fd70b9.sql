REVOKE EXECUTE ON FUNCTION public.products_missing_embedding_count(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.products_missing_embedding_count(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.products_missing_embedding_count(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.products_total_active_count(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.products_total_active_count(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.products_total_active_count(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.products_indexed_count(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.products_indexed_count(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.products_indexed_count(uuid) TO authenticated;