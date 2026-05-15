-- Add source column to sales to distinguish ecommerce orders
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'pdv';

-- Enable realtime for sales table
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
