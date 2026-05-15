
-- ===== ENUMS — adicionar valores =====
ALTER TYPE public.sale_status ADD VALUE IF NOT EXISTS 'crediario';
ALTER TYPE public.delivery_status ADD VALUE IF NOT EXISTS 'assigned';
ALTER TYPE public.fiscal_doc_status ADD VALUE IF NOT EXISTS 'issued';
ALTER TYPE public.fiscal_doc_status ADD VALUE IF NOT EXISTS 'processing';
ALTER TYPE public.fiscal_doc_status ADD VALUE IF NOT EXISTS 'completed';

-- ===== inventory: qty_on_hand <-> qty =====
ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS qty_on_hand numeric(14,3);

UPDATE public.inventory SET qty_on_hand = qty WHERE qty_on_hand IS NULL;

CREATE OR REPLACE FUNCTION public.inventory_sync_qty()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.qty_on_hand IS NULL AND NEW.qty IS NOT NULL THEN NEW.qty_on_hand := NEW.qty;
  ELSIF NEW.qty IS NULL AND NEW.qty_on_hand IS NOT NULL THEN NEW.qty := NEW.qty_on_hand;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.qty_on_hand IS DISTINCT FROM OLD.qty_on_hand AND NEW.qty = OLD.qty THEN NEW.qty := NEW.qty_on_hand;
    ELSIF NEW.qty IS DISTINCT FROM OLD.qty AND NEW.qty_on_hand = OLD.qty_on_hand THEN NEW.qty_on_hand := NEW.qty;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS inventory_sync_qty_trg ON public.inventory;
CREATE TRIGGER inventory_sync_qty_trg
BEFORE INSERT OR UPDATE ON public.inventory
FOR EACH ROW EXECUTE FUNCTION public.inventory_sync_qty();

-- ===== profiles: full_name <-> display_name =====
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text;

UPDATE public.profiles SET full_name = display_name WHERE full_name IS NULL;

CREATE OR REPLACE FUNCTION public.profiles_sync_name()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.full_name IS NULL AND NEW.display_name IS NOT NULL THEN NEW.full_name := NEW.display_name;
  ELSIF NEW.display_name IS NULL AND NEW.full_name IS NOT NULL THEN NEW.display_name := NEW.full_name;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.full_name IS DISTINCT FROM OLD.full_name AND NEW.display_name = OLD.display_name THEN NEW.display_name := NEW.full_name;
    ELSIF NEW.display_name IS DISTINCT FROM OLD.display_name AND NEW.full_name = OLD.full_name THEN NEW.full_name := NEW.display_name;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profiles_sync_name_trg ON public.profiles;
CREATE TRIGGER profiles_sync_name_trg
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_sync_name();

-- ===== accounts: owner_pin (raw, opcional) e modules =====
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS owner_pin text,
  ADD COLUMN IF NOT EXISTS modules jsonb DEFAULT '{}'::jsonb;

-- ===== accounts_payable: supplier_name, category, store_id =====
ALTER TABLE public.accounts_payable
  ADD COLUMN IF NOT EXISTS supplier_name text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id);

-- ===== fiscal_documents: contingency_mode =====
ALTER TABLE public.fiscal_documents
  ADD COLUMN IF NOT EXISTS contingency_mode boolean NOT NULL DEFAULT false;

-- ===== product_variants: auto-preencher account_id =====
CREATE OR REPLACE FUNCTION public.pv_fill_account_id()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.account_id IS NULL THEN
    SELECT account_id INTO NEW.account_id FROM public.products WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pv_fill_account_id_trg ON public.product_variants;
CREATE TRIGGER pv_fill_account_id_trg
BEFORE INSERT ON public.product_variants
FOR EACH ROW EXECUTE FUNCTION public.pv_fill_account_id();

ALTER TABLE public.product_variants ALTER COLUMN account_id DROP NOT NULL;

-- Mesma coisa pra product_variant_images, product_price_tiers, product_presentations, product_images
CREATE OR REPLACE FUNCTION public.pvi_fill_account_id()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.account_id IS NULL THEN
    SELECT account_id INTO NEW.account_id FROM public.product_variants WHERE id = NEW.variant_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pvi_fill_account_id_trg ON public.product_variant_images;
CREATE TRIGGER pvi_fill_account_id_trg
BEFORE INSERT ON public.product_variant_images
FOR EACH ROW EXECUTE FUNCTION public.pvi_fill_account_id();

ALTER TABLE public.product_variant_images ALTER COLUMN account_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.prod_child_fill_account_id()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.account_id IS NULL THEN
    SELECT account_id INTO NEW.account_id FROM public.products WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pi_fill_account_id_trg ON public.product_images;
CREATE TRIGGER pi_fill_account_id_trg BEFORE INSERT ON public.product_images
FOR EACH ROW EXECUTE FUNCTION public.prod_child_fill_account_id();
ALTER TABLE public.product_images ALTER COLUMN account_id DROP NOT NULL;

DROP TRIGGER IF EXISTS ppt_fill_account_id_trg ON public.product_price_tiers;
CREATE TRIGGER ppt_fill_account_id_trg BEFORE INSERT ON public.product_price_tiers
FOR EACH ROW EXECUTE FUNCTION public.prod_child_fill_account_id();
ALTER TABLE public.product_price_tiers ALTER COLUMN account_id DROP NOT NULL;

DROP TRIGGER IF EXISTS pp_fill_account_id_trg ON public.product_presentations;
CREATE TRIGGER pp_fill_account_id_trg BEFORE INSERT ON public.product_presentations
FOR EACH ROW EXECUTE FUNCTION public.prod_child_fill_account_id();
ALTER TABLE public.product_presentations ALTER COLUMN account_id DROP NOT NULL;

DROP TRIGGER IF EXISTS ped_fill_account_id_trg ON public.product_expiration_dates;
CREATE TRIGGER ped_fill_account_id_trg BEFORE INSERT ON public.product_expiration_dates
FOR EACH ROW EXECUTE FUNCTION public.prod_child_fill_account_id();
ALTER TABLE public.product_expiration_dates ALTER COLUMN account_id DROP NOT NULL;

-- ===== product_variant_images: image_url <-> url =====
ALTER TABLE public.product_variant_images
  ADD COLUMN IF NOT EXISTS image_url text;

UPDATE public.product_variant_images SET image_url = url WHERE image_url IS NULL;

CREATE OR REPLACE FUNCTION public.pvi_sync_image_url()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.image_url IS NULL AND NEW.url IS NOT NULL THEN NEW.image_url := NEW.url;
  ELSIF NEW.url IS NULL AND NEW.image_url IS NOT NULL THEN NEW.url := NEW.image_url;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.image_url IS DISTINCT FROM OLD.image_url AND NEW.url = OLD.url THEN NEW.url := NEW.image_url;
    ELSIF NEW.url IS DISTINCT FROM OLD.url AND NEW.image_url = OLD.image_url THEN NEW.image_url := NEW.url;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pvi_sync_image_url_trg ON public.product_variant_images;
CREATE TRIGGER pvi_sync_image_url_trg
BEFORE INSERT OR UPDATE ON public.product_variant_images
FOR EACH ROW EXECUTE FUNCTION public.pvi_sync_image_url();

ALTER TABLE public.product_variant_images ALTER COLUMN url DROP NOT NULL;

-- ===== product_price_tiers: label, unit_price =====
ALTER TABLE public.product_price_tiers
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS unit_price numeric(14,2);

UPDATE public.product_price_tiers SET unit_price = price WHERE unit_price IS NULL;

CREATE OR REPLACE FUNCTION public.ppt_sync_price()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.unit_price IS NULL AND NEW.price IS NOT NULL THEN NEW.unit_price := NEW.price;
  ELSIF NEW.price IS NULL AND NEW.unit_price IS NOT NULL THEN NEW.price := NEW.unit_price;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.unit_price IS DISTINCT FROM OLD.unit_price AND NEW.price = OLD.price THEN NEW.price := NEW.unit_price;
    ELSIF NEW.price IS DISTINCT FROM OLD.price AND NEW.unit_price = OLD.unit_price THEN NEW.unit_price := NEW.price;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS ppt_sync_price_trg ON public.product_price_tiers;
CREATE TRIGGER ppt_sync_price_trg
BEFORE INSERT OR UPDATE ON public.product_price_tiers
FOR EACH ROW EXECUTE FUNCTION public.ppt_sync_price();

ALTER TABLE public.product_price_tiers ALTER COLUMN price DROP NOT NULL;

-- ===== product_presentations: conversion_factor + flags + gtin =====
ALTER TABLE public.product_presentations
  ADD COLUMN IF NOT EXISTS conversion_factor numeric(14,4),
  ADD COLUMN IF NOT EXISTS is_purchase boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_sale boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS gtin text,
  ADD COLUMN IF NOT EXISTS purchase_unit_code text;

UPDATE public.product_presentations SET conversion_factor = factor WHERE conversion_factor IS NULL;

CREATE OR REPLACE FUNCTION public.pp_sync_factor()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.conversion_factor IS NULL AND NEW.factor IS NOT NULL THEN NEW.conversion_factor := NEW.factor;
  ELSIF NEW.factor IS NULL AND NEW.conversion_factor IS NOT NULL THEN NEW.factor := NEW.conversion_factor;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.conversion_factor IS DISTINCT FROM OLD.conversion_factor AND NEW.factor = OLD.factor THEN NEW.factor := NEW.conversion_factor;
    ELSIF NEW.factor IS DISTINCT FROM OLD.factor AND NEW.conversion_factor = OLD.conversion_factor THEN NEW.conversion_factor := NEW.factor;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pp_sync_factor_trg ON public.product_presentations;
CREATE TRIGGER pp_sync_factor_trg
BEFORE INSERT OR UPDATE ON public.product_presentations
FOR EACH ROW EXECUTE FUNCTION public.pp_sync_factor();

ALTER TABLE public.product_presentations ALTER COLUMN factor DROP NOT NULL;

-- ===== product_expiration_dates: expiration_date <-> expires_at; qty_on_hand <-> qty =====
ALTER TABLE public.product_expiration_dates
  ADD COLUMN IF NOT EXISTS expiration_date date,
  ADD COLUMN IF NOT EXISTS qty_on_hand numeric(14,3);

UPDATE public.product_expiration_dates SET expiration_date = expires_at WHERE expiration_date IS NULL;
UPDATE public.product_expiration_dates SET qty_on_hand = qty WHERE qty_on_hand IS NULL;

CREATE OR REPLACE FUNCTION public.ped_sync()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.expiration_date IS NULL AND NEW.expires_at IS NOT NULL THEN NEW.expiration_date := NEW.expires_at;
  ELSIF NEW.expires_at IS NULL AND NEW.expiration_date IS NOT NULL THEN NEW.expires_at := NEW.expiration_date;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.expiration_date IS DISTINCT FROM OLD.expiration_date AND NEW.expires_at = OLD.expires_at THEN NEW.expires_at := NEW.expiration_date;
    ELSIF NEW.expires_at IS DISTINCT FROM OLD.expires_at AND NEW.expiration_date = OLD.expiration_date THEN NEW.expiration_date := NEW.expires_at;
    END IF;
  END IF;
  IF NEW.qty_on_hand IS NULL AND NEW.qty IS NOT NULL THEN NEW.qty_on_hand := NEW.qty;
  ELSIF NEW.qty IS NULL AND NEW.qty_on_hand IS NOT NULL THEN NEW.qty := NEW.qty_on_hand;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.qty_on_hand IS DISTINCT FROM OLD.qty_on_hand AND NEW.qty = OLD.qty THEN NEW.qty := NEW.qty_on_hand;
    ELSIF NEW.qty IS DISTINCT FROM OLD.qty AND NEW.qty_on_hand = OLD.qty_on_hand THEN NEW.qty_on_hand := NEW.qty;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS ped_sync_trg ON public.product_expiration_dates;
CREATE TRIGGER ped_sync_trg
BEFORE INSERT OR UPDATE ON public.product_expiration_dates
FOR EACH ROW EXECUTE FUNCTION public.ped_sync();

ALTER TABLE public.product_expiration_dates ALTER COLUMN expires_at DROP NOT NULL;
ALTER TABLE public.product_expiration_dates ALTER COLUMN qty DROP NOT NULL;
