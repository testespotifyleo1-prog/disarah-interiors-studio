-- 1) Habilita extensão de vetores
CREATE EXTENSION IF NOT EXISTS vector;

-- 2) Coluna de embedding nos produtos (1536 dims = OpenAI text-embedding-3-small)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS embedding vector(1536),
  ADD COLUMN IF NOT EXISTS embedding_text text,
  ADD COLUMN IF NOT EXISTS embedding_updated_at timestamptz;

-- 3) Índice HNSW (rápido em catálogos grandes, suporta updates online)
CREATE INDEX IF NOT EXISTS products_embedding_hnsw_idx
  ON public.products
  USING hnsw (embedding vector_cosine_ops);

-- 4) Trigger: invalida embedding quando texto-chave do produto muda
CREATE OR REPLACE FUNCTION public.invalidate_product_embedding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (COALESCE(NEW.name,'')        IS DISTINCT FROM COALESCE(OLD.name,''))
  OR (COALESCE(NEW.brand,'')       IS DISTINCT FROM COALESCE(OLD.brand,''))
  OR (COALESCE(NEW.category,'')    IS DISTINCT FROM COALESCE(OLD.category,''))
  OR (COALESCE(NEW.description,'') IS DISTINCT FROM COALESCE(OLD.description,''))
  OR (COALESCE(NEW.ai_training,'') IS DISTINCT FROM COALESCE(OLD.ai_training,''))
  OR (COALESCE(NEW.sku,'')         IS DISTINCT FROM COALESCE(OLD.sku,''))
  THEN
    NEW.embedding := NULL;
    NEW.embedding_text := NULL;
    NEW.embedding_updated_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invalidate_product_embedding ON public.products;
CREATE TRIGGER trg_invalidate_product_embedding
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.invalidate_product_embedding();

-- 5) RPC: busca semântica restrita à conta + ativos
CREATE OR REPLACE FUNCTION public.match_products(
  _account_id uuid,
  _query_embedding vector(1536),
  _match_count int DEFAULT 8,
  _min_similarity float DEFAULT 0.30
)
RETURNS TABLE (
  id uuid,
  name text,
  brand text,
  price_default numeric,
  promo_price numeric,
  promo_starts_at timestamptz,
  promo_ends_at timestamptz,
  sku text,
  category text,
  description text,
  unit text,
  image_url text,
  ai_training text,
  similarity float
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id, p.name, p.brand, p.price_default, p.promo_price,
    p.promo_starts_at, p.promo_ends_at, p.sku, p.category,
    p.description, p.unit, p.image_url, p.ai_training,
    1 - (p.embedding <=> _query_embedding) AS similarity
  FROM public.products p
  WHERE p.account_id = _account_id
    AND p.is_active = true
    AND p.embedding IS NOT NULL
    AND 1 - (p.embedding <=> _query_embedding) >= _min_similarity
  ORDER BY p.embedding <=> _query_embedding
  LIMIT _match_count;
$$;

-- 6) Helper para o reindex: lista produtos sem embedding
CREATE OR REPLACE FUNCTION public.products_missing_embedding_count(_account_id uuid)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.products
  WHERE account_id = _account_id AND is_active = true AND embedding IS NULL;
$$;