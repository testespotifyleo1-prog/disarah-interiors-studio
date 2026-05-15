-- 1) Add subcategory column to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS subcategory text;
CREATE INDEX IF NOT EXISTS idx_products_account_category ON public.products(account_id, category);
CREATE INDEX IF NOT EXISTS idx_products_account_subcategory ON public.products(account_id, subcategory);

-- 2) Categorize Disarah Interiores (account: Leona) products
-- Order matters: more specific patterns FIRST
DO $$
DECLARE
  v_account_id uuid := '383878d2-142b-4df6-94ce-875f6458413e';
BEGIN
  -- Camas & Colchões (specific before "CAMA" generic)
  UPDATE public.products SET category = 'Camas & Colchões',
    subcategory = CASE
      WHEN UPPER(name) LIKE '%COLCHAO%' OR UPPER(name) LIKE '%COLCHÃO%' THEN 'Colchões'
      WHEN UPPER(name) LIKE '%BELICHE%' THEN 'Beliches'
      WHEN UPPER(name) LIKE '%BOX%' THEN 'Box'
      WHEN UPPER(name) LIKE '%CABEC%' OR UPPER(name) LIKE '%CABECEIRA%' THEN 'Cabeceiras'
      WHEN UPPER(name) LIKE 'CAMA%' THEN 'Camas'
      ELSE NULL END
  WHERE account_id = v_account_id AND category IS NULL
    AND (UPPER(name) LIKE 'CAMA%' OR UPPER(name) LIKE '%COLCHAO%' OR UPPER(name) LIKE '%COLCHÃO%'
      OR UPPER(name) LIKE '%BELICHE%' OR UPPER(name) LIKE '%CABEC%' OR UPPER(name) LIKE '%BOX%');

  -- Sofás (and recamier, SF-)
  UPDATE public.products SET category = 'Sofás',
    subcategory = CASE
      WHEN UPPER(name) LIKE '%RETRATIL%' OR UPPER(name) LIKE '%RETRÁTIL%' THEN 'Retrátil'
      WHEN UPPER(name) LIKE '%CANTO%' THEN 'de Canto'
      WHEN UPPER(name) LIKE '%RECAMIER%' THEN 'Recamier'
      WHEN UPPER(name) LIKE '%CAMA%' THEN 'Sofá-cama'
      WHEN UPPER(name) LIKE '%3 LUG%' OR UPPER(name) LIKE '%3LUG%' THEN '3 Lugares'
      WHEN UPPER(name) LIKE '%2 LUG%' OR UPPER(name) LIKE '%2LUG%' THEN '2 Lugares'
      ELSE NULL END
  WHERE account_id = v_account_id AND category IS NULL
    AND (UPPER(name) LIKE 'SOFA%' OR UPPER(name) LIKE 'SOFÁ%' OR UPPER(name) LIKE 'SF %' OR UPPER(name) LIKE 'SF-%'
      OR UPPER(name) LIKE '%RECAMIER%');

  -- Mesas
  UPDATE public.products SET category = 'Mesas',
    subcategory = CASE
      WHEN UPPER(name) LIKE '%CENTRO%' THEN 'Mesa de Centro'
      WHEN UPPER(name) LIKE '%LATERAL%' THEN 'Lateral'
      WHEN UPPER(name) LIKE '%BISTRO%' OR UPPER(name) LIKE '%BISTRÔ%' THEN 'Bistrô'
      WHEN UPPER(name) LIKE '%JANTAR%' OR UPPER(name) LIKE 'CONJ.MESA%' OR UPPER(name) LIKE 'CONJ. MESA%' THEN 'Jantar'
      WHEN UPPER(name) LIKE '%TAMPO%' THEN 'Tampo'
      WHEN UPPER(name) LIKE '%BASE%' THEN 'Base'
      ELSE NULL END
  WHERE account_id = v_account_id AND category IS NULL
    AND (UPPER(name) LIKE 'MESA%' OR UPPER(name) LIKE 'CONJ.MESA%' OR UPPER(name) LIKE 'CONJ. MESA%'
      OR UPPER(name) LIKE 'BISTRO%' OR UPPER(name) LIKE 'BASE/MESA%' OR UPPER(name) LIKE 'TAMPO%');

  -- Cadeiras & Banquetas
  UPDATE public.products SET category = 'Cadeiras & Banquetas',
    subcategory = CASE
      WHEN UPPER(name) LIKE '%BANQUETA%' THEN 'Banquetas'
      WHEN UPPER(name) LIKE '%BANCO%' THEN 'Bancos'
      WHEN UPPER(name) LIKE '%ESCRIT%' THEN 'Escritório'
      WHEN UPPER(name) LIKE '%JANTAR%' THEN 'Jantar'
      ELSE 'Cadeiras' END
  WHERE account_id = v_account_id AND category IS NULL
    AND (UPPER(name) LIKE 'CADEIRA%' OR UPPER(name) LIKE 'CAD %' OR UPPER(name) LIKE 'CAD.%'
      OR UPPER(name) LIKE 'BANQUETA%' OR UPPER(name) LIKE 'BANCO%');

  -- Poltronas & Puffs
  UPDATE public.products SET category = 'Poltronas & Puffs',
    subcategory = CASE WHEN UPPER(name) LIKE '%PUFF%' THEN 'Puffs' ELSE 'Poltronas' END
  WHERE account_id = v_account_id AND category IS NULL
    AND (UPPER(name) LIKE 'POLTRONA%' OR UPPER(name) LIKE 'PUFF%');

  -- Sala de TV (Racks, Painéis, Home, Aéreos)
  UPDATE public.products SET category = 'Racks & Painéis',
    subcategory = CASE
      WHEN UPPER(name) LIKE 'RACK%' THEN 'Racks'
      WHEN UPPER(name) LIKE 'PAINEL%' THEN 'Painéis'
      WHEN UPPER(name) LIKE 'HOME%' THEN 'Home Theater'
      WHEN UPPER(name) LIKE 'AEREO%' OR UPPER(name) LIKE 'AÉREO%' THEN 'Aéreos'
      ELSE NULL END
  WHERE account_id = v_account_id AND category IS NULL
    AND (UPPER(name) LIKE 'RACK%' OR UPPER(name) LIKE 'PAINEL%' OR UPPER(name) LIKE 'HOME%' OR UPPER(name) LIKE 'AEREO%');

  -- Cômodas & Quarto
  UPDATE public.products SET category = 'Cômodas & Criados',
    subcategory = CASE
      WHEN UPPER(name) LIKE 'CRIADO%' THEN 'Criado-mudo'
      WHEN UPPER(name) LIKE 'COMODA%' OR UPPER(name) LIKE 'CÔMODA%' THEN 'Cômodas'
      WHEN UPPER(name) LIKE 'GAVETEIRO%' THEN 'Gaveteiros'
      WHEN UPPER(name) LIKE 'PENTEADEIRA%' THEN 'Penteadeiras'
      ELSE NULL END
  WHERE account_id = v_account_id AND category IS NULL
    AND (UPPER(name) LIKE 'COMODA%' OR UPPER(name) LIKE 'CÔMODA%' OR UPPER(name) LIKE 'CRIADO%'
      OR UPPER(name) LIKE 'GAVETEIRO%' OR UPPER(name) LIKE 'PENTEADEIRA%');

  -- Roupeiros & Armários
  UPDATE public.products SET category = 'Roupeiros & Armários',
    subcategory = CASE
      WHEN UPPER(name) LIKE 'SAPATEIRA%' THEN 'Sapateiras'
      WHEN UPPER(name) LIKE 'ARMARIO%' OR UPPER(name) LIKE 'ARMÁRIO%' THEN 'Armários'
      ELSE 'Roupeiros' END
  WHERE account_id = v_account_id AND category IS NULL
    AND (UPPER(name) LIKE 'ROUPEIRO%' OR UPPER(name) LIKE 'ROUP %' OR UPPER(name) LIKE 'ROUP.%'
      OR UPPER(name) LIKE 'ARMARIO%' OR UPPER(name) LIKE 'ARMÁRIO%' OR UPPER(name) LIKE 'SAPATEIRA%');

  -- Buffets, Aparadores, Cristaleiras
  UPDATE public.products SET category = 'Buffets & Aparadores',
    subcategory = CASE
      WHEN UPPER(name) LIKE 'APARADOR%' THEN 'Aparadores'
      WHEN UPPER(name) LIKE 'CRISTALEIRA%' THEN 'Cristaleiras'
      WHEN UPPER(name) LIKE 'ADEGA%' THEN 'Adegas'
      WHEN UPPER(name) LIKE 'BAR%' THEN 'Bares'
      ELSE 'Buffets' END
  WHERE account_id = v_account_id AND category IS NULL
    AND (UPPER(name) LIKE 'APARADOR%' OR UPPER(name) LIKE 'BUFFET%' OR UPPER(name) LIKE 'ARCA/BUFFET%'
      OR UPPER(name) LIKE 'CRISTALEIRA%' OR UPPER(name) LIKE 'ADEGA%' OR UPPER(name) LIKE 'BAR %');

  -- Cozinha
  UPDATE public.products SET category = 'Cozinha',
    subcategory = CASE
      WHEN UPPER(name) LIKE 'BALCAO%' OR UPPER(name) LIKE 'BALCÃO%' THEN 'Balcões'
      WHEN UPPER(name) LIKE 'BANCADA%' THEN 'Bancadas'
      ELSE NULL END
  WHERE account_id = v_account_id AND category IS NULL
    AND (UPPER(name) LIKE 'COZINHA%' OR UPPER(name) LIKE 'BALCAO%' OR UPPER(name) LIKE 'BALCÃO%' OR UPPER(name) LIKE 'BANCADA%');

  -- Escritório
  UPDATE public.products SET category = 'Escritório',
    subcategory = CASE
      WHEN UPPER(name) LIKE 'ESCRIVANINHA%' THEN 'Escrivaninhas'
      WHEN UPPER(name) LIKE 'ESTANTE%' THEN 'Estantes'
      ELSE NULL END
  WHERE account_id = v_account_id AND category IS NULL
    AND (UPPER(name) LIKE 'ESCRIVANINHA%' OR UPPER(name) LIKE 'ESTANTE%');

  -- Decoração
  UPDATE public.products SET category = 'Decoração',
    subcategory = CASE
      WHEN UPPER(name) LIKE 'ADORNO%' THEN 'Adornos'
      WHEN UPPER(name) LIKE 'ESPELHO%' THEN 'Espelhos'
      WHEN UPPER(name) LIKE 'QUADRO%' OR UPPER(name) LIKE '%CONJUNTO%QUADR%' OR UPPER(name) LIKE '%MOLDURA%' THEN 'Quadros'
      WHEN UPPER(name) LIKE 'TAPETE%' THEN 'Tapetes'
      WHEN UPPER(name) LIKE 'ALMOFADA%' THEN 'Almofadas'
      WHEN UPPER(name) LIKE 'NICHO%' THEN 'Nichos'
      WHEN UPPER(name) LIKE 'BANDEJA%' THEN 'Bandejas'
      WHEN UPPER(name) LIKE 'VASO%' THEN 'Vasos'
      ELSE NULL END
  WHERE account_id = v_account_id AND category IS NULL
    AND (UPPER(name) LIKE 'ADORNO%' OR UPPER(name) LIKE 'ESPELHO%' OR UPPER(name) LIKE 'QUADRO%'
      OR UPPER(name) LIKE 'TAPETE%' OR UPPER(name) LIKE 'ALMOFADA%' OR UPPER(name) LIKE 'NICHO%'
      OR UPPER(name) LIKE 'BANDEJA%' OR UPPER(name) LIKE 'VASO%' OR UPPER(name) LIKE '%MOLDURA%'
      OR UPPER(name) LIKE '%CONJUNTO%QUADR%');

  -- Normalize the existing "SOFAS" product
  UPDATE public.products SET category = 'Sofás'
  WHERE account_id = v_account_id AND category = 'SOFAS';

  -- Anything else → "Outros"
  UPDATE public.products SET category = 'Outros'
  WHERE account_id = v_account_id AND category IS NULL AND is_active = true;
END $$;