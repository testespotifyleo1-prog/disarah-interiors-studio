
ALTER TABLE public.store_transfers
  DROP CONSTRAINT IF EXISTS store_transfers_from_store_id_fkey,
  DROP CONSTRAINT IF EXISTS store_transfers_to_store_id_fkey;

ALTER TABLE public.store_transfers
  ADD CONSTRAINT store_transfers_from_store_id_fkey
    FOREIGN KEY (from_store_id) REFERENCES public.stores(id) ON DELETE SET NULL,
  ADD CONSTRAINT store_transfers_to_store_id_fkey
    FOREIGN KEY (to_store_id) REFERENCES public.stores(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
