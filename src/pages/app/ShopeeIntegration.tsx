import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { ShopeeLogo } from '@/components/brand/BrandLogos';
import {
  Loader2, Search, Link2, Link2Off, RefreshCw, ShoppingBag,
  CheckCircle2, AlertCircle, Package, Image as ImageIcon, Layers, Info, Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface Connection {
  id: string;
  shop_id: string | null;
  shop_name: string | null;
  status: string;
  is_mock: boolean;
  connected_at: string | null;
  last_sync_at: string | null;
}

interface ProductRow {
  id: string;
  name: string;
  sku: string | null;
  price_default: number;
  image_url: string | null;
  variant_count: number;
  inventory_qty: number;
  link?: {
    id: string;
    sync_status: string;
    sync_error: string | null;
    shopee_item_id: string | null;
    shopee_price: number | null;
    last_synced_at: string | null;
  };
}

import { isModuleDisabled } from '@/utils/accountModules';
import IntegrationsBlocked from '@/components/IntegrationsBlocked';

export default function ShopeeIntegration() {
  const { currentAccount: account, currentStore } = useAuth();
  const { toast } = useToast();
  if (isModuleDisabled(account, 'integrations')) return <IntegrationsBlocked />;


  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (account?.id && currentStore?.id) loadConnection();
  }, [account?.id, currentStore?.id]);

  useEffect(() => {
    if (connection?.status === 'connected') loadProducts();
  }, [connection?.status, currentStore?.id]);

  const loadConnection = async () => {
    if (!currentStore?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('shopee_connections')
      .select('id, shop_id, shop_name, status, is_mock, connected_at, last_sync_at')
      .eq('store_id', currentStore.id)
      .maybeSingle();
    setConnection(data as Connection | null);
    setLoading(false);
  };

  const loadProducts = async () => {
    if (!account?.id || !currentStore?.id || !connection?.id) return;

    const [{ data: prods }, { data: links }, { data: invs }, { data: variants }] = await Promise.all([
      supabase
        .from('products')
        .select('id, name, sku, price_default, image_url')
        .eq('account_id', account.id)
        .eq('is_active', true)
        .order('name')
        .limit(500),
      supabase
        .from('shopee_product_links')
        .select('id, product_id, sync_status, sync_error, shopee_item_id, shopee_price, last_synced_at')
        .eq('connection_id', connection.id),
      supabase
        .from('inventory')
        .select('product_id, qty_on_hand')
        .eq('store_id', currentStore.id),
      supabase
        .from('product_variants')
        .select('product_id')
        .eq('is_active', true),
    ]);

    const linkMap = new Map((links || []).map((l: any) => [l.product_id, l]));
    const invMap = new Map<string, number>();
    (invs || []).forEach((i: any) => {
      invMap.set(i.product_id, (invMap.get(i.product_id) || 0) + Number(i.qty_on_hand || 0));
    });
    const varMap = new Map<string, number>();
    (variants || []).forEach((v: any) => {
      varMap.set(v.product_id, (varMap.get(v.product_id) || 0) + 1);
    });

    setProducts(
      (prods || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        price_default: Number(p.price_default || 0),
        image_url: p.image_url,
        variant_count: varMap.get(p.id) || 0,
        inventory_qty: invMap.get(p.id) || 0,
        link: linkMap.get(p.id) as any,
      })),
    );
  };

  const handleConnect = async () => {
    if (!account?.id || !currentStore?.id) return;
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('shopee-connect', {
        body: { account_id: account.id, store_id: currentStore.id, action: 'authorize' },
      });
      if (error) throw error;

      // Modo real: redireciona vendedor para autorizar na Shopee
      if (data?.authorize_url) {
        const popup = window.open(data.authorize_url, 'shopee_auth', 'width=900,height=750');
        toast({
          title: 'Autorize sua loja Shopee',
          description: 'Conclua o login no popup. Esta janela atualiza automaticamente.',
        });
        // Polling para detectar conexão concluída
        const interval = setInterval(async () => {
          if (popup?.closed) {
            clearInterval(interval);
            await loadConnection();
            setConnecting(false);
          }
        }, 1500);
        return;
      }

      // Modo mock (sem credenciais ainda)
      toast({
        title: 'Loja Shopee conectada!',
        description: data?.message || 'Conexão estabelecida com sucesso.',
      });
      await loadConnection();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro ao conectar', description: err.message });
    } finally {
      if (!connecting) setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!account?.id || !currentStore?.id) return;
    if (!confirm('Tem certeza que deseja desconectar sua loja Shopee?')) return;
    setConnecting(true);
    try {
      await supabase.functions.invoke('shopee-connect', {
        body: { account_id: account.id, store_id: currentStore.id, action: 'disconnect' },
      });
      toast({ title: 'Loja Shopee desconectada' });
      await loadConnection();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    } finally {
      setConnecting(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q),
    );
  }, [products, search]);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePublishSelected = async () => {
    if (!account?.id || !connection?.id || selectedIds.size === 0) return;
    setPublishing(true);
    try {
      const ids = Array.from(selectedIds);
      const { data, error } = await supabase.functions.invoke('shopee-publish', {
        body: {
          action: 'publish',
          account_id: account.id,
          connection_id: connection.id,
          product_ids: ids,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const ok = data?.published || 0;
      const fail = (data?.total || 0) - ok;
      const failures = (data?.results || []).filter((r: any) => !r.success);

      if (ok > 0 && fail === 0) {
        toast({
          title: `${ok} produto${ok > 1 ? 's' : ''} publicado${ok > 1 ? 's' : ''} na Shopee!`,
          description: 'Já estão visíveis no seu Seller Center.',
        });
      } else if (ok > 0 && fail > 0) {
        toast({
          variant: 'default',
          title: `${ok} publicado${ok > 1 ? 's' : ''} · ${fail} com erro`,
          description: failures[0]?.error || 'Veja os detalhes nos cards de erro.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Nenhum produto pôde ser publicado',
          description: failures[0]?.error || 'Verifique estoque, imagens e categorias.',
        });
      }
      setSelectedIds(new Set());
      await loadProducts();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro ao publicar', description: err.message });
    } finally {
      setPublishing(false);
    }
  };

  const handleResync = async (linkId: string) => {
    if (!account?.id || !connection?.id) return;
    // feedback otimista
    setProducts((prev) => prev.map((p) =>
      p.link?.id === linkId ? { ...p, link: { ...p.link!, sync_status: 'publishing' } } : p
    ));
    try {
      const { data, error } = await supabase.functions.invoke('shopee-publish', {
        body: {
          action: 'resync',
          account_id: account.id,
          connection_id: connection.id,
          link_id: linkId,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast({
        title: 'Sincronizado!',
        description: `Preço R$ ${Number(data?.price || 0).toFixed(2).replace('.', ',')} · Estoque ${data?.stock ?? 0}`,
      });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Falha ao sincronizar', description: err.message });
    } finally {
      await loadProducts();
    }
  };

  const handleRemoveLink = async (linkId: string) => {
    if (!account?.id || !connection?.id) return;
    if (!confirm('Pausar este anúncio na Shopee e remover do ERP?')) return;
    try {
      const { data, error } = await supabase.functions.invoke('shopee-publish', {
        body: {
          action: 'unpublish',
          account_id: account.id,
          connection_id: connection.id,
          link_id: linkId,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast({ title: 'Anúncio pausado na Shopee e removido do ERP' });
      await loadProducts();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro ao remover', description: err.message });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ============ NOT CONNECTED ============
  if (!connection || connection.status !== 'connected') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link to="/app/integrations" className="text-xs text-muted-foreground hover:text-foreground">
              ← Voltar para Integrações
            </Link>
            <h1 className="text-2xl font-bold text-foreground mt-1">Integração Shopee</h1>
          </div>
        </div>

        <Card className="overflow-hidden border-2">
          <div className="bg-gradient-to-br from-[#EE4D2D]/10 via-[#EE4D2D]/5 to-transparent p-8 sm:p-12">
            <div className="max-w-2xl mx-auto text-center space-y-6">
              <div className="flex justify-center">
                <div className="p-4 bg-white rounded-2xl shadow-sm">
                  <ShopeeLogo className="h-16 w-16" />
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-bold text-foreground">
                  Conecte sua loja Shopee em 1 clique
                </h2>
                <p className="text-muted-foreground text-base leading-relaxed">
                  Você só precisa autorizar o Typos! a acessar sua conta de vendedor.
                  Sem complicação técnica — cuidamos de tudo.
                </p>
              </div>

              <Button
                size="lg"
                onClick={handleConnect}
                disabled={connecting}
                className="h-14 px-10 text-base font-semibold bg-[#EE4D2D] hover:bg-[#d4421f] text-white shadow-lg hover:shadow-xl transition-all"
              >
                {connecting ? (
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                ) : (
                  <Link2 className="h-5 w-5 mr-2" />
                )}
                Conectar minha conta Shopee
              </Button>

              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
                <Info className="h-3 w-3" />
                Conexão segura via OAuth oficial da Shopee Brasil
              </p>
            </div>
          </div>

          <CardContent className="p-6 sm:p-8 grid sm:grid-cols-3 gap-6 bg-muted/30">
            {[
              { icon: Package, title: 'Você escolhe os produtos', desc: 'Selecione na lista quais itens vender na Shopee. Nada vai sem você autorizar.' },
              { icon: Layers, title: 'Estoque único no ERP', desc: 'O Typos! continua sendo a fonte da verdade. Vendeu na Shopee? Baixa automática.' },
              { icon: Sparkles, title: 'Tudo já vai pronto', desc: 'Nome, fotos, variações e preço são publicados automaticamente.' },
            ].map((f) => (
              <div key={f.title} className="space-y-2">
                <div className="h-9 w-9 rounded-lg bg-[#EE4D2D]/10 flex items-center justify-center">
                  <f.icon className="h-4 w-4 text-[#EE4D2D]" />
                </div>
                <h3 className="font-semibold text-sm text-foreground">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============ CONNECTED ============
  const publishedCount = products.filter((p) => p.link?.sync_status === 'published').length;
  const errorCount = products.filter((p) => p.link?.sync_status === 'error').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link to="/app/integrations" className="text-xs text-muted-foreground hover:text-foreground">
            ← Voltar para Integrações
          </Link>
          <h1 className="text-2xl font-bold text-foreground mt-1">Integração Shopee</h1>
        </div>
      </div>

      {/* Connection card */}
      <Card>
        <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-[#EE4D2D]/10 rounded-xl">
              <ShopeeLogo className="h-9 w-9" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-foreground">{connection.shop_name}</h2>
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Conectada
                </Badge>
                {connection.is_mock && (
                  <Badge variant="outline" className="text-[10px]">Modo demonstração</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Shop ID: {connection.shop_id} · Conectada em{' '}
                {connection.connected_at ? new Date(connection.connected_at).toLocaleDateString('pt-BR') : '—'}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={connecting}>
            <Link2Off className="h-4 w-4 mr-1.5" /> Desconectar
          </Button>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Produtos publicados', value: publishedCount, icon: CheckCircle2, color: 'text-emerald-600' },
          { label: 'Selecionados agora', value: selectedIds.size, icon: Package, color: 'text-primary' },
          { label: 'Com erro', value: errorCount, icon: AlertCircle, color: 'text-destructive' },
          { label: 'Pedidos recebidos', value: 0, icon: ShoppingBag, color: 'text-amber-600' },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <p className="text-2xl font-bold text-foreground mt-1">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="catalog" className="space-y-4">
        <TabsList>
          <TabsTrigger value="catalog">Catálogo do ERP</TabsTrigger>
          <TabsTrigger value="published">Publicados na Shopee ({publishedCount})</TabsTrigger>
          <TabsTrigger value="orders">Pedidos Shopee</TabsTrigger>
        </TabsList>

        {/* CATALOG */}
        <TabsContent value="catalog" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Selecione os produtos que vão para a Shopee</CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Marque na lista o que deseja anunciar. Vamos enviar nome, fotos, variações e preço automaticamente.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar produto..."
                      className="pl-8 h-9 text-sm w-64"
                    />
                  </div>
                  <Button
                    onClick={handlePublishSelected}
                    disabled={selectedIds.size === 0 || publishing}
                    className="bg-[#EE4D2D] hover:bg-[#d4421f] text-white h-9"
                  >
                    {publishing ? (
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-1.5" />
                    )}
                    Publicar {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="border-t divide-y max-h-[520px] overflow-y-auto">
                {filtered.length === 0 && (
                  <div className="text-center py-12 text-sm text-muted-foreground">
                    Nenhum produto encontrado.
                  </div>
                )}
                {filtered.map((p) => {
                  const isSelected = selectedIds.has(p.id);
                  const status = p.link?.sync_status;
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors ${
                        isSelected ? 'bg-primary/5' : ''
                      }`}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelected(p.id)}
                        disabled={status === 'published' || status === 'publishing'}
                      />
                      <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center overflow-hidden shrink-0">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[11px] text-muted-foreground">SKU: {p.sku || '—'}</span>
                          <span className="text-[11px] text-muted-foreground">·</span>
                          <span className="text-[11px] text-muted-foreground">
                            Estoque: {p.inventory_qty}
                          </span>
                          {p.variant_count > 0 && (
                            <>
                              <span className="text-[11px] text-muted-foreground">·</span>
                              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                                {p.variant_count} variações
                              </Badge>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold">
                          R$ {p.price_default.toFixed(2).replace('.', ',')}
                        </p>
                        {status === 'published' && (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-[10px] mt-1">
                            <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Publicado
                          </Badge>
                        )}
                        {status === 'publishing' && (
                          <Badge variant="secondary" className="text-[10px] mt-1">
                            <Loader2 className="h-2.5 w-2.5 mr-0.5 animate-spin" /> Publicando
                          </Badge>
                        )}
                        {status === 'error' && (
                          <Badge variant="destructive" className="text-[10px] mt-1">
                            <AlertCircle className="h-2.5 w-2.5 mr-0.5" /> Erro
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PUBLISHED */}
        <TabsContent value="published">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Anúncios ativos na Shopee</CardTitle>
              <CardDescription className="text-xs">
                Estoque sincronizado automaticamente a partir do ERP Typos!.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="border-t divide-y max-h-[520px] overflow-y-auto">
                {products.filter((p) => p.link).length === 0 && (
                  <div className="text-center py-12 text-sm text-muted-foreground">
                    Nenhum produto publicado ainda. Selecione na aba "Catálogo" e clique em Publicar.
                  </div>
                )}
                {products
                  .filter((p) => p.link)
                  .map((p) => (
                    <div key={p.id} className="flex items-center gap-3 p-3">
                      <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center overflow-hidden shrink-0">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          Item Shopee: {p.link?.shopee_item_id || '—'} · Estoque ERP: {p.inventory_qty}
                        </p>
                        {p.link?.sync_error && (
                          <p className="text-[11px] text-destructive mt-0.5">{p.link.sync_error}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => p.link && handleResync(p.link.id)}
                          className="h-8"
                        >
                          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Sincronizar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => p.link && handleRemoveLink(p.link.id)}
                          className="h-8 text-destructive hover:text-destructive"
                        >
                          Remover
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ORDERS */}
        <TabsContent value="orders">
          <Card>
            <CardContent className="py-12 text-center space-y-2">
              <ShoppingBag className="h-10 w-10 text-muted-foreground mx-auto" />
              <p className="text-sm font-medium">Aguardando primeiros pedidos da Shopee</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Quando alguém comprar um anúncio seu, o pedido aparece aqui e cai automaticamente
                como uma venda no ERP, baixando estoque.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
