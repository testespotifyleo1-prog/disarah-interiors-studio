
-- Add expiration_date to inventory for shelf-life tracking
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS expiration_date date;

-- Index for quick lookup of expiring products
CREATE INDEX IF NOT EXISTS idx_inventory_expiration ON public.inventory (expiration_date) WHERE expiration_date IS NOT NULL;
