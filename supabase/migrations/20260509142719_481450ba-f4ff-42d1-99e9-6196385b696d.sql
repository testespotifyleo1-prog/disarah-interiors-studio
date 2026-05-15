-- Corrige vendas com created_at no futuro (bug do seletor de data permitia datas futuras).
-- Estas vendas ficavam invisíveis no menu Vendas (filtro por mês atual) mas apareciam no Dashboard (sem filtro de data).
-- Reposiciona o created_at para o momento atual, preservando o horário original como referência via observações.
UPDATE public.sales
SET created_at = now(),
    updated_at = now()
WHERE created_at > now();