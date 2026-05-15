UPDATE public.store_ecommerce_settings 
SET banner_image_url = 'https://ietaxjtvtrfxtrkjvcso.supabase.co/storage/v1/object/public/store-assets/disarah/hero1.jpg',
    banner_text = 'Móveis Que Transformam Seu Lar',
    hero_subtitle = 'Design exclusivo, qualidade premium e o melhor preço para sua casa',
    inline_banners = '[
      {"id":"b1","image_url":"https://ietaxjtvtrfxtrkjvcso.supabase.co/storage/v1/object/public/store-assets/disarah/hero2.jpg","title":"Quartos Completos com Estilo","link_url":""},
      {"id":"b2","image_url":"https://ietaxjtvtrfxtrkjvcso.supabase.co/storage/v1/object/public/store-assets/disarah/hero3.jpg","title":"Salas de Jantar Elegantes","link_url":""},
      {"id":"b3","image_url":"https://ietaxjtvtrfxtrkjvcso.supabase.co/storage/v1/object/public/store-assets/disarah/banner1.jpg","title":"Salas de Estar | Conforto e Design","link_url":""},
      {"id":"b4","image_url":"https://ietaxjtvtrfxtrkjvcso.supabase.co/storage/v1/object/public/store-assets/disarah/banner2.jpg","title":"Quartos | Sonhos Realizados","link_url":""},
      {"id":"b5","image_url":"https://ietaxjtvtrfxtrkjvcso.supabase.co/storage/v1/object/public/store-assets/disarah/banner3.jpg","title":"Cozinha & Jantar | Momentos em Família","link_url":""}
    ]'::jsonb
WHERE slug = 'disarah-interiores';