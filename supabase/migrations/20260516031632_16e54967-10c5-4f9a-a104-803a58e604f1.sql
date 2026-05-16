
-- Site settings (singleton)
CREATE TABLE public.site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_name text NOT NULL DEFAULT 'Disarah Interiores',
  tagline text DEFAULT 'Móveis que transformam ambientes',
  hero_title text DEFAULT 'Móveis com alma para a sua casa',
  hero_subtitle text DEFAULT 'Peças selecionadas para criar ambientes acolhedores, sofisticados e únicos.',
  about_title text DEFAULT 'Sobre a Disarah',
  about_text text DEFAULT 'Há anos transformando casas em lares com curadoria refinada de móveis e decoração. Não trabalhamos com móveis planejados — selecionamos peças prontas, com design e qualidade para você levar hoje.',
  address text DEFAULT 'Av. Silviano Brandão, 1109A - Sagrada Família, Belo Horizonte - MG, 31030-105',
  phone text DEFAULT '(31) 8445-6346',
  email text DEFAULT 'contato@disarahinteriores.com.br',
  whatsapp_number text DEFAULT '5531984456346',
  whatsapp_message text DEFAULT 'Olá! Tenho interesse nos móveis da Disarah Interiores.',
  instagram_url text DEFAULT 'https://instagram.com/disarahinteriores',
  facebook_url text DEFAULT 'https://facebook.com/disarahinteriores',
  hours_weekdays text DEFAULT 'Segunda a Sexta: 9h às 18h',
  hours_saturday text DEFAULT 'Sábado: 9h às 13h',
  hours_sunday text DEFAULT 'Domingo: Fechado',
  show_facebook boolean NOT NULL DEFAULT true,
  show_instagram boolean NOT NULL DEFAULT true,
  primary_color text DEFAULT '#7a1818',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read site_settings" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "Auth manage site_settings" ON public.site_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_site_settings_updated
BEFORE UPDATE ON public.site_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed singleton
INSERT INTO public.site_settings (id) VALUES (gen_random_uuid());

-- Categories
CREATE TABLE public.site_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  cover_path text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read site_categories" ON public.site_categories FOR SELECT USING (true);
CREATE POLICY "Auth manage site_categories" ON public.site_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_site_categories_updated BEFORE UPDATE ON public.site_categories
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Photos
CREATE TABLE public.site_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.site_categories(id) ON DELETE CASCADE,
  image_path text NOT NULL,
  title text,
  caption text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_site_photos_category ON public.site_photos(category_id);

ALTER TABLE public.site_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read site_photos" ON public.site_photos FOR SELECT USING (true);
CREATE POLICY "Auth manage site_photos" ON public.site_photos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('site-photos', 'site-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read site-photos bucket" ON storage.objects FOR SELECT USING (bucket_id = 'site-photos');
CREATE POLICY "Auth upload site-photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'site-photos');
CREATE POLICY "Auth update site-photos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'site-photos');
CREATE POLICY "Auth delete site-photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'site-photos');

-- Seed default categories
INSERT INTO public.site_categories (name, slug, sort_order) VALUES
  ('Sofás', 'sofas', 1),
  ('Mesas', 'mesas', 2),
  ('Cadeiras', 'cadeiras', 3),
  ('Poltronas', 'poltronas', 4),
  ('Camas', 'camas', 5),
  ('Roupeiros', 'roupeiros', 6),
  ('Cômodas', 'comodas', 7),
  ('Racks', 'racks', 8),
  ('Buffets', 'buffets', 9),
  ('Escritório', 'escritorio', 10),
  ('Cozinha', 'cozinha', 11),
  ('Decoração', 'decoracao', 12);
