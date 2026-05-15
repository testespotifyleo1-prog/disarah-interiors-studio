# API Pública Typos! — Fase 4

Maturidade da API: **ambiente de teste isolado**, **observabilidade** (logs + dashboard de uso) e **paginação por cursor**. Rate limiting fica de fora (gap conhecido — entra quando houver primitiva de cache/edge).

---

## 1. Sandbox / Test Mode (chaves `tps_test_`)

**Objetivo:** o lojista testa Shopify/WooCommerce/integrações sem mexer em estoque, vendas ou clientes reais.

### Banco
- `api_keys.environment` (enum `live` | `test`, default `live`).
- Geração: chaves de teste com prefixo `tps_test_` em vez de `tps_live_`.
- Nova tabela `api_test_data` (espelho leve, isolada por `account_id`):
  - `test_products`, `test_customers`, `test_sales`, `test_stock`
  - Mesmo schema dos reais, mas em tabelas separadas — zero risco de vazar para dados reais.
  - Botão "Resetar dados de teste" no painel (limpa só essas tabelas + reseed de 10 produtos/5 clientes de exemplo).

### Edge function `public-api`
- Após autenticar a chave, lê `environment`.
- Se `test`: roteia todas as queries para as tabelas `test_*`. Webhooks de teste vão para endpoints com flag `is_test = true`.
- Header de resposta `X-Typos-Environment: test` em toda resposta de chave de teste.

### UI
- Aba "API Keys" ganha **toggle "Live / Test"** no topo.
- Ao criar chave, escolher ambiente (radio).
- Banner laranja persistente quando o usuário estiver vendo chaves de teste: "Modo de teste — nenhum dado real é afetado."
- Botão "Resetar dados de teste" com confirmação.

---

## 2. Logs de Requisições

**Objetivo:** o lojista vê exatamente o que cada app está chamando.

### Banco
- Tabela `api_request_logs`:
  - `id`, `account_id`, `api_key_id`, `environment`, `method`, `path`, `query_params jsonb`, `status_code`, `latency_ms`, `ip`, `user_agent`, `error_code`, `created_at`
  - Índices: `(account_id, created_at desc)`, `(api_key_id, created_at desc)`.
- Retenção: 30 dias (cron diário deleta logs antigos).
- RLS: só owner/admin da `account_id` lê.

### Edge function `public-api`
- Wrapper de log no início/fim de toda request.
- Insert assíncrono (não bloqueia resposta) via `EdgeRuntime.waitUntil(...)`.

### UI — Aba "Logs" (nova) no painel `/app/developers`
- Tabela com filtros: chave, método, status (2xx/4xx/5xx), data, busca por path.
- Colunas: timestamp, método+path, status (badge colorido), latência, chave (prefixo), ambiente.
- Drawer ao clicar: mostra query params, headers relevantes, código de erro completo.
- Paginação 50 por página.

---

## 3. Dashboard de Uso

**Objetivo:** visão executiva — quem está consumindo, quanto, com quais erros.

### UI — Aba "Uso" (nova) no painel `/app/developers`
- Filtro de período (7d, 30d, 90d) e ambiente (live/test/ambos).
- **Cards no topo:**
  - Total de chamadas no período
  - Taxa de erro (4xx + 5xx)
  - Latência média (p50) e p95
  - Chave mais ativa
- **Gráficos:**
  - Linha: chamadas por dia (área stacked por status_code class — 2xx verde, 4xx amarelo, 5xx vermelho).
  - Barra: top 10 endpoints por volume.
  - Barra: top 5 chaves por volume (mostra `key_prefix + name`).
- Implementação: queries agregadas em `api_request_logs` via RPC `get_api_usage_stats(_account, _from, _to, _env)` retornando JSON pronto.
- Recharts (já instalado).

---

## 4. Paginação por Cursor

**Objetivo:** catálogos com 15k+ produtos / históricos longos não travam.

### Endpoints afetados
- `GET /v1/products`, `/v1/sales`, `/v1/customers`, `/v1/stock`

### Mudanças
- Aceita `?cursor=<opaque>&limit=50` além do `page` legado (mantém compat).
- Cursor opaco = base64 de `{ last_id, last_updated_at }`.
- Ordenação fixa: `updated_at desc, id desc`.
- Resposta:
  ```json
  {
    "data": [...],
    "pagination": {
      "limit": 50,
      "next_cursor": "eyJsYXN0X2lkIjoiLi4uIn0=",
      "has_more": true
    }
  }
  ```
- `next_cursor: null` quando acabou.
- Header `X-Total-Count` removido para cursor (custo proibitivo); mantém só no modo `page`.

### Docs
- `/docs/api`: nova seção "Paginação por cursor" com exemplo loop em curl/JS, marcando offset (`page`) como "legado, prefira cursor".

---

## 5. Estrutura Técnica

### Migrations (uma única)
1. `alter table api_keys add column environment text not null default 'live'` + check constraint.
2. Criar `test_products`, `test_customers`, `test_sales`, `test_sale_items`, `test_sale_payments`, `test_stock` (mesmo schema das reais, sem FKs para tabelas reais).
3. Criar `api_request_logs` + índices + RLS + cron de retenção 30d.
4. Criar `webhook_endpoints.is_test boolean default false`.
5. RPC `get_api_usage_stats` (security definer, filtro por `account_id` do `auth.uid()`).
6. RPC `reset_test_data(_account uuid)` (security definer, owner/admin only).

### Edge functions
- `public-api/index.ts`: refatorar router para (a) detectar env da key, (b) escolher namespace de tabela, (c) wrappear log, (d) suportar cursor.
- `api-key-create/index.ts`: aceitar param `environment`.
- `webhook-dispatcher/index.ts`: respeitar `is_test`.

### UI
- `src/pages/app/Developers.tsx`: adicionar abas **Logs** e **Uso**, toggle Live/Test na aba Keys, banner de ambiente.
- Novos componentes:
  - `src/components/developers/EnvironmentToggle.tsx`
  - `src/components/developers/ApiLogsTable.tsx`
  - `src/components/developers/ApiUsageDashboard.tsx`
  - `src/components/developers/ResetTestDataButton.tsx`

### Docs (`/docs/api`)
- Nova seção "Ambiente de teste".
- Nova seção "Paginação por cursor".
- Atualizar exemplos para mostrar uso de `tps_test_`.

---

## Fora do escopo (explícito)
- ❌ Rate limiting (volta quando tivermos cache/edge).
- ❌ OAuth marketplace de apps (Fase 5).
- ❌ Webhooks de teste com replay manual no painel (entra na Fase 5 se houver demanda).

---

## Riscos / mitigação
- **Volume de logs**: 1 insert por request — uso de `waitUntil` desacopla; retenção 30d controla tamanho. Se virar gargalo, particionar por mês.
- **Drift entre tabelas live e test**: migrations sempre aplicadas em ambos schemas — adicionar checklist no PR.
- **Cursor com updated_at duplicado**: tiebreaker por `id` resolve.

Aprova? Após OK rodo a migration, implemento as 3 edge functions atualizadas e a UI.
