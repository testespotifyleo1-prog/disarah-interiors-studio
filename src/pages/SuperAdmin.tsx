import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Navigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Shield, Store, Copy, Check, Save, Search, Link2, Wifi, WifiOff, Crown, Globe, Headset, LogOut, QrCode, ShoppingBag, Users, UserCog, Sparkles, LayoutDashboard, MessageCircle, Truck, Package, Settings2, ChevronRight, Trash2, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import amazonLogo from '@/assets/logos/amazon-official.png';
import magaluLogo from '@/assets/logos/magalu-official.png';
import melhorEnvioLogo from '@/assets/logos/melhor-envio-official.png';
import uberDirectLogo from '@/assets/logos/uber-direct-official.png';
import { ShopeeLogo, MercadoLivreLogo } from '@/components/brand/BrandLogos';
const SupportDashboard: any = () => null;
const SupportActionRulesManager: any = () => null;
const PixPaymentsManagement: any = () => null;
import { SupportActionRulesManager } from '@/components/admin/SupportActionRulesManager';
import { PixPaymentsManagement } from '@/components/admin/PixPaymentsManagement';
const ShopeeCredentials: any = () => null;
const MercadoLivreCredentials: any = () => null;
const AmazonCredentials: any = () => null;
const MagaluCredentials: any = () => null;
const MelhorEnvioCredentials: any = () => null;
const UberDirectCredentials: any = () => null;
import { InstagramLogo, FacebookLogo, LinkedInLogo } from '@/components/brand/BrandLogos';
// SaaS plan management, AI simulation admin, and impersonation removed (single-tenant build)
const PlanManagement: any = () => null;
const PlansEditor: any = () => null;
const AiSimulationManagement: any = () => null;
const startImpersonation = async (..._args: any[]) => { throw new Error('Impersonation disabled'); };

interface StoreWithSettings {
  id: string;
  name: string;
  account_id: string;
  account_name: string;
  chatbot_settings: {
    id?: string;
    is_active: boolean;
    z_api_instance_id: string;
    z_api_instance_token: string;
    z_api_client_token: string;
  } | null;
}

export default function SuperAdmin() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);
  const [stores, setStores] = useState<StoreWithSettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingStore, setEditingStore] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    z_api_instance_id: '',
    z_api_instance_token: '',
    z_api_client_token: '',
  });
  const [active, setActive] = useState<string>('overview');

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapi-webhook`;

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setIsSuperAdmin(false);
      setLoading(false);
      return;
    }

    void checkSuperAdmin();
  }, [authLoading, user?.id]);

  const checkSuperAdmin = async () => {
    const { data, error } = await supabase.rpc('is_super_admin');

    if (error) {
      setIsSuperAdmin(false);
      setLoading(false);
      toast({
        variant: 'destructive',
        title: 'Erro ao validar acesso',
        description: 'Não foi possível validar seu acesso ao Super Admin.',
      });
      return;
    }

    const hasAccess = Boolean(data);
    setIsSuperAdmin(hasAccess);

    if (hasAccess) {
      loadAllStores();
    } else {
      setLoading(false);
    }
  };

  const loadAllStores = async () => {
    setLoading(true);
    
    // Load all stores
    const { data: allStores } = await supabase
      .from('stores')
      .select('id, name, account_id')
      .eq('is_active', true)
      .order('name');

    // Load all accounts
    const { data: allAccounts } = await supabase
      .from('accounts')
      .select('id, name');

    // Load all chatbot settings
    const { data: allSettings } = await supabase
      .from('chatbot_settings')
      .select('*');

    const accountMap = new Map((allAccounts || []).map((a: any) => [a.id, a.name]));
    const settingsMap = new Map((allSettings || []).map((s: any) => [s.store_id, s]));

    const storesWithSettings: StoreWithSettings[] = (allStores || []).map((store: any) => {
      const settings = settingsMap.get(store.id);
      return {
        id: store.id,
        name: store.name,
        account_id: store.account_id,
        account_name: accountMap.get(store.account_id) || 'N/A',
        chatbot_settings: settings ? {
          id: settings.id,
          is_active: settings.is_active,
          z_api_instance_id: settings.z_api_instance_id || '',
          z_api_instance_token: settings.z_api_instance_token || '',
          z_api_client_token: settings.z_api_client_token || '',
        } : null,
      };
    });

    setStores(storesWithSettings);
    setLoading(false);
  };

  const handleEdit = (store: StoreWithSettings) => {
    setEditingStore(store.id);
    setEditForm({
      z_api_instance_id: store.chatbot_settings?.z_api_instance_id || '',
      z_api_instance_token: store.chatbot_settings?.z_api_instance_token || '',
      z_api_client_token: store.chatbot_settings?.z_api_client_token || '',
    });
  };

  const handleSave = async (store: StoreWithSettings) => {
    setSaving(store.id);

    if (store.chatbot_settings?.id) {
      const { error } = await supabase
        .from('chatbot_settings')
        .update({
          z_api_instance_id: editForm.z_api_instance_id,
          z_api_instance_token: editForm.z_api_instance_token,
          z_api_client_token: editForm.z_api_client_token,
          is_active: true,
        })
        .eq('id', store.chatbot_settings.id);

      if (error) {
        toast({ variant: 'destructive', title: 'Erro', description: error.message });
      } else {
        toast({ title: 'Instância configurada!' });
      }
    } else {
      const { error } = await supabase
        .from('chatbot_settings')
        .insert({
          store_id: store.id,
          account_id: store.account_id,
          z_api_instance_id: editForm.z_api_instance_id,
          z_api_instance_token: editForm.z_api_instance_token,
          z_api_client_token: editForm.z_api_client_token,
          is_active: true,
        });

      if (error) {
        toast({ variant: 'destructive', title: 'Erro', description: error.message });
      } else {
        toast({ title: 'Instância criada e configurada!' });
      }
    }

    setSaving(null);
    setEditingStore(null);
    loadAllStores();
  };

  const copyWebhook = (storeId: string) => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedId(storeId);
    toast({ title: 'Webhook copiado!' });
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (authLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}${location.hash}` }} />;
  if (isSuperAdmin === false) return <Navigate to="/app/dashboard" replace />;
  if (isSuperAdmin === null || loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const filtered = stores.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.account_name.toLowerCase().includes(search.toLowerCase())
  );

  const configured = stores.filter(s => s.chatbot_settings?.z_api_instance_id);
  const notConfigured = stores.filter(s => !s.chatbot_settings?.z_api_instance_id);

  const sections = [
    {
      group: 'Operação',
      items: [
        { id: 'overview', label: 'Visão geral', icon: LayoutDashboard },
        { id: 'accounts', label: 'Contas & Lojas', icon: Users },
        { id: 'support', label: 'Suporte', icon: Headset },
      ],
    },
    {
      group: 'Comunicação',
      items: [
        { id: 'whatsapp', label: 'WhatsApp / Z-API', icon: MessageCircle },
      ],
    },
    {
      group: 'Pagamentos',
      items: [
        { id: 'pix', label: 'PIX', icon: QrCode },
      ],
    },
    {
      group: 'Marketplaces',
      items: [
        { id: 'shopee', label: 'Shopee', icon: ShoppingBag, brandColor: '#EE4D2D' },
        { id: 'meli', label: 'Mercado Livre', icon: ShoppingBag, brandColor: '#FFE600' },
        { id: 'amazon', label: 'Amazon', icon: ShoppingBag, brandColor: '#FF9900' },
        { id: 'magalu', label: 'Magazine Luiza', icon: ShoppingBag, brandColor: '#0086FF' },
      ],
    },
    {
      group: 'Logística',
      items: [
        { id: 'melhor-envio', label: 'Melhor Envio', icon: Truck, brandColor: '#0D6EFD' },
        { id: 'uber-direct', label: 'Uber Direct', icon: Truck, brandColor: '#000000' },
      ],
    },
    {
      group: 'Plataforma',
      items: [
        { id: 'ai', label: 'Simulador IA', icon: Sparkles },
        { id: 'plans', label: 'Atribuir Planos', icon: Crown },
        { id: 'plans-editor', label: 'Editor de Planos', icon: Settings2 },
        { id: 'social', label: 'Redes Sociais', icon: Globe },
      ],
    },
  ];

  const flatItems = sections.flatMap(s => s.items);
  const activeMeta = flatItems.find(i => i.id === active) || flatItems[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex">
      {/* ===== Sidebar ===== */}
      <aside className="hidden lg:flex w-[260px] shrink-0 flex-col border-r border-border/60 bg-card/40 backdrop-blur-xl sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-border/60 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/30">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold leading-tight truncate">Super Admin</p>
            <p className="text-[11px] text-muted-foreground truncate">Painel de controle</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5 scrollbar-thin">
          {sections.map(group => (
            <div key={group.group}>
              <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">
                {group.group}
              </p>
              <div className="space-y-0.5">
                {group.items.map(item => {
                  const Icon = item.icon;
                  const isActive = active === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActive(item.id)}
                      className={`w-full group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                          : 'text-foreground/70 hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${isActive ? '' : 'text-muted-foreground group-hover:text-foreground'}`} />
                      <span className="flex-1 text-left truncate">{item.label}</span>
                      {(item as any).brandColor && (
                        <span
                          className="h-2 w-2 rounded-full ring-2 ring-background"
                          style={{ backgroundColor: (item as any).brandColor }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-border/60">
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </aside>

      {/* ===== Main ===== */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-20 backdrop-blur-xl bg-background/70 border-b border-border/60">
          <div className="px-4 lg:px-8 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
              <span className="font-medium">Super Admin</span>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="font-semibold text-foreground truncate">{activeMeta.label}</span>
            </div>
            {/* Mobile selector */}
            <select
              value={active}
              onChange={(e) => setActive(e.target.value)}
              className="lg:hidden text-xs font-medium border border-border rounded-lg bg-background px-2 py-1.5"
            >
              {sections.map(g => (
                <optgroup key={g.group} label={g.group}>
                  {g.items.map(i => <option key={i.id} value={i.id}>{i.label}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
        </header>

        <div className="flex-1 px-4 lg:px-8 py-6 lg:py-8 max-w-[1400px] w-full mx-auto">
          {/* ===== OVERVIEW ===== */}
          {active === 'overview' && (
            <div className="space-y-6">
              <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 p-6 lg:p-8">
                <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Bem-vindo</p>
                <h1 className="text-2xl lg:text-3xl font-black tracking-tight">Painel de Super Administração</h1>
                <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">
                  Gerencie contas, integrações, pagamentos e a plataforma inteira a partir de um único lugar.
                </p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: 'Lojas ativas', value: stores.length, icon: Store, tone: 'text-blue-500 bg-blue-500/10' },
                  { label: 'WhatsApp ok', value: configured.length, icon: Wifi, tone: 'text-emerald-500 bg-emerald-500/10' },
                  { label: 'Sem instância', value: notConfigured.length, icon: WifiOff, tone: 'text-rose-500 bg-rose-500/10' },
                  { label: 'Marketplaces', value: 4, icon: ShoppingBag, tone: 'text-amber-500 bg-amber-500/10' },
                ].map(stat => (
                  <Card key={stat.label} className="border-border/60 hover:shadow-md transition-shadow">
                    <CardContent className="pt-5 pb-4">
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center mb-3 ${stat.tone}`}>
                        <stat.icon className="h-4 w-4" />
                      </div>
                      <p className="text-2xl font-black tracking-tight">{stat.value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div>
                <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">Acesso rápido</h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { id: 'accounts', label: 'Contas & Lojas', icon: Users, desc: 'Gerencie tenants e impersonação' },
                    { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, desc: 'Configure instâncias Z-API' },
                    { id: 'plans', label: 'Planos', icon: Crown, desc: 'Atribua planos comerciais' },
                    { id: 'support', label: 'Suporte', icon: Headset, desc: 'Tickets e regras' },
                  ].map(card => (
                    <button
                      key={card.id}
                      onClick={() => setActive(card.id)}
                      className="text-left rounded-xl border border-border/60 bg-card p-4 hover:border-primary/40 hover:shadow-md transition-all group"
                    >
                      <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <card.icon className="h-4 w-4" />
                      </div>
                      <p className="font-semibold text-sm">{card.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{card.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {active === 'accounts' && <AccountsImpersonateManager />}

          {active === 'support' && (
            <Tabs defaultValue="tickets">
              <TabsList>
                <TabsTrigger value="tickets">Tickets</TabsTrigger>
                <TabsTrigger value="rules">Regras de ação</TabsTrigger>
              </TabsList>
              <TabsContent value="tickets" className="mt-4"><SupportDashboard /></TabsContent>
              <TabsContent value="rules" className="mt-4"><SupportActionRulesManager /></TabsContent>
            </Tabs>
          )}

          {active === 'pix' && <PixPaymentsManagement />}
          {active === 'shopee' && <ShopeeCredentials />}
          {active === 'meli' && <MercadoLivreCredentials />}
          {active === 'amazon' && <AmazonCredentials />}
          {active === 'magalu' && <MagaluCredentials />}
          {active === 'melhor-envio' && <MelhorEnvioCredentials />}
          {active === 'uber-direct' && <UberDirectCredentials />}
          {active === 'ai' && <AiSimulationManagement />}
          {active === 'plans' && <PlanManagement />}
          {active === 'plans-editor' && <PlansEditor />}
          {active === 'social' && <SocialLinksManager />}

          {active === 'whatsapp' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4 pb-3 flex items-center gap-3">
                    <Store className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-2xl font-bold">{stores.length}</p>
                      <p className="text-xs text-muted-foreground">Total de lojas</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3 flex items-center gap-3">
                    <Wifi className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="text-2xl font-bold">{configured.length}</p>
                      <p className="text-xs text-muted-foreground">Instâncias configuradas</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3 flex items-center gap-3">
                    <WifiOff className="h-5 w-5 text-destructive" />
                    <div>
                      <p className="text-2xl font-bold">{notConfigured.length}</p>
                      <p className="text-xs text-muted-foreground">Sem instância</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-l-4 border-l-green-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Link2 className="h-4 w-4" /> Webhook Z-API (Global)</CardTitle>
                  <CardDescription className="text-xs">Cole esta URL no campo "Received" de cada instância na Z-API</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Input value={webhookUrl} readOnly className="font-mono text-xs" />
                    <Button variant="outline" size="icon" onClick={() => copyWebhook('global')}>
                      {copiedId === 'global' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar loja ou conta..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="space-y-3">
                {filtered.map(store => {
                  const isConfigured = !!store.chatbot_settings?.z_api_instance_id;
                  const isEditing = editingStore === store.id;

                  return (
                    <Card key={store.id} className={`transition-all ${isEditing ? 'ring-2 ring-primary' : ''}`}>
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold truncate">{store.name}</h3>
                              <Badge variant={isConfigured ? 'default' : 'secondary'} className="text-[10px]">
                                {isConfigured ? 'Configurada' : 'Sem instância'}
                              </Badge>
                              {store.chatbot_settings?.is_active && (
                                <Badge variant="outline" className="text-[10px] border-green-500 text-green-600">Ativo</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">Conta: {store.account_name}</p>
                            {isConfigured && !isEditing && (
                              <p className="text-xs text-muted-foreground mt-1 font-mono">
                                Instance: {store.chatbot_settings!.z_api_instance_id.slice(0, 12)}...
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {!isEditing ? (
                              <Button size="sm" variant="outline" onClick={() => handleEdit(store)}>
                                {isConfigured ? 'Editar' : 'Configurar'}
                              </Button>
                            ) : (
                              <>
                                <Button size="sm" variant="ghost" onClick={() => setEditingStore(null)}>Cancelar</Button>
                                <Button size="sm" onClick={() => handleSave(store)} disabled={saving === store.id}>
                                  {saving === store.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                                  Salvar
                                </Button>
                              </>
                            )}
                          </div>
                        </div>

                        {isEditing && (
                          <div className="mt-4 grid gap-3 sm:grid-cols-3 border-t pt-4">
                            <div className="space-y-1">
                              <Label className="text-xs">Instance ID</Label>
                              <Input
                                value={editForm.z_api_instance_id}
                                onChange={e => setEditForm({ ...editForm, z_api_instance_id: e.target.value })}
                                placeholder="ID da instância"
                                className="text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Instance Token</Label>
                              <Input
                                value={editForm.z_api_instance_token}
                                onChange={e => setEditForm({ ...editForm, z_api_instance_token: e.target.value })}
                                placeholder="Token da instância"
                                type="password"
                                className="text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Client Token</Label>
                              <Input
                                value={editForm.z_api_client_token}
                                onChange={e => setEditForm({ ...editForm, z_api_client_token: e.target.value })}
                                placeholder="Client Token"
                                type="password"
                                className="text-sm"
                              />
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/* ——— Social Links Manager ——— */
function SocialLinksManager() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [links, setLinks] = useState({ social_instagram: '', social_facebook: '', social_linkedin: '' });

  useEffect(() => {
    supabase.from('site_settings').select('key, value').in('key', ['social_instagram', 'social_facebook', 'social_linkedin']).then(({ data }) => {
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((r: any) => { map[r.key] = r.value; });
        setLinks({
          social_instagram: map.social_instagram || '',
          social_facebook: map.social_facebook || '',
          social_linkedin: map.social_linkedin || '',
        });
      }
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    for (const [key, value] of Object.entries(links)) {
      await supabase.from('site_settings').update({ value }).eq('key', key);
    }
    setSaving(false);
    toast({ title: 'Links salvos com sucesso!' });
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2"><Globe className="h-5 w-5" /> Redes Sociais</CardTitle>
        <CardDescription>Configure os links das redes sociais que aparecem no rodapé da landing page.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm"><InstagramLogo className="h-4 w-4 text-[#E4405F]" /> Instagram</Label>
          <Input placeholder="https://instagram.com/seuusuario" value={links.social_instagram} onChange={e => setLinks({ ...links, social_instagram: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm"><FacebookLogo className="h-4 w-4 text-[#1877F2]" /> Facebook</Label>
          <Input placeholder="https://facebook.com/suapagina" value={links.social_facebook} onChange={e => setLinks({ ...links, social_facebook: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm"><LinkedInLogo className="h-4 w-4 text-[#0A66C2]" /> LinkedIn</Label>
          <Input placeholder="https://linkedin.com/company/suaempresa" value={links.social_linkedin} onChange={e => setLinks({ ...links, social_linkedin: e.target.value })} />
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar links
        </Button>
      </CardContent>
    </Card>
  );
}

/* ——— Accounts Impersonate Manager ——— */
interface AccountRow {
  id: string;
  name: string;
  owner_user_id: string;
  owner_email: string | null;
  owner_name: string | null;
  plan_status: string;
  created_at: string;
  store_count: number;
}

function AccountsImpersonateManager() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [search, setSearch] = useState('');
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AccountRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteOwnerUser, setDeleteOwnerUser] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteConfirm.trim() !== deleteTarget.name.trim()) {
      toast({ variant: 'destructive', title: 'Confirmação inválida', description: 'Digite exatamente o nome da empresa.' });
      return;
    }
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-account', {
        body: {
          account_id: deleteTarget.id,
          confirm_name: deleteConfirm,
          delete_owner_user: deleteOwnerUser,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({
        title: 'Empresa excluída',
        description: `"${deleteTarget.name}" foi removida${(data as any)?.owner_deleted ? ' (incluindo o usuário proprietário)' : ''}.`,
      });
      setDeleteTarget(null);
      setDeleteConfirm('');
      setDeleteOwnerUser(false);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao excluir';
      toast({ variant: 'destructive', title: 'Erro', description: msg });
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      // Fetch accounts (paginated to handle large data)
      const { data: accs } = await supabase
        .from('accounts')
        .select('id, name, owner_user_id, plan_status, created_at')
        .order('created_at', { ascending: false })
        .limit(500);

      if (!accs?.length) { setAccounts([]); setLoading(false); return; }

      const ownerIds = [...new Set(accs.map((a: any) => a.owner_user_id).filter(Boolean))];
      const accIds = accs.map((a: any) => a.id);

      // Profiles for owner names
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', ownerIds);
      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p.full_name]));

      // Stores count
      const { data: storesData } = await supabase
        .from('stores')
        .select('account_id')
        .in('account_id', accIds);
      const storeCounts = new Map<string, number>();
      (storesData || []).forEach((s: any) => {
        storeCounts.set(s.account_id, (storeCounts.get(s.account_id) || 0) + 1);
      });

      // Owner emails via edge function (batch)
      let emailMap: Record<string, string> = {};
      try {
        const { data: emailData } = await supabase.functions.invoke('list-account-owners-emails', {
          body: { user_ids: ownerIds },
        });
        emailMap = emailData?.emails || {};
      } catch (_e) { /* optional */ }

      const rows: AccountRow[] = accs.map((a: any) => ({
        id: a.id,
        name: a.name,
        owner_user_id: a.owner_user_id,
        owner_email: emailMap[a.owner_user_id] || null,
        owner_name: profileMap.get(a.owner_user_id) || null,
        plan_status: a.plan_status,
        created_at: a.created_at,
        store_count: storeCounts.get(a.id) || 0,
      }));
      setAccounts(rows);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao carregar contas';
      toast({ variant: 'destructive', title: 'Erro', description: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleImpersonate = async (acc: AccountRow) => {
    if (!confirm(`Acessar a conta "${acc.name}" como ${acc.owner_email || 'proprietário'}?\n\nVocê será redirecionado para o painel da conta. Para retornar, use o botão "Sair do modo" no topo da tela.`)) return;
    setImpersonatingId(acc.id);
    try {
      await startImpersonation({ account_id: acc.id });
      // hard reload happens inside
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao impersonar';
      toast({ variant: 'destructive', title: 'Erro', description: msg });
      setImpersonatingId(null);
    }
  };

  const filtered = accounts.filter(a => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return a.name.toLowerCase().includes(q)
      || (a.owner_email || '').toLowerCase().includes(q)
      || (a.owner_name || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <Card className="border-l-4 border-l-amber-500">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UserCog className="h-4 w-4" /> Acesso assistido (Impersonate)
          </CardTitle>
          <CardDescription className="text-xs">
            Acesse a conta de um lojista para ajudá-lo. Sua sessão de Super Admin será preservada e você pode retornar a qualquer momento pelo banner vermelho no topo.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome da conta, email ou proprietário..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {filtered.length} conta{filtered.length !== 1 ? 's' : ''} {search && `(de ${accounts.length})`}
          </p>
          {filtered.map(acc => (
            <Card key={acc.id} className="hover:border-primary/40 transition-colors">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold truncate">{acc.name}</h3>
                      <Badge variant={acc.plan_status === 'active' ? 'default' : acc.plan_status === 'trial' ? 'secondary' : 'destructive'} className="text-[10px]">
                        {acc.plan_status}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <Store className="h-3 w-3" /> {acc.store_count}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                      {acc.owner_name && <p>Owner: <strong className="text-foreground">{acc.owner_name}</strong></p>}
                      {acc.owner_email && <p className="font-mono">{acc.owner_email}</p>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Button
                      size="sm"
                      onClick={() => handleImpersonate(acc)}
                      disabled={impersonatingId === acc.id || !acc.owner_user_id}
                      className="gap-1.5"
                    >
                      {impersonatingId === acc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCog className="h-3.5 w-3.5" />}
                      Acessar como
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setDeleteTarget(acc); setDeleteConfirm(''); setDeleteOwnerUser(false); }}
                      className="gap-1.5 text-destructive hover:bg-destructive hover:text-destructive-foreground border-destructive/30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Excluir
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">Nenhuma conta encontrada.</p>
          )}
        </div>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o && !deleting) { setDeleteTarget(null); setDeleteConfirm(''); setDeleteOwnerUser(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Excluir empresa permanentemente
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Esta ação <strong>não pode ser desfeita</strong>. Todos os dados de{' '}
                  <strong>{deleteTarget?.name}</strong> serão removidos:
                  vendas, clientes, produtos, estoque, notas fiscais, lojas, usuários vinculados, etc.
                </p>
                <p>Para confirmar, digite o nome exato da empresa abaixo.</p>
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome da empresa</Label>
              <Input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={deleteTarget?.name || ''}
                disabled={deleting}
              />
            </div>
            <label className="flex items-start gap-2 text-xs cursor-pointer">
              <Checkbox
                checked={deleteOwnerUser}
                onCheckedChange={(v) => setDeleteOwnerUser(!!v)}
                disabled={deleting}
              />
              <span className="text-muted-foreground">
                Também excluir o usuário proprietário (<strong>{deleteTarget?.owner_email || 'sem email'}</strong>)
                se ele não pertencer a outra conta. Libera o e-mail para novo cadastro.
              </span>
            </label>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setDeleteTarget(null); setDeleteConfirm(''); setDeleteOwnerUser(false); }}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting || !deleteTarget || deleteConfirm.trim() !== (deleteTarget?.name || '').trim()}
              className="gap-1.5"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Excluir definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
