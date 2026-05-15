-- Fast barcode/GTIN lookup for POS
CREATE INDEX IF NOT EXISTS idx_products_account_gtin ON public.products (account_id, gtin) WHERE gtin IS NOT NULL;

-- Fast name search (ILIKE) for POS
CREATE INDEX IF NOT EXISTS idx_products_account_name_trgm ON public.products (account_id, name text_pattern_ops);

-- Fast active product filter
CREATE INDEX IF NOT EXISTS idx_products_account_active ON public.products (account_id, is_active) WHERE is_active = true;

-- Variant lookups by SKU and GTIN for barcode scanning
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON public.product_variants (sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_variants_gtin ON public.product_variants (gtin) WHERE gtin IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON public.product_variants (product_id);

-- Inventory lookup optimization
CREATE INDEX IF NOT EXISTS idx_inventory_store_product ON public.inventory (store_id, product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_store_variant ON public.inventory (store_id, product_id, variant_id) WHERE variant_id IS NOT NULL;