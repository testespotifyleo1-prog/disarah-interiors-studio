
ALTER TABLE public.customer_returns
  ADD COLUMN IF NOT EXISTS stock_refunded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.reactivation_campaigns
  ADD COLUMN IF NOT EXISTS target_customer_ids uuid[] DEFAULT NULL;

INSERT INTO storage.buckets (id, name, public)
VALUES ('customer-returns', 'customer-returns', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "Public read customer-returns" ON storage.objects FOR SELECT
    USING (bucket_id = 'customer-returns');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Auth upload customer-returns" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'customer-returns');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Auth delete customer-returns" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'customer-returns');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
