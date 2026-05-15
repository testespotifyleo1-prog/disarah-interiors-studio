UPDATE public.plans
SET features = (
  SELECT jsonb_agg(DISTINCT f)
  FROM jsonb_array_elements(features || '["ai_simulation"]'::jsonb) AS f
)
WHERE slug = 'start' AND NOT (features ? 'ai_simulation');