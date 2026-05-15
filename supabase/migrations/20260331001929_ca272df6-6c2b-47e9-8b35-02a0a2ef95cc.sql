
-- Add image_url to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_url text;

-- Add description to products for storefront
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS description text;

-- Add richer ecommerce settings fields
ALTER TABLE public.store_ecommerce_settings 
  ADD COLUMN IF NOT EXISTS banner_image_url text,
  ADD COLUMN IF NOT EXISTS featured_product_ids uuid[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS categories jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS hero_subtitle text,
  ADD COLUMN IF NOT EXISTS show_prices boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_whatsapp_button boolean DEFAULT true;

-- Create product-images bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read on product-images
CREATE POLICY "Public read product images" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'product-images');

-- Allow authenticated upload on product-images
CREATE POLICY "Authenticated upload product images" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'product-images');

-- Allow authenticated update on product-images
CREATE POLICY "Authenticated update product images" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'product-images');

-- Allow authenticated delete on product-images
CREATE POLICY "Authenticated delete product images" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'product-images');
