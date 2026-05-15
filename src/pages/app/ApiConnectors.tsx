import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  AlertTriangle, Check, CheckCircle2, Copy, ExternalLink, Plug, Puzzle, Trash2, Zap,
  Calculator, Code2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  ShopifyLogo, WooCommerceLogo, ZapierLogo, N8nLogo, PowerBILogo, MakeLogo, NuvemshopLogo, TrayLogo,
} from '@/components/connectors/ConnectorLogos';

const LOGO_MAP: Record<string, React.FC<{ className?: string }>> = {
  shopify: ShopifyLogo,
  woocommerce: WooCommerceLogo,
  zapier: ZapierLogo,
  n8n: N8nLogo,
  make: MakeLogo,
  powerbi: PowerBILogo,
  nuvemshop: NuvemshopLogo,
  tray: TrayLogo,
  contabil: ({ className }) => <Calculator className={className} />,
  custom: ({ className }) => <Code2 className={className} />,
};

type Scope = string;
type EventName = string;

interface Connector {
  id: string;
  name: string;
  category: 'E-commerce' | 'Automação' | 'BI / Contabilidade' | 'Marketplace';
  description: string;
  badge?: string;
  scopes: Scope[];
  events: EventName[];
  needsWebhookUrl: boolean;
  defaultWebhookUrl?: string;
  guideUrl?: string;
  steps: string[];
  color: string;
}

const CONNECTORS: Connector[] = [
  {
    id: 'shopify',
    name: 'Shopify',
    category: 'E-commerce',
    description: 'Sincronize catálogo, estoque e pedidos do Typos! com sua loja Shopify usando uma chave de API dedicada.',
    badge: 'Popular',
    scopes: ['products:read', 'products:write', 'stock:read', 'stock:write', 'sales:read', 'customers:read'],
    events: ['stock.changed', 'product.updated', 'sale.paid'],
    needsWebhookUrl: true,
    guideUrl: 'https://shopify.dev/docs/apps/build/custom-apps',
    color: '#5e8e3e',
    steps: [
      'No Shopify Admin → Apps → Develop apps → crie um Custom App.',
      'Cole a API Key do Typos! como variável segura no app.',
      'Configure webhook do Shopify para enviar pedidos para o ERP via /v1/sales.',
    ],
  },
  {
    id: 'nuvemshop',
    name: 'Nuvemshop / Tiendanube',
    category: 'E-commerce',
    description: 'Plataforma líder de e-commerce na América Latina. Conecte produtos e estoque ao Typos!.',
    scopes: ['products:read', 'products:write', 'stock:read', 'stock:write', 'sales:read'],
    events: ['stock.changed', 'product.updated'],
    needsWebhookUrl: true,
    guideUrl: 'https://dev.nuvemshop.com.br/',
    color: '#01b6dd',
    steps: [
      'Crie um app parceiro no Nuvemshop Partners.',
      'Use a API Key gerada aqui para autenticar chamadas ao Typos!.',
      'Aponte os webhooks de pedidos do Nuvemshop para sua URL de integração.',
    ],
  },
  {
    id: 'tray',
    name: 'Tray',
    category: 'E-commerce',
    description: 'Integração com a plataforma Tray Commerce — produtos, estoque e pedidos sincronizados.',
    scopes: ['products:read', 'products:write', 'stock:read', 'stock:write', 'sales:read'],
    events: ['stock.changed', 'sale.paid'],
    needsWebhookUrl: true,
    color: '#0095da',
    steps: [
      'No painel Tray, vá em "Aplicativos & Integrações".',
      'Cadastre uma integração custom usando a API Key gerada aqui.',
      'Configure o webhook da Tray para os eventos de pedidos.',
    ],
  },
  {
    id: 'woocommerce',
    name: 'WooCommerce',
    category: 'E-commerce',
    description: 'Plugin oficial pronto para WordPress + WooCommerce. Baixe o .zip, instale, cole a API Key e os webhooks são criados automaticamente.',
    badge: 'Plugin pronto',
    scopes: ['products:read', 'products:write', 'stock:read', 'stock:write', 'sales:read', 'sales:write', 'customers:read', 'customers:write'],
    events: ['stock.changed', 'product.updated', 'sale.paid'],
    needsWebhookUrl: false,
    guideUrl: '/docs/api#woocommerce',
    color: '#7f54b3',
    steps: [
      'Clique em "Instalar" e copie a API Key gerada (mostrada apenas uma vez).',
      'Baixe o plugin oficial typos-erp-woocommerce.zip (botão no diálogo).',
      'No WordPress: Plugins → Adicionar novo → Enviar plugin → escolha o .zip → Ativar.',
      'No menu Typos! ERP do WP, cole a API Key e salve — pronto, sincronização em ambos os sentidos.',
    ],
  },
  {
    id: 'zapier',
    name: 'Zapier',
    category: 'Automação',
    description: 'Crie automações sem código entre Typos! e mais de 6.000 apps (Sheets, Gmail, Slack, etc.).',
    badge: 'Sem código',
    scopes: ['products:read', 'sales:read', 'customers:read', 'customers:write'],
    events: ['sale.created', 'sale.paid'],
    needsWebhookUrl: false,
    guideUrl: 'https://zapier.com/apps/webhook/integrations',
    color: '#ff4a00',
    steps: [
      'No Zapier crie um Zap com trigger "Webhook by Zapier" → Catch Hook.',
      'Cole a URL gerada pelo Zapier no campo de webhook ao instalar.',
      'Use ações HTTP autenticadas com a API Key para criar/consultar dados.',
    ],
  },
  {
    id: 'n8n',
    name: 'n8n',
    category: 'Automação',
    description: 'Plataforma open-source de automação. Crie workflows complexos consumindo a API Typos!.',
    scopes: ['products:read', 'products:write', 'stock:read', 'stock:write', 'sales:read', 'customers:read', 'customers:write'],
    events: ['sale.created', 'sale.paid', 'sale.canceled', 'stock.changed'],
    needsWebhookUrl: true,
    guideUrl: 'https://docs.n8n.io/',
    color: '#ea4b71',
    steps: [
      'Crie um workflow no n8n com node Webhook como gatilho.',
      'Use o node HTTP Request autenticado com a API Key.',
      'Cole a URL do Webhook do n8n no campo de instalação.',
    ],
  },
  {
    id: 'make',
    name: 'Make (Integromat)',
    category: 'Automação',
    description: 'Construtor visual de cenários. Conecte Typos! a qualquer SaaS via webhooks e HTTP.',
    scopes: ['products:read', 'sales:read', 'customers:read'],
    events: ['sale.created', 'sale.paid'],
    needsWebhookUrl: true,
    color: '#6d00cc',
    steps: [
      'Crie um cenário com módulo "Webhooks → Custom webhook".',
      'Cole aqui a URL gerada pelo Make.',
      'Use o módulo HTTP autenticado com Bearer + API Key.',
    ],
  },
  {
    id: 'powerbi',
    name: 'Power BI / Looker',
    category: 'BI / Contabilidade',
    description: 'Conecte sua ferramenta de BI usando a API REST para dashboards de vendas em tempo real.',
    scopes: ['products:read', 'stock:read', 'sales:read', 'customers:read', 'stores:read'],
    events: [],
    needsWebhookUrl: false,
    color: '#f2c811',
    steps: [
      'No Power BI use "Obter dados → Web" e cole o endpoint /v1/sales.',
      'Adicione header Authorization: Bearer {API Key}.',
      'Configure refresh agendado para atualizar os dashboards.',
    ],
  },
  {
    id: 'contabil',
    name: 'Sistemas Contábeis',
    category: 'BI / Contabilidade',
    description: 'Exporte vendas e clientes para sistemas contábeis (Domínio, Alterdata, Contabilizei).',
    scopes: ['sales:read', 'customers:read', 'stores:read'],
    events: ['sale.paid', 'sale.canceled'],
    needsWebhookUrl: true,
    color: '#0a7d3e',
    steps: [
      'Solicite à sua contabilidade a URL de recebimento (ou use middleware).',
      'Os webhooks enviarão JSON estruturado com totais e pagamentos.',
      'Use scopes apenas de leitura para garantir segurança.',
    ],
  },
  {
    id: 'custom',
    name: 'Aplicativo personalizado',
    category: 'Automação',
    description: 'Construa sua própria integração com qualquer linguagem usando a API REST e webhooks HMAC.',
    scopes: ['products:read', 'stock:read', 'sales:read'],
    events: ['sale.paid'],
    needsWebhookUrl: false,
    color: '#6b7280',
    steps: [
      'Crie uma chave com os escopos mínimos necessários.',
      'Consulte a documentação completa em /docs/api.',
      'Implemente verificação HMAC do header X-Typos-Signature.',
    ],
  },
];

const CATEGORIES = ['Todos', 'E-commerce', 'Automação', 'BI / Contabilidade'] as const;

interface InstalledApp {
  id: string; // api_key id
  name: string;
  scopes: string[];
  created_at: string;
  revoked_at: string | null;
  webhookId?: string;
  webhookUrl?: string;
}

import ModuleBlocked from '@/components/ModuleBlocked';
import { isModuleDisabled } from '@/utils/accountModules';

export default function ApiConnectors() {
  const { currentAccount } = useAuth();
  const { toast } = useToast();
  if (isModuleDisabled(currentAccount, 'api_access')) {
    return <ModuleBlocked title="Conectores via API bloqueado" description="O módulo de conectores está bloqueado para esta conta. Contate a equipe Typos para ativar." />;
  }
  const accountId = currentAccount?.id;

  const [filter, setFilter] = useState<(typeof CATEGORIES)[number]>('Todos');
  const [installed, setInstalled] = useState<Record<string, InstalledApp[]>>({});
  const [loading, setLoading] = useState(true);

  const [installing, setInstalling] = useState<Connector | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [installLoading, setInstallLoading] = useState(false);
  const [generated, setGenerated] = useState<{ key: string; connector: Connector } | null>(null);

  const load = async () => {
    if (!accountId) return;
    setLoading(true);
    const { data: keys } = await supabase
      .from('api_keys')
      .select('id, name, scopes, created_at, revoked_at')
      .eq('account_id', accountId)
      .like('name', 'Conector:%')
      .order('created_at', { ascending: false });

    const grouped: Record<string, InstalledApp[]> = {};
    (keys ?? []).forEach((k: any) => {
      const match = (k.name as string).match(/^Conector:\s*([^\s|]+)/);
      const cid = match?.[1];
      if (!cid) return;
      if (!grouped[cid]) grouped[cid] = [];
      grouped[cid].push({ id: k.id, name: k.name, scopes: k.scopes, created_at: k.created_at, revoked_at: k.revoked_at });
    });
    setInstalled(grouped);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [accountId]);

  const openInstall = (c: Connector) => {
    setInstalling(c);
    setWebhookUrl(c.defaultWebhookUrl ?? '');
    setGenerated(null);
  };

  const handleInstall = async () => {
    if (!installing || !accountId) return;
    if (installing.needsWebhookUrl && webhookUrl.trim()) {
      try { new URL(webhookUrl); } catch {
        toast({ variant: 'destructive', title: 'URL de webhook inválida' });
        return;
      }
    }
    setInstallLoading(true);
    try {
      const keyName = `Conector: ${installing.id} | ${new Date().toLocaleDateString('pt-BR')}`;
      const { data, error } = await supabase.functions.invoke('api-key-create', {
        body: { account_id: accountId, name: keyName, scopes: installing.scopes },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const apiKey = (data as any).key as string;

      // Webhook opcional
      if (installing.needsWebhookUrl && webhookUrl.trim() && installing.events.length > 0) {
        const arr = new Uint8Array(32);
        crypto.getRandomValues(arr);
        const secret = 'whsec_' + Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
        await supabase.from('webhook_endpoints').insert({
          account_id: accountId,
          url: webhookUrl.trim(),
          events: installing.events,
          secret,
          description: `Conector ${installing.name}`,
        });
      }

      setGenerated({ key: apiKey, connector: installing });
      await load();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao instalar', description: e.message });
    } finally {
      setInstallLoading(false);
    }
  };

  const handleUninstall = async (apiKeyId: string) => {
    const ok = confirm('Desinstalar este conector? A chave de API será revogada e o app deixará de funcionar.');
    if (!ok) return;
    const { error } = await supabase.rpc('revoke_api_key', { _id: apiKeyId });
    if (error) toast({ variant: 'destructive', title: 'Erro', description: error.message });
    else { toast({ title: 'Conector desinstalado' }); await load(); }
  };

  const filtered = filter === 'Todos' ? CONNECTORS : CONNECTORS.filter(c => c.category === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Puzzle className="h-6 w-6 text-primary" />
            Conectores via API
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Instale apps que conversam com o Typos! ERP usando nossa API pública. Cada instalação gera
            uma chave de API e (opcionalmente) um webhook dedicado — seguro, rastreável e revogável.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/app/developers"><Plug className="h-4 w-4 mr-2" />Desenvolvedores (avançado)</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/docs/api" target="_blank"><ExternalLink className="h-4 w-4 mr-2" />Documentação</Link>
          </Button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map(cat => (
          <Button
            key={cat}
            variant={filter === cat ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(cat)}
          >
            {cat}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map(c => {
          const apps = installed[c.id] ?? [];
          const activeApps = apps.filter(a => !a.revoked_at);
          return (
            <Card key={c.id} className="relative overflow-hidden border-2 transition-all hover:-translate-y-0.5 hover:shadow-md group">
              <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{ backgroundColor: c.color }}
              />
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: c.color }}
                    >
                      {(() => {
                        const LogoComp = LOGO_MAP[c.id];
                        if (LogoComp) return <LogoComp className="h-6 w-6 text-white" />;
                        return <span className="text-white font-bold text-sm">{c.name.charAt(0)}</span>;
                      })()}
                    </div>
                    <div>
                      <CardTitle className="text-base">{c.name}</CardTitle>
                      <Badge variant="secondary" className="text-[10px] mt-1">{c.category}</Badge>
                    </div>
                  </div>
                  {c.badge && (
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 text-[10px]">
                      <Zap className="h-3 w-3 mr-0.5" />{c.badge}
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-sm leading-relaxed mt-2">{c.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1">
                  {c.scopes.slice(0, 4).map(s => (
                    <Badge key={s} variant="outline" className="text-[10px] font-mono">{s}</Badge>
                  ))}
                  {c.scopes.length > 4 && <Badge variant="outline" className="text-[10px]">+{c.scopes.length - 4}</Badge>}
                </div>

                {activeApps.length > 0 ? (
                  <div className="space-y-1.5">
                    {activeApps.map(app => (
                      <div key={app.id} className="flex items-center justify-between gap-2 text-xs p-2 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
                        <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Instalado em {new Date(app.created_at).toLocaleDateString('pt-BR')}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-destructive hover:text-destructive"
                          onClick={() => handleUninstall(app.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" className="w-full" size="sm" onClick={() => openInstall(c)}>
                      <Plug className="h-4 w-4 mr-2" />Adicionar outra instância
                    </Button>
                  </div>
                ) : (
                  <Button className="w-full" onClick={() => openInstall(c)}>
                    <Plug className="h-4 w-4 mr-2" />Instalar
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {loading && <p className="text-xs text-muted-foreground text-center">Carregando instalações...</p>}

      {/* Install dialog */}
      <Dialog open={!!installing} onOpenChange={(o) => { if (!o) { setInstalling(null); setGenerated(null); } }}>
        <DialogContent className="max-w-lg">
          {installing && !generated && (
            <>
              <DialogHeader>
                <DialogTitle>Instalar {installing.name}</DialogTitle>
                <DialogDescription>
                  Geraremos uma chave de API com escopos pré-configurados para este conector.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase text-muted-foreground">Escopos que serão concedidos</Label>
                  <div className="flex flex-wrap gap-1">
                    {installing.scopes.map(s => (
                      <Badge key={s} variant="secondary" className="text-[10px] font-mono">{s}</Badge>
                    ))}
                  </div>
                </div>

                {installing.events.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-muted-foreground">Eventos de webhook</Label>
                    <div className="flex flex-wrap gap-1">
                      {installing.events.map(e => (
                        <Badge key={e} variant="outline" className="text-[10px] font-mono">{e}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {installing.needsWebhookUrl && (
                  <div className="space-y-1">
                    <Label>URL do webhook (opcional)</Label>
                    <Input
                      placeholder="https://exemplo.com/webhook"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Cole aqui a URL fornecida pelo {installing.name} para receber eventos em tempo real.
                    </p>
                  </div>
                )}

                {installing.id === 'woocommerce' && (
                  <div className="rounded-lg border-2 border-[#7f54b3]/30 bg-[#7f54b3]/5 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <WooCommerceLogo className="h-5 w-5 text-[#7f54b3]" />
                      <Label className="text-xs uppercase font-semibold">Plugin oficial WordPress</Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Não precisa de Zapier ou middleware. Baixe o plugin, instale no WP e cole a API Key gerada aqui.
                    </p>
                    <Button asChild size="sm" className="bg-[#7f54b3] hover:bg-[#7f54b3]/90 text-white">
                      <a href="/downloads/typos-erp-woocommerce.zip" download>
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                        Baixar typos-erp-woocommerce.zip
                      </a>
                    </Button>
                  </div>
                )}

                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <Label className="text-xs uppercase text-muted-foreground">Como configurar</Label>
                  <ol className="list-decimal list-inside text-xs space-y-1 text-muted-foreground">
                    {installing.steps.map((s, i) => <li key={i}>{s}</li>)}
                  </ol>
                  {installing.guideUrl && (
                    <Button asChild variant="link" size="sm" className="px-0 h-auto">
                      <a href={installing.guideUrl} target={installing.guideUrl.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
                        Ver guia completo <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInstalling(null)}>Cancelar</Button>
                <Button onClick={handleInstall} disabled={installLoading}>
                  {installLoading ? 'Instalando...' : 'Instalar conector'}
                </Button>
              </DialogFooter>
            </>
          )}

          {generated && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-emerald-500" />
                  {generated.connector.name} instalado!
                </DialogTitle>
                <DialogDescription>
                  Copie a chave abaixo agora — ela não será exibida novamente.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 text-sm text-amber-900 dark:text-amber-200 flex gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Esta é a única vez que mostraremos a chave completa. Guarde em local seguro.</span>
                </div>
                <div>
                  <Label className="text-xs uppercase text-muted-foreground">API Key</Label>
                  <div className="flex gap-2 mt-1">
                    <Input readOnly value={generated.key} className="font-mono text-xs" />
                    <Button variant="outline" size="sm" onClick={async () => {
                      await navigator.clipboard.writeText(generated.key);
                      toast({ title: 'Copiado!' });
                    }}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs uppercase text-muted-foreground">Endpoint base</Label>
                  <Textarea
                    readOnly
                    rows={2}
                    className="font-mono text-xs mt-1"
                    value={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-api/v1`}
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase text-muted-foreground">Exemplo de chamada</Label>
                  <pre className="mt-1 p-3 rounded-lg bg-muted text-xs overflow-x-auto">
{`curl -H "Authorization: Bearer ${generated.key.slice(0, 20)}..." \\
  ${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-api/v1/products`}
                  </pre>
                </div>
                {generated.connector.id === 'woocommerce' && (
                  <div className="rounded-lg border-2 border-[#7f54b3]/30 bg-[#7f54b3]/5 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <WooCommerceLogo className="h-5 w-5 text-[#7f54b3]" />
                      <Label className="text-xs uppercase font-semibold">Próximo passo: instalar o plugin no WordPress</Label>
                    </div>
                    <ol className="list-decimal list-inside text-xs space-y-0.5 text-muted-foreground">
                      <li>Baixe o plugin abaixo.</li>
                      <li>WP Admin → Plugins → Adicionar novo → Enviar plugin → escolha o .zip → Ativar.</li>
                      <li>Menu lateral "Typos! ERP" → cole a API Key acima → Salvar.</li>
                    </ol>
                    <Button asChild size="sm" className="bg-[#7f54b3] hover:bg-[#7f54b3]/90 text-white w-full">
                      <a href="/downloads/typos-erp-woocommerce.zip" download>
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                        Baixar typos-erp-woocommerce.zip
                      </a>
                    </Button>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button onClick={() => { setInstalling(null); setGenerated(null); }}>Concluir</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
