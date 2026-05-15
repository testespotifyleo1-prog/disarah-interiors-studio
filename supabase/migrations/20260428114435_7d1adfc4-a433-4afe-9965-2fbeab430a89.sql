UPDATE public.plans
SET features = (
  SELECT jsonb_agg(DISTINCT v)
  FROM jsonb_array_elements_text(features::jsonb || '["ai_simulation"]'::jsonb) v
)::jsonb
WHERE slug IN ('pro', 'multi', 'prime');