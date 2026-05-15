-- Add store logo support
ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS logo_path text,
ADD COLUMN IF NOT EXISTS logo_updated_at timestamp with time zone;

-- Create public bucket for company/store logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('store-assets', 'store-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for authenticated account members to manage store logos
CREATE POLICY "Authenticated users can view store logos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'store-assets');

CREATE POLICY "Account members can upload store logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'store-assets'
  AND (storage.foldername(name))[1] IN (
    SELECT s.id::text
    FROM public.stores s
    WHERE s.account_id = ANY (public.get_user_account_ids(auth.uid()))
  )
);

CREATE POLICY "Account members can update store logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'store-assets'
  AND (storage.foldername(name))[1] IN (
    SELECT s.id::text
    FROM public.stores s
    WHERE s.account_id = ANY (public.get_user_account_ids(auth.uid()))
  )
)
WITH CHECK (
  bucket_id = 'store-assets'
  AND (storage.foldername(name))[1] IN (
    SELECT s.id::text
    FROM public.stores s
    WHERE s.account_id = ANY (public.get_user_account_ids(auth.uid()))
  )
);

CREATE POLICY "Account members can delete store logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'store-assets'
  AND (storage.foldername(name))[1] IN (
    SELECT s.id::text
    FROM public.stores s
    WHERE s.account_id = ANY (public.get_user_account_ids(auth.uid()))
  )
);