
ALTER TABLE public.store_ecommerce_settings 
ADD COLUMN IF NOT EXISTS header_menu jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.store_ecommerce_settings.header_menu IS 'Menu de categorias do cabeçalho com suporte a submenus. Formato: [{"name": "Cat", "icon": "emoji/url", "category": "cat_name", "children": [{"name": "Sub", "category": "sub_cat"}]}]';
