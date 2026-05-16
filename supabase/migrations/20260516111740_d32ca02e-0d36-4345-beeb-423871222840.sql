REVOKE EXECUTE ON FUNCTION public.reconcile_inventory_item(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.inv_mov_auto_reconcile() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sales_status_inventory() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.cancel_sale(uuid, text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cancel_sale(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_sale(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_sale(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.reconcile_inventory(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_inventory(uuid) TO authenticated;