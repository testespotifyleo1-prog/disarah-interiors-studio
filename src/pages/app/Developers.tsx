import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Code2, Copy, Check, Plus, Trash2, Webhook, KeyRound, ExternalLink, AlertTriangle, Activity, Eye, EyeOff, RefreshCw, BarChart3, FlaskConical, Filter, Play, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import ApiLogsTable from '@/components/developers/ApiLogsTable';
import ApiUsageDashboard from '@/components/developers/ApiUsageDashboard';
import ApiTestConsole from '@/components/developers/ApiTestConsole';

const SCOPES = [
  { id: 'products:read', label: 'Produtos (leitura)', desc: 'Listar e consultar produtos' },
  { id: 'products:write', label: 'Produtos (escrita)', desc: 'Criar, atualizar e desativar produtos' },
  { id: 'stock:read', label: 'Estoque (leitura)', desc: 'Saldos por loja e produto' },
  { id: 'stock:write', label: 'Estoque (escrita)', desc: 'Ajustar saldos de inventário' },
  { id: 'sales:read', label: 'Vendas (leitura)', desc: 'Vendas, itens e pagamentos' },
  { id: 'customers:read', label: 'Clientes (leitura)', desc: 'Cadastro de clientes' },
  { id: 'customers:write', label: 'Clientes (escrita)', desc: 'Criar e atualizar clientes' },
  { id: 'stores:read', label: 'Lojas (leitura)', desc: 'Lista de lojas da conta' },
];

const EVENTS = [
  { id: 'sale.created', desc: 'Quando uma venda é registrada' },
  { id: 'sale.paid', desc: 'Quando uma venda é finalizada/paga' },
  { id: 'sale.canceled', desc: 'Quando uma venda é cancelada' },
  { id: 'stock.changed', desc: 'Quando o saldo de um produto muda' },
];

const API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-api/v1`;

interface ApiKey { id: string; name: string; key_prefix: string; scopes: string[]; environment: string; last_used_at: string | null; revoked_at: string | null; expires_at: string | null; created_at: string; }
interface WebhookEndpoint { id: string; url: string; events: string[]; secret: string; is_active: boolean; description: string | null; last_success_at: string | null; last_failure_at: string | null; failure_count: number; created_at: string; }
interface Delivery { id: string; event: string; status_code: number | null; attempt: number; delivered_at: string | null; error: string | null; created_at: string; payload: any; }

function CopyButton({ value, label = 'Copiar' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button variant="outline" size="sm" onClick={async () => { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      <span className="ml-1.5">{copied ? 'Copiado!' : label}</span>
    </Button>
  );
}

import ModuleBlocked from '@/components/ModuleBlocked';
import { isModuleDisabled } from '@/utils/accountModules';

export default function Developers() {
  const { currentAccount } = useAuth();
  const { toast } = useToast();
  if (isModuleDisabled(currentAccount, 'api_access')) {
    return <ModuleBlocked title="Desenvolvedores (API) bloqueado" description="O módulo de API está bloqueado para esta conta. Contate a equipe Typos para ativar." />;
  }
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);

  // Create key dialog
  const [createKeyOpen, setCreateKeyOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(['products:read', 'stock:read']);
  const [newKeyEnv, setNewKeyEnv] = useState<'live' | 'test'>('live');
  const [creatingKey, setCreatingKey] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [envFilter, setEnvFilter] = useState<'live' | 'test'>('live');
  const [scopeFilter, setScopeFilter] = useState<string[]>([]);

  // Create webhook dialog
  const [createHookOpen, setCreateHookOpen] = useState(false);
  const [newHookUrl, setNewHookUrl] = useState('');
  const [newHookEvents, setNewHookEvents] = useState<string[]>(['sale.paid']);
  const [newHookDesc, setNewHookDesc] = useState('');
  const [creatingHook, setCreatingHook] = useState(false);

  // Deliveries dialog
  const [deliveriesEndpoint, setDeliveriesEndpoint] = useState<WebhookEndpoint | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [showSecretFor, setShowSecretFor] = useState<string | null>(null);

  const accountId = currentAccount?.id;

  const load = async () => {
    if (!accountId) return;
    setLoading(true);
    const [k, h] = await Promise.all([
      supabase.from('api_keys').select('*').eq('account_id', accountId).order('created_at', { ascending: false }),
      supabase.from('webhook_endpoints').select('*').eq('account_id', accountId).order('created_at', { ascending: false }),
    ]);
    setKeys((k.data ?? []) as ApiKey[]);
    setEndpoints((h.data ?? []) as WebhookEndpoint[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [accountId]);

  const handleCreateKey = async () => {
    if (!newKeyName.trim() || newKeyScopes.length === 0 || !accountId) {
      toast({ variant: 'destructive', title: 'Preencha o nome e selecione ao menos um escopo' });
      return;
    }
    setCreatingKey(true);
    try {
      const { data, error } = await supabase.functions.invoke('api-key-create', {
        body: { account_id: accountId, name: newKeyName.trim(), scopes: newKeyScopes, environment: newKeyEnv },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setGeneratedKey((data as any).key);
      setNewKeyName('');
      setNewKeyScopes(['products:read', 'stock:read']);
      await load();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao criar chave', description: e.message });
    } finally {
      setCreatingKey(false);
    }
  };

  const handleRevokeKey = async (id: string) => {
    const { error } = await supabase.rpc('revoke_api_key', { _id: id });
    if (error) toast({ variant: 'destructive', title: 'Erro', description: error.message });
    else { toast({ title: 'Chave revogada' }); await load(); }
  };

  const handleCreateHook = async () => {
    if (!newHookUrl.trim() || newHookEvents.length === 0 || !accountId) {
      toast({ variant: 'destructive', title: 'Informe a URL e selecione ao menos um evento' });
      return;
    }
    try {
      new URL(newHookUrl);
    } catch {
      toast({ variant: 'destructive', title: 'URL inválida' });
      return;
    }
    setCreatingHook(true);
    try {
      // Generate secret client-side
      const arr = new Uint8Array(32);
      crypto.getRandomValues(arr);
      const secret = 'whsec_' + Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');

      const { error } = await supabase.from('webhook_endpoints').insert({
        account_id: accountId,
        url: newHookUrl.trim(),
        events: newHookEvents,
        secret,
        description: newHookDesc.trim() || null,
      });
      if (error) throw error;
      toast({ title: 'Webhook criado!' });
      setCreateHookOpen(false);
      setNewHookUrl(''); setNewHookEvents(['sale.paid']); setNewHookDesc('');
      await load();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
      setCreatingHook(false);
    }
  };

  const handleToggleHook = async (h: WebhookEndpoint) => {
    const { error } = await supabase.from('webhook_endpoints').update({ is_active: !h.is_active, failure_count: 0 }).eq('id', h.id);
    if (error) toast({ variant: 'destructive', title: 'Erro', description: error.message });
    else await load();
  };

  const handleDeleteHook = async (id: string) => {
    const { error } = await supabase.from('webhook_endpoints').delete().eq('id', id);
    if (error) toast({ variant: 'destructive', title: 'Erro', description: error.message });
    else { toast({ title: 'Webhook removido' }); await load(); }
  };

  const openDeliveries = async (h: WebhookEndpoint) => {
    setDeliveriesEndpoint(h);
    const { data } = await supabase.from('webhook_deliveries').select('*')
      .eq('endpoint_id', h.id).order('created_at', { ascending: false }).limit(50);
    setDeliveries((data ?? []) as Delivery[]);
  };

  const triggerDispatcher = async () => {
    await supabase.functions.invoke('webhook-dispatcher', { body: {} });
    toast({ title: 'Disparador acionado' });
    if (deliveriesEndpoint) openDeliveries(deliveriesEndpoint);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Code2 className="h-6 w-6 text-primary" />
            Desenvolvedores
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            API pública e webhooks para integrar o Typos! ERP a outros sistemas (Shopify, Nuvemshop, BI, contabilidade, etc.).
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/docs/api" target="_blank">
            <ExternalLink className="h-4 w-4 mr-2" /> Ver documentação
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="keys" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="keys"><KeyRound className="h-4 w-4 mr-2" />API Keys</TabsTrigger>
          <TabsTrigger value="webhooks"><Webhook className="h-4 w-4 mr-2" />Webhooks</TabsTrigger>
          <TabsTrigger value="console"><Play className="h-4 w-4 mr-2" />Console</TabsTrigger>
          <TabsTrigger value="logs"><Activity className="h-4 w-4 mr-2" />Logs</TabsTrigger>
          <TabsTrigger value="usage"><BarChart3 className="h-4 w-4 mr-2" />Uso</TabsTrigger>
          <TabsTrigger value="quickstart">Quickstart</TabsTrigger>
        </TabsList>

        <TabsContent value="console"><ApiTestConsole /></TabsContent>
        <TabsContent value="logs"><ApiLogsTable /></TabsContent>
        <TabsContent value="usage"><ApiUsageDashboard /></TabsContent>

        {/* ============= API KEYS ============= */}
        <TabsContent value="keys" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="text-base">Suas chaves de API</CardTitle>
                <CardDescription>Use cada chave em um sistema externo. Revogue a qualquer momento.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Tabs value={envFilter} onValueChange={(v) => setEnvFilter(v as 'live' | 'test')}>
                  <TabsList className="h-8">
                    <TabsTrigger value="live" className="text-xs h-6">Live</TabsTrigger>
                    <TabsTrigger value="test" className="text-xs h-6"><FlaskConical className="h-3 w-3 mr-1" />Test</TabsTrigger>
                  </TabsList>
                </Tabs>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-1.5">
                      <Filter className="h-3.5 w-3.5" />
                      Escopos
                      {scopeFilter.length > 0 && (
                        <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{scopeFilter.length}</Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-2" align="end">
                    <div className="flex items-center justify-between px-2 py-1.5">
                      <span className="text-xs font-medium">Filtrar por escopos</span>
                      {scopeFilter.length > 0 && (
                        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setScopeFilter([])}>
                          <X className="h-3 w-3 mr-1" />Limpar
                        </Button>
                      )}
                    </div>
                    <div className="max-h-72 overflow-y-auto space-y-1">
                      {SCOPES.map(s => (
                        <label key={s.id} className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer">
                          <Checkbox
                            checked={scopeFilter.includes(s.id)}
                            onCheckedChange={(v) => setScopeFilter(v ? [...scopeFilter, s.id] : scopeFilter.filter(x => x !== s.id))}
                          />
                          <div className="text-xs">
                            <div className="font-medium font-mono">{s.id}</div>
                            <div className="text-muted-foreground">{s.label}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              <Dialog open={createKeyOpen} onOpenChange={(o) => { setCreateKeyOpen(o); if (!o) setGeneratedKey(null); }}>
                <DialogTrigger asChild>
                  <Button><Plus className="h-4 w-4 mr-2" />Nova chave</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{generatedKey ? 'Chave criada — guarde agora!' : 'Criar API key'}</DialogTitle>
                    <DialogDescription>
                      {generatedKey
                        ? 'Esta é a única vez que a chave completa será exibida. Copie e guarde em local seguro.'
                        : 'Dê um nome descritivo (ex: "Shopify produção") e selecione os escopos necessários.'}
                    </DialogDescription>
                  </DialogHeader>
                  {generatedKey ? (
                    <div className="space-y-3">
                      <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 text-sm text-amber-900 dark:text-amber-200 flex gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>Não conseguiremos mostrar essa chave novamente. Copie agora.</span>
                      </div>
                      <div className="flex gap-2">
                        <Input readOnly value={generatedKey} className="font-mono text-xs" />
                        <CopyButton value={generatedKey} />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <Label>Nome</Label>
                        <Input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="Ex: Shopify produção" />
                      </div>
                      <div>
                        <Label className="mb-2 block">Ambiente</Label>
                        <RadioGroup value={newKeyEnv} onValueChange={(v) => setNewKeyEnv(v as 'live' | 'test')} className="grid grid-cols-2 gap-2">
                          <label className="flex items-start gap-2 p-3 rounded-md border hover:bg-muted/50 cursor-pointer">
                            <RadioGroupItem value="live" />
                            <div className="text-sm"><div className="font-medium">Live</div><div className="text-xs text-muted-foreground">Dados reais</div></div>
                          </label>
                          <label className="flex items-start gap-2 p-3 rounded-md border hover:bg-muted/50 cursor-pointer">
                            <RadioGroupItem value="test" />
                            <div className="text-sm"><div className="font-medium flex items-center gap-1"><FlaskConical className="h-3.5 w-3.5" />Test</div><div className="text-xs text-muted-foreground">Dry-run, não persiste</div></div>
                          </label>
                        </RadioGroup>
                      </div>
                      <div>
                        <Label className="mb-2 block">Escopos</Label>
                        <div className="space-y-2">
                          {SCOPES.map(s => (
                            <label key={s.id} className="flex items-start gap-2 p-2 rounded-md border hover:bg-muted/50 cursor-pointer">
                              <Checkbox
                                checked={newKeyScopes.includes(s.id)}
                                onCheckedChange={(v) => setNewKeyScopes(v ? [...newKeyScopes, s.id] : newKeyScopes.filter(x => x !== s.id))}
                              />
                              <div className="text-sm">
                                <div className="font-medium">{s.label}</div>
                                <div className="text-xs text-muted-foreground">{s.desc}</div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  <DialogFooter>
                    {generatedKey ? (
                      <Button onClick={() => { setCreateKeyOpen(false); setGeneratedKey(null); }}>Fechar</Button>
                    ) : (
                      <Button onClick={handleCreateKey} disabled={creatingKey}>
                        {creatingKey ? 'Criando...' : 'Criar chave'}
                      </Button>
                    )}
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {(() => {
                const visible = keys.filter(k =>
                  (k.environment ?? 'live') === envFilter
                  && (scopeFilter.length === 0 || scopeFilter.every(s => k.scopes.includes(s)))
                );
                if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
                if (visible.length === 0) return (
                  <div className="text-center py-10 text-sm text-muted-foreground">
                    {scopeFilter.length > 0
                      ? <>Nenhuma chave {envFilter === 'test' ? 'de teste' : 'live'} contém todos os escopos selecionados.</>
                      : <>Nenhuma chave {envFilter === 'test' ? 'de teste' : 'live'} criada ainda. Clique em "Nova chave" para começar.</>}
                  </div>
                );
                return (
                <div className="space-y-2">
                  {visible.map(k => (
                    <div key={k.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{k.name}</span>
                          {(k.environment ?? 'live') === 'test'
                            ? <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200"><FlaskConical className="h-3 w-3 mr-1" />Test</Badge>
                            : <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-100 border-sky-200">Live</Badge>}
                          {k.revoked_at ? <Badge variant="destructive">Revogada</Badge> : <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">Ativa</Badge>}
                          {k.scopes.map(s => (
                            <Badge
                              key={s}
                              variant={scopeFilter.includes(s) ? 'default' : 'secondary'}
                              className="text-[10px]"
                            >
                              {s}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="text-xs text-muted-foreground font-mono">{k.key_prefix}…</code>
                          <CopyButton value={k.key_prefix} label="Copiar prefixo" />
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Criada {new Date(k.created_at).toLocaleDateString('pt-BR')} ·{' '}
                          {k.last_used_at ? `usada por último ${new Date(k.last_used_at).toLocaleString('pt-BR')}` : 'nunca usada'}
                        </div>
                      </div>
                      {!k.revoked_at && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm"><Trash2 className="h-4 w-4" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Revogar chave "{k.name}"?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Sistemas que estiverem usando esta chave deixarão de funcionar imediatamente. Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleRevokeKey(k.id)}>Revogar</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  ))}
                </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============= WEBHOOKS ============= */}
        <TabsContent value="webhooks" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base">Endpoints de webhook</CardTitle>
                <CardDescription>Receba notificações em tempo real quando eventos acontecem no seu ERP.</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={triggerDispatcher}><RefreshCw className="h-4 w-4 mr-2" />Disparar agora</Button>
                <Dialog open={createHookOpen} onOpenChange={setCreateHookOpen}>
                  <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Novo webhook</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Cadastrar webhook</DialogTitle>
                      <DialogDescription>Enviaremos um POST JSON para a URL com o cabeçalho <code className="text-xs">X-Typos-Signature</code> (HMAC-SHA256).</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>URL do endpoint</Label>
                        <Input value={newHookUrl} onChange={(e) => setNewHookUrl(e.target.value)} placeholder="https://meusistema.com/webhooks/typos" />
                      </div>
                      <div>
                        <Label>Descrição (opcional)</Label>
                        <Input value={newHookDesc} onChange={(e) => setNewHookDesc(e.target.value)} placeholder="Ex: integração com BI" />
                      </div>
                      <div>
                        <Label className="mb-2 block">Eventos</Label>
                        <div className="space-y-2">
                          {EVENTS.map(ev => (
                            <label key={ev.id} className="flex items-start gap-2 p-2 rounded-md border hover:bg-muted/50 cursor-pointer">
                              <Checkbox
                                checked={newHookEvents.includes(ev.id)}
                                onCheckedChange={(v) => setNewHookEvents(v ? [...newHookEvents, ev.id] : newHookEvents.filter(x => x !== ev.id))}
                              />
                              <div className="text-sm">
                                <div className="font-mono text-xs font-medium">{ev.id}</div>
                                <div className="text-xs text-muted-foreground">{ev.desc}</div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleCreateHook} disabled={creatingHook}>{creatingHook ? 'Criando...' : 'Criar webhook'}</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? <p className="text-sm text-muted-foreground">Carregando...</p>
              : endpoints.length === 0 ? (
                <div className="text-center py-10 text-sm text-muted-foreground">Nenhum webhook configurado.</div>
              ) : (
                <div className="space-y-2">
                  {endpoints.map(h => (
                    <div key={h.id} className="p-3 rounded-lg border space-y-2">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {h.is_active ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">Ativo</Badge> : <Badge variant="secondary">Pausado</Badge>}
                            {h.failure_count > 0 && <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />{h.failure_count} falhas</Badge>}
                            {h.events.map(e => <Badge key={e} variant="outline" className="text-[10px] font-mono">{e}</Badge>)}
                          </div>
                          <div className="text-xs font-mono text-muted-foreground mt-1 break-all">{h.url}</div>
                          {h.description && <div className="text-xs text-muted-foreground">{h.description}</div>}
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openDeliveries(h)}><Activity className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => handleToggleHook(h)}>{h.is_active ? 'Pausar' : 'Ativar'}</Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild><Button variant="ghost" size="sm"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Remover webhook?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteHook(h.id)}>Remover</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">Secret HMAC:</Label>
                        <code className="text-xs font-mono bg-muted px-2 py-1 rounded flex-1 truncate">
                          {showSecretFor === h.id ? h.secret : '••••••••••••••••••••••••••••••••'}
                        </code>
                        <Button variant="ghost" size="sm" onClick={() => setShowSecretFor(showSecretFor === h.id ? null : h.id)}>
                          {showSecretFor === h.id ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                        <CopyButton value={h.secret} label="" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Deliveries dialog */}
          <Dialog open={!!deliveriesEndpoint} onOpenChange={(o) => !o && setDeliveriesEndpoint(null)}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Últimas entregas</DialogTitle>
                <DialogDescription className="font-mono text-xs break-all">{deliveriesEndpoint?.url}</DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[60vh]">
                {deliveries.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Sem entregas ainda.</p>
                ) : (
                  <div className="space-y-2">
                    {deliveries.map(d => {
                      const ok = d.status_code && d.status_code >= 200 && d.status_code < 300;
                      return (
                        <div key={d.id} className="text-xs border rounded p-2 space-y-1">
                          <div className="flex gap-2 items-center flex-wrap">
                            {ok ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{d.status_code}</Badge>
                                : d.delivered_at ? <Badge variant="destructive">{d.status_code ?? 'erro'}</Badge>
                                : <Badge variant="secondary">pendente</Badge>}
                            <span className="font-mono">{d.event}</span>
                            <span className="text-muted-foreground">tentativa {d.attempt}</span>
                            <span className="text-muted-foreground ml-auto">{new Date(d.created_at).toLocaleString('pt-BR')}</span>
                          </div>
                          {d.error && <div className="text-destructive">{d.error}</div>}
                          <details>
                            <summary className="cursor-pointer text-muted-foreground">payload</summary>
                            <pre className="bg-muted p-2 rounded text-[10px] overflow-x-auto mt-1">{JSON.stringify(d.payload, null, 2)}</pre>
                          </details>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ============= QUICKSTART ============= */}
        <TabsContent value="quickstart" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Comece em 30 segundos</CardTitle>
              <CardDescription>Endpoint base: <code className="font-mono text-xs">{API_BASE}</code></CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="font-medium mb-1">1. Liste seus produtos:</p>
                <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">{`curl -H "Authorization: Bearer SUA_API_KEY" \\
  "${API_BASE}/products?limit=10"`}</pre>
              </div>
              <div>
                <p className="font-medium mb-1">2. Saldos de estoque atualizados desde uma data:</p>
                <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">{`curl -H "Authorization: Bearer SUA_API_KEY" \\
  "${API_BASE}/stock?updated_since=2026-01-01T00:00:00Z"`}</pre>
              </div>
              <div>
                <p className="font-medium mb-1">3. Vendas pagas dos últimos 30 dias:</p>
                <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">{`curl -H "Authorization: Bearer SUA_API_KEY" \\
  "${API_BASE}/sales?status=paid&from=2026-04-12T00:00:00Z"`}</pre>
              </div>
              <Button asChild variant="outline" className="w-full">
                <Link to="/docs/api" target="_blank"><ExternalLink className="h-4 w-4 mr-2" />Documentação completa</Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
