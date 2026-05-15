UPDATE public.store_ecommerce_settings 
SET categories = '[
  {"id":"sofas","name":"Sofás","icon":"sofa","image_url":"https://ietaxjtvtrfxtrkjvcso.supabase.co/storage/v1/object/public/store-assets/disarah/cat-sofas.jpg"},
  {"id":"mesas","name":"Mesas","icon":"table","image_url":"https://ietaxjtvtrfxtrkjvcso.supabase.co/storage/v1/object/public/store-assets/disarah/cat-mesas.jpg"},
  {"id":"cadeiras","name":"Cadeiras & Banquetas","icon":"chair","image_url":"https://ietaxjtvtrfxtrkjvcso.supabase.co/storage/v1/object/public/store-assets/disarah/cat-cadeiras.jpg"},
  {"id":"poltronas","name":"Poltronas & Puffs","icon":"armchair","image_url":"https://ietaxjtvtrfxtrkjvcso.supabase.co/storage/v1/object/public/store-assets/disarah/cat-poltronas.jpg"},
  {"id":"camas","name":"Camas & Colchões","icon":"bed","image_url":"https://ietaxjtvtrfxtrkjvcso.supabase.co/storage/v1/object/public/store-assets/disarah/cat-camas.jpg"},
  {"id":"racks","name":"Racks & Painéis","icon":"tv","image_url":"https://ietaxjtvtrfxtrkjvcso.supabase.co/storage/v1/object/public/store-assets/disarah/cat-racks.jpg"},
  {"id":"comodas","name":"Cômodas & Criados","icon":"drawer","image_url":"https://ietaxjtvtrfxtrkjvcso.supabase.co/storage/v1/object/public/store-assets/disarah/cat-comodas.jpg"},
  {"id":"roupeiros","name":"Roupeiros & Armários","icon":"wardrobe","image_url":"https://ietaxjtvtrfxtrkjvcso.supabase.co/storage/v1/object/public/store-assets/disarah/cat-roupeiros.jpg"},
  {"id":"buffets","name":"Buffets & Aparadores","icon":"buffet","image_url":"https://ietaxjtvtrfxtrkjvcso.supabase.co/storage/v1/object/public/store-assets/disarah/cat-buffets.jpg"},
  {"id":"cozinha","name":"Cozinha","icon":"kitchen","image_url":"https://ietaxjtvtrfxtrkjvcso.supabase.co/storage/v1/object/public/store-assets/disarah/cat-cozinha.jpg"},
  {"id":"escritorio","name":"Escritório","icon":"desk","image_url":"https://ietaxjtvtrfxtrkjvcso.supabase.co/storage/v1/object/public/store-assets/disarah/cat-escritorio.jpg"},
  {"id":"decoracao","name":"Decoração","icon":"frame","image_url":"https://ietaxjtvtrfxtrkjvcso.supabase.co/storage/v1/object/public/store-assets/disarah/cat-decoracao.jpg"}
]'::jsonb
WHERE slug = 'disarah-interiores';