import { Link } from 'react-router-dom';
import { TyposLogo } from '@/components/brand/TyposLogo';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useEffect, useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';

const API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-api/v1`;

const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
  <section id={id} className="scroll-mt-24 space-y-3">
    <h2 className="text-2xl font-bold">{title}</h2>
    {children}
  </section>
);

const Code = ({ children }: { children: React.ReactNode }) => (
  <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto border"><code>{children}</code></pre>
);

const Endpoint = ({ method, path, desc, params, example }: { method: string; path: string; desc: string; params?: { name: string; desc: string }[]; example: string }) => (
  <Card className="p-4 space-y-3">
    <div className="flex items-center gap-2 flex-wrap">
      <Badge className="bg-emerald-600 hover:bg-emerald-600">{method}</Badge>
      <code className="font-mono text-sm">{path}</code>
    </div>
    <p className="text-sm text-muted-foreground">{desc}</p>
    {params && params.length > 0 && (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Parâmetros</p>
        <ul className="text-xs space-y-0.5">
          {params.map(p => <li key={p.name}><code className="font-mono">{p.name}</code> — {p.desc}</li>)}
        </ul>
      </div>
    )}
    <Code>{example}</Code>
  </Card>
);

export default function ApiDocs() {
  const [query, setQuery] = useState('');

  useEffect(() => {
    document.title = 'API Pública — Typos! ERP';
    const meta = document.querySelector('meta[name="description"]');
    const desc = 'Documentação completa da API pública do Typos! ERP: produtos, estoque, vendas, clientes e webhooks em tempo real.';
    if (meta) meta.setAttribute('content', desc);
    else { const m = document.createElement('meta'); m.name = 'description'; m.content = desc; document.head.appendChild(m); }
  }, []);

  const q = query.trim().toLowerCase();

  // Apply filter: hide sections whose text doesn't include the query
  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>('main section[id]');
    let visibleIds = new Set<string>();
    sections.forEach(s => {
      const match = !q || s.textContent?.toLowerCase().includes(q);
      s.style.display = match ? '' : 'none';
      if (match) visibleIds.add(s.id);
    });
    // Toggle TOC items
    document.querySelectorAll<HTMLAnchorElement>('aside nav a[href^="#"]').forEach(a => {
      const id = a.getAttribute('href')?.slice(1) || '';
      a.style.display = !q || visibleIds.has(id) ? '' : 'none';
    });
    // Toggle "no results" message
    const empty = document.getElementById('apidocs-empty');
    if (empty) empty.style.display = q && visibleIds.size === 0 ? '' : 'none';
  }, [q]);

  return (
    <div className="min-h-screen bg-background font-['Outfit']">
      {/* Header */}
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="container max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <TyposLogo className="h-7 w-auto" />
            <span className="text-sm text-muted-foreground hidden sm:inline">/ API</span>
          </Link>
          <div className="relative flex-1 max-w-md ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar na documentação…"
              className="pl-9 pr-9 h-9"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted text-muted-foreground"
                aria-label="Limpar pesquisa"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Link to="/app/developers" className="text-sm text-primary hover:underline shrink-0 hidden sm:inline">Painel de desenvolvedores →</Link>
        </div>
      </header>

      <div className="container max-w-6xl mx-auto px-4 py-8 grid md:grid-cols-[220px_1fr] gap-8">
        {/* TOC */}
        <aside className="hidden md:block">
          <nav className="sticky top-20 space-y-1 text-sm">
            {[
              ['intro', 'Introdução'],
              ['openapi', 'OpenAPI / Swagger'],
              ['auth', 'Autenticação'],
              ['pagination', 'Paginação'],
              ['errors', 'Erros'],
              ['sandbox', 'Modo Sandbox'],
              ['guides', 'Guias de Integração'],
              ['woocommerce', 'Plugin WooCommerce'],
              ['woo-connect', 'Conectando ERP ↔ WordPress'],
              ['products', 'Produtos'],
              ['stock', 'Estoque'],
              ['sales', 'Vendas'],
              ['customers', 'Clientes'],
              ['stores', 'Lojas'],
              ['webhooks', 'Webhooks'],
            ].map(([id, label]) => (
              <a key={id} href={`#${id}`} className="block px-3 py-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                {label}
              </a>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="space-y-12 min-w-0">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-3">API Pública — Typos! ERP</h1>
            <p className="text-lg text-muted-foreground">
              REST sobre HTTPS, JSON, autenticação por chave Bearer. Pensada para integrar marketplaces, BI, contabilidade, e-commerces e sistemas próprios ao seu ERP.
            </p>
            <p className="mt-2 text-sm">
              <span className="text-muted-foreground">Base URL:</span>{' '}
              <code className="font-mono bg-muted px-2 py-0.5 rounded text-sm">{API_BASE}</code>
            </p>
          </div>

          <div id="apidocs-empty" style={{ display: 'none' }} className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhum resultado encontrado para <strong className="text-foreground">"{q}"</strong>. Tente outro termo.
          </div>

          <Section id="intro" title="Introdução">
            <p className="text-sm text-muted-foreground">
              A v1 disponibiliza endpoints de <strong>leitura, escrita</strong> (produtos, clientes, estoque) + <strong>webhooks</strong> em tempo real.
              Vendas continuam apenas como leitura nesta versão (escrita prevista para v2 com regras de PDV/fiscal).
              Cada chave é vinculada a uma conta (loja) e tem escopos granulares. Crie e revogue chaves no{' '}
              <Link to="/app/developers" className="text-primary hover:underline">painel de desenvolvedores</Link>.
            </p>
          </Section>

          <Section id="openapi" title="OpenAPI / Swagger">
            {(() => {
              const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
              const openapiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-api/openapi.json?apikey=${anon}`;
              return (
                <>
                  <p className="text-sm text-muted-foreground">
                    Esta documentação é <strong>gerada a partir das rotas reais</strong> do backend. A especificação OpenAPI 3.1 é a fonte única de verdade —
                    use-a para gerar SDKs (openapi-generator, openapi-typescript, etc.), importar no Postman/Insomnia ou alimentar ferramentas próprias.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={openapiUrl}
                      target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90"
                    >Baixar openapi.json</a>
                    <a
                      href={`https://petstore.swagger.io/?url=${encodeURIComponent(openapiUrl)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm hover:bg-muted"
                    >Abrir no Swagger Editor</a>
                    <a
                      href={`https://redocly.github.io/redoc/?url=${encodeURIComponent(openapiUrl)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm hover:bg-muted"
                    >Visualizar no Redoc</a>
                  </div>
                  <div className="rounded-lg overflow-hidden border bg-card">
                    <iframe
                      title="Swagger UI"
                      src={`data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><html><head><meta charset="utf-8"/><title>Swagger UI</title><link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"/><style>body{margin:0}</style></head><body><div id="ui"></div><script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script><script>window.ui=SwaggerUIBundle({url:'${openapiUrl}',dom_id:'#ui',deepLinking:true,docExpansion:'list'});</script></body></html>`)}`}
                      className="w-full"
                      style={{ height: 720, border: 0 }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Dica: gere um cliente TypeScript com{' '}
                    <code className="font-mono">npx openapi-typescript "{openapiUrl}" -o typos-api.d.ts</code>
                  </p>
                </>
              );
            })()}
          </Section>

          <Section id="woocommerce" title="Plugin WooCommerce (oficial)">
            <p className="text-sm text-muted-foreground">
              Plugin PHP oficial do <strong>Typos! ERP</strong> para WordPress + WooCommerce. Instala um painel próprio,
              sincroniza produtos do ERP para a loja, abate estoque automaticamente quando um pedido é pago/processado e
              recebe webhooks com verificação HMAC-SHA256.
            </p>
            <div className="rounded-xl border bg-gradient-to-br from-card to-muted/30 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-base font-semibold">typos-erp-woocommerce <span className="text-xs text-muted-foreground font-normal">v1.0.0 · GPL-2.0+</span></div>
                  <div className="text-xs text-muted-foreground">Requer WordPress 5.8+, PHP 7.4+ e WooCommerce 6.0+</div>
                </div>
                <a
                  href="https://typoserp.com.br/downloads/typos-erp-woocommerce.zip"
                  download
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90"
                >
                  Baixar plugin (.zip)
                </a>
              </div>
              <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                <li>Painel administrativo com a identidade visual do Typos! ERP.</li>
                <li>Pull manual + cron diário de produtos (cria/atualiza por SKU).</li>
                <li>Push de estoque por pedido WooCommerce (usa <code className="font-mono">/v1/stock/adjust</code>).</li>
                <li>Upsert de cliente a cada pedido (usa <code className="font-mono">/v1/customers</code>).</li>
                <li>Endpoint de webhook em <code className="font-mono">/wp-json/typos-erp/v1/webhook</code> com assinatura HMAC.</li>
                <li>Suporte a chaves <code className="font-mono">tps_live_…</code> e <code className="font-mono">tps_test_…</code>.</li>
              </ul>
              <div className="text-sm">
                <div className="font-semibold mb-1">Como instalar</div>
                <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                  <li>Baixe o .zip acima.</li>
                  <li>No WordPress, vá em <em>Plugins → Adicionar novo → Enviar plugin</em> e selecione o arquivo.</li>
                  <li>Ative o plugin e abra <em>Typos! ERP → Configurações</em>.</li>
                  <li>Cole sua chave de API, escolha o ambiente (live/test) e o ID da loja padrão.</li>
                  <li>Clique em <em>Testar conexão</em> e depois em <em>Sincronizar produtos agora</em>.</li>
                </ol>
              </div>
            </div>
          </Section>

          <Section id="woo-connect" title="Conectando o ERP ao WordPress (passo a passo)">
            <p className="text-sm text-muted-foreground">
              Guia completo para o lojista plugar o <strong>Typos! ERP</strong> em uma loja WordPress + WooCommerce
              usando o plugin oficial. São <strong>3 etapas</strong>: gerar a chave no ERP, configurar o plugin no WP
              e (opcional) registrar o webhook do ERP para o WP.
            </p>

            {/* Diagrama */}
            <div className="rounded-xl border bg-muted/30 p-4 overflow-x-auto">
              <pre className="text-xs leading-relaxed font-mono">{`  ┌──────────────────┐    1. produtos / estoque (pull diário ou manual)    ┌────────────────────┐
  │                  │ ─────────────────────────────────────────────────▶ │                    │
  │   Typos! ERP     │                                                    │  WordPress + Woo   │
  │  (API pública)   │ ◀───────────────────────────────────────────────── │  (plugin Typos!)   │
  │                  │    2. pedido pago no Woo → abate estoque no ERP    │                    │
  │                  │                                                    │                    │
  │                  │ ─────────────────────────────────────────────────▶ │                    │
  └──────────────────┘    3. webhook do ERP (sale.paid, stock.changed)    └────────────────────┘`}</pre>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border p-4 space-y-2">
                <div className="text-sm font-semibold">Etapa 1 — Gerar a chave de API no Typos! ERP</div>
                <ol className="list-decimal pl-5 text-sm text-muted-foreground space-y-1">
                  <li>Entre no ERP e vá em <em>Desenvolvedores → Conectores via API</em> (<code className="font-mono">/app/api-connectors</code>).</li>
                  <li>Clique no card <strong>WooCommerce</strong> e em <em>Instalar</em>.</li>
                  <li>O sistema gera uma chave no formato <code className="font-mono">tps_live_xxxxxxxx…</code> com os escopos:
                    <code className="font-mono"> products:read/write, stock:read/write, sales:read, customers:read</code>.
                  </li>
                  <li><strong>Copie a chave imediatamente</strong> — ela só é exibida uma vez.</li>
                  <li>Anote também o <strong>ID da loja</strong> (UUID) que aparece em <em>Lojas</em>, caso você tenha mais de uma.</li>
                </ol>
                <p className="text-xs text-muted-foreground">
                  Dica: para testar antes, gere uma chave <code className="font-mono">tps_test_…</code> — escritas rodam em
                  dry-run e não persistem.
                </p>
              </div>

              <div className="rounded-lg border p-4 space-y-2">
                <div className="text-sm font-semibold">Etapa 2 — Configurar o plugin no WordPress</div>
                <ol className="list-decimal pl-5 text-sm text-muted-foreground space-y-1">
                  <li>Baixe o plugin (.zip) na seção acima e instale em <em>Plugins → Adicionar novo → Enviar plugin</em>.</li>
                  <li>Ative o plugin. Um novo menu <strong>Typos! ERP</strong> aparece na barra lateral do WP-Admin.</li>
                  <li>Vá em <em>Typos! ERP → Configurações</em> e preencha:
                    <ul className="list-disc pl-5 mt-1 space-y-0.5">
                      <li><strong>API Key</strong>: cole a chave <code className="font-mono">tps_live_…</code> da Etapa 1.</li>
                      <li><strong>Ambiente</strong>: <em>Produção</em> (live) ou <em>Sandbox</em> (test).</li>
                      <li><strong>ID da loja padrão</strong>: o UUID da loja no ERP.</li>
                      <li><strong>Abater estoque no Typos!</strong> quando o pedido WooCommerce for processado/pago.</li>
                      <li><strong>Sincronização diária</strong> de produtos (cron) — opcional.</li>
                    </ul>
                  </li>
                  <li>Clique em <em>Salvar</em> e em <strong>Testar conexão</strong> — deve aparecer ✅ <em>Conexão OK</em>.</li>
                  <li>Clique em <strong>Sincronizar produtos agora</strong> para puxar o catálogo do ERP para o WooCommerce.</li>
                </ol>
              </div>

              <div className="rounded-lg border p-4 space-y-2">
                <div className="text-sm font-semibold">Etapa 3 — (Opcional) Registrar webhook do ERP no WP</div>
                <p className="text-sm text-muted-foreground">
                  Para que o ERP notifique o WordPress em <strong>tempo real</strong> (vendas pagas pelo PDV, alterações de estoque etc.),
                  registre o endpoint exposto pelo plugin como webhook no Typos!.
                </p>
                <ol className="list-decimal pl-5 text-sm text-muted-foreground space-y-1">
                  <li>No plugin, em <em>Configurações</em>, copie a <strong>URL do webhook</strong>:
                    <Code>{`https://SEU-DOMINIO.com.br/wp-json/typos-erp/v1/webhook`}</Code>
                    e o <strong>Webhook Secret</strong> exibido na mesma tela.
                  </li>
                  <li>No ERP, vá em <em>Desenvolvedores → Webhooks</em> (<code className="font-mono">/app/developers</code>) e clique em <em>Novo webhook</em>.</li>
                  <li>Cole a URL, o segredo, e marque os eventos:
                    <code className="font-mono"> sale.paid, sale.canceled, stock.changed, product.updated</code>.
                  </li>
                  <li>Salve. O ERP passará a enviar POSTs assinados com header <code className="font-mono">X-Typos-Signature</code> (HMAC-SHA256).</li>
                </ol>
              </div>

              <div className="rounded-lg border p-4">
                <div className="text-sm font-semibold mb-2">Resumo do fluxo de dados</div>
                <div className="overflow-x-auto">
                  <table className="text-sm w-full">
                    <thead className="text-xs text-muted-foreground">
                      <tr className="border-b"><th className="text-left py-1.5 pr-3">Direção</th><th className="text-left py-1.5 pr-3">Quando dispara</th><th className="text-left py-1.5">O que acontece</th></tr>
                    </thead>
                    <tbody className="text-muted-foreground">
                      <tr className="border-b"><td className="py-1.5 pr-3">Typos! → Woo</td><td className="py-1.5 pr-3">Pull manual ou cron diário</td><td className="py-1.5">Plugin chama <code className="font-mono">GET /v1/products</code> e cria/atualiza no Woo por SKU/GTIN.</td></tr>
                      <tr className="border-b"><td className="py-1.5 pr-3">Woo → Typos!</td><td className="py-1.5 pr-3">Pedido pago/processado no Woo</td><td className="py-1.5">Plugin chama <code className="font-mono">POST /v1/stock/adjust</code> e <code className="font-mono">POST /v1/customers</code>.</td></tr>
                      <tr><td className="py-1.5 pr-3">Typos! → Woo</td><td className="py-1.5 pr-3">Venda paga no PDV / estoque alterado no ERP</td><td className="py-1.5">ERP envia webhook para <code className="font-mono">/wp-json/typos-erp/v1/webhook</code> assinado com HMAC.</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-4 text-sm text-amber-900 dark:text-amber-200">
                <div className="font-semibold mb-1">Solução de problemas</div>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>401 / chave inválida:</strong> confirme que copiou a chave inteira e que ela não foi revogada em <em>Conectores via API</em>.</li>
                  <li><strong>403 / falta de escopo:</strong> reinstale o conector para regerar com todos os escopos exigidos pelo plugin.</li>
                  <li><strong>Webhook não chega:</strong> teste a URL pública do WP em um navegador (deve responder 405 ao GET) e confira o segredo.</li>
                  <li><strong>Estoque não baixa:</strong> verifique se a opção <em>“Abater estoque no Typos!”</em> está ativa e que o pedido WooCommerce está em status <em>processing/completed</em>.</li>
                </ul>
              </div>
            </div>
          </Section>

          <Section id="auth" title="Autenticação">
            <p className="text-sm text-muted-foreground">
              Envie sua chave no cabeçalho HTTP <code className="font-mono">Authorization</code>.
              Existem dois tipos de chave:
            </p>
            <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
              <li><code className="font-mono">tps_live_…</code> — chamadas reais, leem e gravam no banco da sua loja.</li>
              <li><code className="font-mono">tps_test_…</code> — modo <strong>sandbox</strong>: as requisições são autenticadas e validadas normalmente, mas operações de escrita executam em <strong>dry-run</strong> (não persistem). Respostas incluem <code>"_test_dry_run": true</code>.</li>
            </ul>
            <Code>{`Authorization: Bearer tps_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`}</Code>
            <p className="text-sm text-muted-foreground">
              Erros de auth retornam HTTP <code>401</code>. Se faltar escopo, HTTP <code>403</code>.
            </p>
          </Section>

          <Section id="pagination" title="Paginação">
            <p className="text-sm text-muted-foreground">
              Endpoints de listagem aceitam <code>page</code> (default 1) e <code>limit</code> (default 50, máximo 100).
              A resposta inclui <code className="font-mono">pagination</code> e o cabeçalho <code className="font-mono">X-Total-Count</code>.
            </p>
            <Code>{`GET /v1/products?page=2&limit=50`}</Code>
            <Code>{`{
  "data": [ ... ],
  "pagination": { "page": 2, "limit": 50, "total": 312, "total_pages": 7 }
}`}</Code>
            <p className="text-sm text-muted-foreground pt-2">
              <strong>Cursor (recomendado para sincronizações grandes):</strong> use <code>cursor</code> em vez de <code>page</code>.
              É determinístico mesmo quando vários registros têm o mesmo <code>updated_at</code>, e evita pular ou repetir itens entre páginas.
              No modo cursor, <code>X-Total-Count</code> é omitido e a resposta inclui <code>next_cursor</code> (null quando acabou).
            </p>
            <Code>{`GET /v1/products?cursor=eyJsYXN0X2F0IjoiMjAyNi0wMS0xMlQxMjozNDowMFoiLCJsYXN0X2lkIjoiYWJjLTEyMyJ9&limit=100`}</Code>
            <Code>{`{
  "data": [ ... ],
  "pagination": {
    "limit": 100,
    "next_cursor": "eyJsYXN0X2F0IjoiMjAyNi0wMS0xMVQxNzoxMjowMFoiLCJsYXN0X2lkIjoiZGVmLTQ1NiJ9",
    "has_more": true
  }
}`}</Code>
          </Section>

          <Section id="errors" title="Erros">
            <Code>{`{
  "error": {
    "code": "forbidden",
    "message": "Escopo \\"sales:read\\" necessário para este endpoint"
  }
}`}</Code>
            <p className="text-sm text-muted-foreground">
              Códigos: <code>unauthorized</code> (401), <code>forbidden</code> (403), <code>not_found</code> (404),{' '}
              <code>method_not_allowed</code> (405), <code>validation_error</code> (422),{' '}
              <code>invalid_body</code> (400), <code>insert_error</code> / <code>update_error</code> / <code>delete_error</code> (400),{' '}
              <code>query_error</code> / <code>internal_error</code> (500).
            </p>
          </Section>

          <Section id="sandbox" title="Modo Sandbox (tps_test_)">
            <p className="text-sm text-muted-foreground">
              Chaves <code className="font-mono">tps_test_</code> permitem testar integrações com segurança.
              Leituras (<code>GET</code>) funcionam normalmente. Escritas (<code>POST</code>, <code>PATCH</code>,
              <code>DELETE</code>) executam em <strong>dry-run</strong>: o payload é validado e a resposta é simulada,
              mas <strong>nada é gravado no banco</strong>. Toda resposta de escrita em sandbox inclui o campo
              <code className="font-mono"> _test_dry_run: true</code>.
            </p>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mt-3">Request</p>
            <Code>{`curl -X POST \\
  -H "Authorization: Bearer tps_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{ "name": "Cadeira Teste", "sku": "TEST-001", "price_default": 199.90 }' \\
  "${API_BASE}/products"`}</Code>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mt-3">Response (HTTP 201)</p>
            <p className="text-xs text-muted-foreground">
              Cabeçalhos da resposta incluem <code className="font-mono">X-Typos-Environment: test</code> e{' '}
              <code className="font-mono">X-Typos-Dry-Run: true</code>.
            </p>
            <Code>{`{
  "data": {
    "id": "5b2c3a4d-1f2e-4a3b-9c8d-7e6f5a4b3c2d",
    "name": "Cadeira Teste",
    "sku": "TEST-001",
    "price_default": 199.90,
    "_test_dry_run": true,
    "created_at": "2026-05-12T12:00:00.000Z"
  }
}`}</Code>
            <p className="text-sm text-muted-foreground">
              Use o <Link to="/app/developers" className="text-primary hover:underline">Console de teste</Link> no painel
              de desenvolvedores para experimentar sem precisar montar um <code>curl</code>.
            </p>
          </Section>

          <Section id="guides" title="Guias de Integração">
            <p className="text-sm text-muted-foreground">
              Existem três modelos para conectar o Typos! ERP a outros sistemas (e-commerce, marketplaces,
              BI, contabilidade, ERPs próprios). Escolha o que fizer mais sentido para o seu caso —
              todos usam a mesma API pública abaixo.
            </p>

            <div className="grid md:grid-cols-3 gap-3">
              <Card className="p-4 space-y-1">
                <Badge variant="secondary">Modelo A</Badge>
                <p className="text-sm font-medium">No-code (Zapier, Make, n8n)</p>
                <p className="text-xs text-muted-foreground">
                  O lojista cola a API Key num "conector HTTP" e monta o fluxo arrastando blocos.
                  Sem programação. Ideal para começar rápido.
                </p>
              </Card>
              <Card className="p-4 space-y-1">
                <Badge variant="secondary">Modelo B</Badge>
                <p className="text-sm font-medium">HTTP direto / middleware</p>
                <p className="text-xs text-muted-foreground">
                  Um dev faz <code>fetch</code>/<code>curl</code> contra a API e escuta os webhooks.
                  Melhor para Nuvemshop, Tray, Shopify, Power BI, apps próprios.
                </p>
              </Card>
              <Card className="p-4 space-y-1">
                <Badge variant="secondary">Modelo C</Badge>
                <p className="text-sm font-medium">Plugin nativo (WooCommerce)</p>
                <p className="text-xs text-muted-foreground">
                  Plugin oficial Typos! para WordPress/WooCommerce — <strong>disponível</strong>. Baixe o
                  <code className="mx-1">.zip</code> diretamente em <a href="https://typoserp.com.br/downloads/typos-erp-woocommerce.zip" className="text-primary hover:underline" download="typos-erp-woocommerce.zip">/downloads/typos-erp-woocommerce.zip</a>.
                </p>
              </Card>
            </div>

            <Card className="p-4 space-y-2">
              <p className="text-sm font-medium">Fluxo típico de uma integração de e-commerce</p>
              <Code>{`  ┌──────────────┐    POST /v1/sales         ┌──────────────┐
  │  Loja online │ ────────────────────────► │  Typos! ERP  │
  │ (Shopify,    │                           │  (API v1)    │
  │  Nuvemshop,  │ ◄──────────────────────── │              │
  │  WooCom...)  │   webhook stock.changed   └──────────────┘
  └──────────────┘`}</Code>
              <p className="text-xs text-muted-foreground">
                Vendas entram no ERP via <code>POST /v1/sales</code> (v2). Cada alteração de estoque
                no ERP dispara um <code>stock.changed</code> de volta para a loja, mantendo o catálogo
                sincronizado.
              </p>
            </Card>

            <Card className="p-4 space-y-2">
              <p className="text-sm font-medium">Nuvemshop / Tray (Modelo B)</p>
              <ol className="text-sm text-muted-foreground list-decimal pl-5 space-y-1">
                <li>Crie uma chave <code>tps_live_</code> no <Link to="/app/developers" className="text-primary hover:underline">painel</Link> com escopos <code>products:write</code>, <code>stock:write</code>, <code>sales:read</code>.</li>
                <li>No app/middleware da plataforma, adicione um job que escuta novos pedidos.</li>
                <li>Para cada pedido, faça <code>POST {API_BASE}/customers</code> e <code>POST /sales</code>.</li>
                <li>Cadastre o webhook <code>stock.changed</code> apontando para sua URL para refletir saldos.</li>
              </ol>
              <Code>{`curl -X POST -H "Authorization: Bearer tps_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Maria","document":"12345678900","email":"maria@x.com"}' \\
  "${API_BASE}/customers"`}</Code>
            </Card>

            <Card className="p-4 space-y-2">
              <p className="text-sm font-medium">Shopify (Modelo B)</p>
              <p className="text-xs text-muted-foreground">
                Crie um <em>Custom App</em> no admin do Shopify, configure um webhook de
                <code> orders/create</code> apontando para uma função sua (ex.: Cloudflare Worker ou
                Edge Function), e dentro dela faça o <code>POST</code> para o Typos!.
                No sentido oposto, o webhook <code>stock.changed</code> do Typos! atualiza o
                <code> inventoryLevel</code> via Shopify Admin GraphQL.
              </p>
            </Card>

            <Card className="p-4 space-y-2">
              <p className="text-sm font-medium">WooCommerce / WordPress (Modelo C — recomendado)</p>
              <p className="text-xs text-muted-foreground">
                <strong>Plugin oficial Typos! disponível.</strong> Baixe o <code>.zip</code> diretamente em
                <a href="https://typoserp.com.br/downloads/typos-erp-woocommerce.zip" className="text-primary hover:underline mx-1" download="typos-erp-woocommerce.zip">/downloads/typos-erp-woocommerce.zip</a>.
                No WordPress vá em <em>Plugins → Adicionar novo →
                Enviar plugin</em>, escolha o arquivo, ative-o, depois acesse o menu <strong>Typos! ERP</strong>
                no admin do WP, cole a API Key gerada e salve. A partir daí, produtos, estoque e pedidos
                sincronizam automaticamente nos dois sentidos — sem Zapier ou middleware.
              </p>
              <p className="text-xs text-muted-foreground">
                Requisitos: WordPress 5.8+, PHP 7.4+, WooCommerce 6.0+.
              </p>
            </Card>

            <Card className="p-4 space-y-2">
              <p className="text-sm font-medium">Zapier / Make / n8n (Modelo A — passo a passo)</p>
              <ol className="text-sm text-muted-foreground list-decimal pl-5 space-y-1">
                <li>No Zapier, crie um Zap com Trigger da plataforma de origem (ex.: "New Order in Shopify").</li>
                <li>Adicione uma ação <strong>"Webhooks by Zapier → Custom Request"</strong>.</li>
                <li>Method: <code>POST</code>. URL: <code>{API_BASE}/sales</code> (quando v2 estiver disponível) ou <code>/customers</code>.</li>
                <li>Headers: <code>Authorization: Bearer tps_live_…</code> e <code>Content-Type: application/json</code>.</li>
                <li>Body: monte o JSON usando os campos do gatilho (nome do cliente, itens, totais).</li>
                <li>Teste com uma chave <code>tps_test_</code> primeiro — você verá <code>"_test_dry_run": true</code> na resposta.</li>
              </ol>
            </Card>

            <Card className="p-4 space-y-2">
              <p className="text-sm font-medium">Power BI / Looker / Metabase (somente leitura)</p>
              <p className="text-xs text-muted-foreground">
                Use uma chave com escopos <code>*:read</code>. No Power BI, em
                <em> Obter dados → Web</em>, configure a URL <code>{API_BASE}/sales?from=…</code>
                e adicione o header <code>Authorization</code>. Atualize sob agendamento. Para
                volumes grandes, use a paginação por <strong>cursor</strong> e o filtro
                <code> updated_since</code>.
              </p>
            </Card>

            <Card className="p-4 space-y-2">
              <p className="text-sm font-medium">FAQ rápido</p>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li><strong>Preciso de alguma liberação especial para usar a API?</strong> Não. Cada lojista gera a própria chave em <em>Desenvolvedores</em> e a integração roda sozinha.</li>
                <li><strong>Posso usar a API sem ser programador?</strong> Sim, via Modelo A (Zapier/Make/n8n) — basta colar a chave.</li>
                <li><strong>Vocês oferecem plugin pronto?</strong> Sim, para WooCommerce — <a href="https://typoserp.com.br/downloads/typos-erp-woocommerce.zip" className="text-primary hover:underline" download="typos-erp-woocommerce.zip">baixe o .zip aqui</a>. Para Shopify, Nuvemshop e Tray, o caminho é Modelo B (API direta) ou Modelo A (Zapier/n8n).</li>
                <li><strong>Como evito gravar dados de teste no banco?</strong> Use chaves <code>tps_test_</code> — toda escrita vira dry-run com <code>"_test_dry_run": true</code>.</li>
                <li><strong>Como sei se estourei algum limite?</strong> Acompanhe pelo painel "Uso" em <Link to="/app/developers" className="text-primary hover:underline">Desenvolvedores</Link>.</li>
              </ul>
            </Card>
          </Section>

          <Section id="products" title="Produtos">
            <Endpoint
              method="GET" path="/v1/products"
              desc="Lista produtos ativos da conta."
              params={[
                { name: 'q', desc: 'busca em nome, SKU e código de barras' },
                { name: 'category', desc: 'filtra por categoria' },
                { name: 'updated_since', desc: 'ISO 8601 — apenas atualizados após' },
              ]}
              example={`curl -H "Authorization: Bearer SUA_KEY" \\
  "${API_BASE}/products?q=cadeira&limit=20"`}
            />
            <Endpoint
              method="GET" path="/v1/products/{id}"
              desc="Retorna um produto pelo ID (UUID)."
              example={`curl -H "Authorization: Bearer SUA_KEY" \\
  "${API_BASE}/products/00000000-0000-0000-0000-000000000000"`}
            />
            <Endpoint
              method="POST" path="/v1/products"
              desc="Cria um produto. Requer escopo products:write. Campo obrigatório: name."
              example={`curl -X POST -H "Authorization: Bearer SUA_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Cadeira Gamer","sku":"CAD-001","gtin":"7891234567890","price_default":899.90,"cost_default":420,"category":"Móveis","unit":"UN"}' \\
  "${API_BASE}/products"`}
            />
            <Endpoint
              method="PATCH" path="/v1/products/{id}"
              desc="Atualiza campos de um produto (parcial). Requer products:write."
              example={`curl -X PATCH -H "Authorization: Bearer SUA_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"price_default":799.90,"promo_price":699.00}' \\
  "${API_BASE}/products/PROD_ID"`}
            />
            <Endpoint
              method="DELETE" path="/v1/products/{id}"
              desc="Soft-delete (marca is_active = false). Requer products:write."
              example={`curl -X DELETE -H "Authorization: Bearer SUA_KEY" \\
  "${API_BASE}/products/PROD_ID"`}
            />
          </Section>

          <Section id="stock" title="Estoque">
            <Endpoint
              method="GET" path="/v1/stock"
              desc="Saldos por loja + produto."
              params={[
                { name: 'store_id', desc: 'filtra por loja' },
                { name: 'product_id', desc: 'filtra por produto' },
                { name: 'updated_since', desc: 'ISO 8601' },
              ]}
              example={`curl -H "Authorization: Bearer SUA_KEY" \\
  "${API_BASE}/stock?updated_since=2026-05-01T00:00:00Z"`}
            />
            <Endpoint
              method="POST" path="/v1/stock/adjust"
              desc="Ajusta o saldo de um produto numa loja. Use qty_on_hand (valor absoluto) OU qty_delta (incremento). Requer stock:write."
              example={`curl -X POST -H "Authorization: Bearer SUA_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"store_id":"STORE_ID","product_id":"PROD_ID","qty_delta":10,"min_qty":2}' \\
  "${API_BASE}/stock/adjust"`}
            />
          </Section>

          <Section id="sales" title="Vendas">
            <Endpoint
              method="GET" path="/v1/sales"
              desc="Lista vendas. Status possíveis: draft, paid, crediario, canceled."
              params={[
                { name: 'status', desc: 'filtra por status' },
                { name: 'store_id', desc: 'filtra por loja' },
                { name: 'from', desc: 'ISO 8601 — created_at >=' },
                { name: 'to', desc: 'ISO 8601 — created_at <=' },
              ]}
              example={`curl -H "Authorization: Bearer SUA_KEY" \\
  "${API_BASE}/sales?status=paid&from=2026-05-01T00:00:00Z"`}
            />
            <Endpoint
              method="GET" path="/v1/sales/{id}"
              desc="Retorna uma venda completa, incluindo itens e pagamentos."
              example={`curl -H "Authorization: Bearer SUA_KEY" \\
  "${API_BASE}/sales/00000000-0000-0000-0000-000000000000"`}
            />
          </Section>

          <Section id="customers" title="Clientes">
            <Endpoint
              method="GET" path="/v1/customers"
              desc="Lista clientes."
              params={[
                { name: 'q', desc: 'busca em nome, email, telefone, documento' },
                { name: 'updated_since', desc: 'ISO 8601' },
              ]}
              example={`curl -H "Authorization: Bearer SUA_KEY" \\
  "${API_BASE}/customers?q=joao"`}
            />
            <Endpoint
              method="POST" path="/v1/customers"
              desc="Cria um cliente. Requer customers:write. Campo obrigatório: name."
              example={`curl -X POST -H "Authorization: Bearer SUA_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"João Silva","document":"12345678900","email":"joao@x.com","phone":"11999999999","credit_authorized":true,"credit_limit":500}' \\
  "${API_BASE}/customers"`}
            />
            <Endpoint
              method="PATCH" path="/v1/customers/{id}"
              desc="Atualiza dados de um cliente (parcial). Requer customers:write."
              example={`curl -X PATCH -H "Authorization: Bearer SUA_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"phone":"11988887777","credit_limit":1000}' \\
  "${API_BASE}/customers/CUST_ID"`}
            />
          </Section>

          <Section id="stores" title="Lojas">
            <Endpoint
              method="GET" path="/v1/stores"
              desc="Lista todas as lojas da conta."
              example={`curl -H "Authorization: Bearer SUA_KEY" \\
  "${API_BASE}/stores"`}
            />
          </Section>

          <Section id="webhooks" title="Webhooks">
            <p className="text-sm text-muted-foreground">
              Cadastre URLs no painel para receber POST com eventos em tempo real. Eventos disponíveis:{' '}
              <code>sale.created</code>, <code>sale.paid</code>, <code>sale.canceled</code>, <code>stock.changed</code>.
            </p>
            <Card className="p-4 space-y-2">
              <p className="text-sm font-medium">Estrutura do POST</p>
              <Code>{`POST https://seu-endpoint.com/webhooks/typos
Content-Type: application/json
X-Typos-Event: sale.paid
X-Typos-Signature: sha256=<hex>
User-Agent: TyposERP-Webhook/1.0

{
  "event": "sale.paid",
  "data": {
    "id": "uuid",
    "order_number": 1234,
    "store_id": "uuid",
    "customer_id": "uuid",
    "status": "paid",
    "total": 199.90
  },
  "timestamp": "2026-05-12T14:00:00.000Z"
}`}</Code>
            </Card>
            <Card className="p-4 space-y-2">
              <p className="text-sm font-medium">Verificação da assinatura (Node.js)</p>
              <Code>{`import crypto from 'node:crypto';

function verify(req, secret) {
  const sig = req.headers['x-typos-signature']; // "sha256=..."
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(req.rawBody)         // body cru, não parseado
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(sig), Buffer.from(expected)
  );
}`}</Code>
            </Card>
            <Card className="p-4 space-y-2">
              <p className="text-sm font-medium">Verificação (PHP)</p>
              <Code>{`<?php
$body = file_get_contents('php://input');
$sig  = $_SERVER['HTTP_X_TYPOS_SIGNATURE'] ?? '';
$expected = 'sha256=' . hash_hmac('sha256', $body, $secret);
if (!hash_equals($sig, $expected)) {
  http_response_code(401); exit;
}`}</Code>
            </Card>
            <p className="text-xs text-muted-foreground">
              Retorne HTTP 2xx em até 15s para confirmar o recebimento. Em caso de falha, retentamos com backoff (1m, 5m, 30m, 2h, 12h). Após 20 falhas consecutivas o endpoint é pausado automaticamente.
            </p>
          </Section>

          <footer className="border-t pt-6 text-xs text-muted-foreground">
            v1 · Última atualização: maio/2026 · <Link to="/" className="text-primary hover:underline">Voltar para o site</Link>
          </footer>
        </main>
      </div>
    </div>
  );
}
