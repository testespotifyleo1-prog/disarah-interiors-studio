
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT table_name FROM information_schema.columns
    WHERE table_schema='public' AND column_name='account_id'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN account_id SET DEFAULT public.current_account_id()', r.table_name);
  END LOOP;
END $$;
