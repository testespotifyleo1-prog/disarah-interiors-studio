import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Package, ScanLine, CheckCircle2, Truck, Plus, RefreshCw, Tag, ExternalLink, Share2, Copy, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

type PickingOrder = {
  id: string;
  status: string;
  sale_id: string | null;
  shipping_provider: string | null;
  shipping_label_url: string | null;
  tracking_code: string | null;
  public_token: string | null;
  notes: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  picking_items?: PickingItem[];
  sales?: { sequential_number: number | null; total: number; customer_name: string | null; customer_phone?: string | null } | null;
};

type PickingItem = {
  id: string;
  product_id: string | null;
  product_name: string;
  sku: string | null;
  barcode: string | null;
  qty_required: number;
  qty_picked: number;
  picked_at: string | null;
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending: { label: 'Aguardando separar', color: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20' },
  picking: { label: 'Em separação', color: 'bg-blue-500/10 text-blue-700 border-blue-500/20' },
  checked: { label: 'Conferido', color: 'bg-purple-500/10 text-purple-700 border-purple-500/20' },
  shipped: { label: 'Despachado', color: 'bg-green-500/10 text-green-700 border-green-500/20' },
};

export default function Picking() {
  const { currentAccount, currentStore, user, userRole } = useAuth();
  const isManager = !!userRole && ['owner', 'admin', 'manager'].includes(userRole);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<PickingOrder[]>([]);
  const [tab, setTab] = useState('pending');
  const [selected, setSelected] = useState<PickingOrder | null>(null);
  const [creating, setCreating] = useState(false);
  const [salesQuery, setSalesQuery] = useState('');
  const [eligibleSales, setEligibleSales] = useState<any[]>([]);

  useEffect(() => { if (currentAccount && currentStore) load(); }, [currentAccount?.id, currentStore?.id]);

  const load = async () => {
    if (!currentAccount || !currentStore) return;
    setLoading(true);
    const { data } = await supabase
      .from('picking_orders')
      .select('*, picking_items(*), sales(sequential_number, total, customer_name, customer_phone)')
      .eq('account_id', currentAccount.id)
      .eq('store_id', currentStore.id)
      .order('created_at', { ascending: false })
      .limit(200);
    setOrders((data || []) as any);
    setLoading(false);
  };

  const filtered = useMemo(() => orders.filter(o => o.status === tab), [orders, tab]);

  const openCreate = async () => {
    setCreating(true); setSalesQuery(''); setEligibleSales([]);
    const { data } = await supabase
      .from('sales')
      .select('id, sequential_number, total, customer_name, created_at')
      .eq('account_id', currentAccount!.id)
      .eq('store_id', currentStore!.id)
      .eq('status', 'paid')
      .order('created_at', { ascending: false })
      .limit(30);
    setEligibleSales(data || []);
  };

  const createForSale = async (saleId: string) => {
    const { data: items } = await supabase
      .from('sale_items')
      .select('product_id, qty, products(name, sku, barcode)')
      .eq('sale_id', saleId);
    const { data: po, error } = await supabase
      .from('picking_orders')
      .insert({ account_id: currentAccount!.id, store_id: currentStore!.id, sale_id: saleId, status: 'pending' })
      .select().single();
    if (error || !po) { toast.error('Erro ao criar separação'); return; }
    if (items && items.length) {
      await supabase.from('picking_items').insert(items.map((it: any) => ({
        picking_order_id: po.id,
        product_id: it.product_id,
        product_name: it.products?.name || 'Produto',
        sku: it.products?.sku || null,
        barcode: it.products?.barcode || null,
        qty_required: Number(it.qty || 1),
      })));
    }
    toast.success('Separação criada');
    setCreating(false);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Expedição (Picking)</h1>
          <p className="text-sm text-muted-foreground">Separação por bipagem, conferência e despacho dos pedidos.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1" />Atualizar</Button>
          {isManager && (
            <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" />Nova separação</Button>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <TabsTrigger key={k} value={k}>
              {v.label}
              <Badge variant="secondary" className="ml-2">{orders.filter(o => o.status === k).length}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>
        {Object.keys(STATUS_LABEL).map(k => (
          <TabsContent key={k} value={k} className="mt-4">
            {loading ? (
              <div className="flex h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground"><Package className="h-10 w-10 mx-auto mb-2 opacity-40" />Nenhum pedido</CardContent></Card>
            ) : (
              <div className="grid gap-3">
                {filtered.map(o => (
                  <Card key={o.id} className="cursor-pointer hover:bg-accent/50" onClick={() => setSelected(o)}>
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold">Venda #{o.sales?.sequential_number ?? '—'} · {o.sales?.customer_name ?? 'Sem cliente'}</p>
                        <p className="text-xs text-muted-foreground">
                          {o.picking_items?.length || 0} itens · {new Date(o.created_at).toLocaleString('pt-BR')}
                          {o.tracking_code && <> · <Truck className="inline h-3 w-3 mx-1" />{o.tracking_code}</>}
                        </p>
                      </div>
                      <Badge className={STATUS_LABEL[o.status]?.color}>{STATUS_LABEL[o.status]?.label}</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <PickingDetail order={selected} onClose={() => setSelected(null)} onChanged={load} userId={user?.id} isManager={isManager} accountId={currentAccount?.id} storeId={currentStore?.id} />

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Nova separação</DialogTitle>
            <DialogDescription>Selecione uma venda paga para criar a ordem de separação.</DialogDescription>
          </DialogHeader>
          <Input placeholder="Buscar #venda ou cliente..." value={salesQuery} onChange={e => setSalesQuery(e.target.value)} />
          <div className="max-h-[400px] overflow-y-auto space-y-1 scrollbar-thin">
            {eligibleSales
              .filter(s => !salesQuery || `${s.sequential_number}`.includes(salesQuery) || (s.customer_name || '').toLowerCase().includes(salesQuery.toLowerCase()))
              .map(s => (
                <button key={s.id} className="w-full text-left p-2 rounded hover:bg-accent flex justify-between" onClick={() => createForSale(s.id)}>
                  <span>#{s.sequential_number} · {s.customer_name || 'Consumidor'}</span>
                  <span className="text-muted-foreground text-sm">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(s.total)}</span>
                </button>
              ))}
            {eligibleSales.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Sem vendas pagas recentes.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PickingDetail({ order, onClose, onChanged, userId, isManager, accountId, storeId }: { order: PickingOrder | null; onClose: () => void; onChanged: () => void; userId?: string; isManager: boolean; accountId?: string; storeId?: string }) {
  const [scan, setScan] = useState('');
  const [items, setItems] = useState<PickingItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [labelOpen, setLabelOpen] = useState(false);
  const [waTemplate, setWaTemplate] = useState<string>('Olá {nome_cliente}! 📦 Acompanhe seu pedido #{numero_pedido} em tempo real: {link_rastreio}');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setItems(order?.picking_items || []);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [order?.id]);

  // chatbot_settings removed (WhatsApp feature deleted) — tracking template stays in default state

  if (!order) return null;

  const allDone = items.length > 0 && items.every(i => i.qty_picked >= i.qty_required);

  const handleScan = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const code = scan.trim();
    if (!code) return;
    setScan('');
    const idx = items.findIndex(i => (i.barcode === code || i.sku === code) && i.qty_picked < i.qty_required);
    if (idx === -1) {
      toast.error(`Código não encontrado ou já bipado: ${code}`);
      return;
    }
    const item = items[idx];
    const newQty = item.qty_picked + 1;
    const updated = [...items];
    updated[idx] = { ...item, qty_picked: newQty, picked_at: new Date().toISOString() };
    setItems(updated);
    await supabase.from('picking_items').update({ qty_picked: newQty, picked_at: new Date().toISOString() }).eq('id', item.id);
    if (order.status === 'pending') {
      await supabase.from('picking_orders').update({ status: 'picking', started_at: new Date().toISOString(), picker_user_id: userId }).eq('id', order.id);
    }
    toast.success(`Bipado: ${item.product_name} (${newQty}/${item.qty_required})`);
  };

  const markChecked = async () => {
    setBusy(true);
    await supabase.from('picking_orders').update({ status: 'checked' }).eq('id', order.id);
    setBusy(false); onChanged(); onClose();
    toast.success('Pedido conferido');
  };

  const markShipped = async () => {
    setBusy(true);
    await supabase.from('picking_orders').update({ status: 'shipped', finished_at: new Date().toISOString() }).eq('id', order.id);
    setBusy(false); onChanged(); onClose();
    toast.success('Pedido despachado');
  };

  return (
    <Dialog open={!!order} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Separação · Venda #{order.sales?.sequential_number ?? '—'}</DialogTitle>
          <DialogDescription>{order.sales?.customer_name || 'Sem cliente'}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ScanLine className="h-4 w-4 text-muted-foreground" />
            <Input ref={inputRef} placeholder="Bipe o código de barras ou SKU..." value={scan} onChange={e => setScan(e.target.value)} onKeyDown={handleScan} autoFocus />
          </div>
          <div className="max-h-[300px] overflow-y-auto scrollbar-thin space-y-1">
            {items.map(i => {
              const done = i.qty_picked >= i.qty_required;
              return (
                <div key={i.id} className={`flex items-center justify-between p-2 rounded border ${done ? 'bg-green-500/5 border-green-500/30' : ''}`}>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{i.product_name}</p>
                    <p className="text-xs text-muted-foreground">{i.barcode || i.sku || 'Sem código'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${done ? 'text-green-600' : 'text-foreground'}`}>{i.qty_picked}/{i.qty_required}</span>
                    {done && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                  </div>
                </div>
              );
            })}
          </div>

          {(order.tracking_code || order.shipping_label_url) && (
            <div className="rounded border bg-accent/30 p-3 text-sm space-y-1">
              <p className="font-semibold flex items-center gap-2"><Truck className="h-4 w-4" /> Envio</p>
              {order.shipping_provider && <p className="text-xs text-muted-foreground">Transportadora: {order.shipping_provider}</p>}
              {order.tracking_code && <p>Código: <span className="font-mono">{order.tracking_code}</span></p>}
              {order.shipping_label_url && (
                <a href={order.shipping_label_url} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1 text-xs hover:underline">
                  <ExternalLink className="h-3 w-3" /> Abrir etiqueta / acompanhar
                </a>
              )}
            </div>
          )}

          {order.public_token && (() => {
            const url = `${window.location.origin}/rastreio/${order.public_token}`;
            const phone = (order.sales?.customer_phone || '').replace(/\D/g, '');
            const firstName = (order.sales?.customer_name || 'cliente').split(' ')[0];
            const orderNum = String(order.sales?.sequential_number ?? '');
            const rendered = waTemplate
              .replace(/\{nome_cliente\}/g, firstName)
              .replace(/\{numero_pedido\}/g, orderNum)
              .replace(/\{link_rastreio\}/g, url);
            const msg = encodeURIComponent(rendered);
            const wa = phone ? `https://wa.me/55${phone}?text=${msg}` : `https://wa.me/?text=${msg}`;
            return (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                <p className="font-semibold flex items-center gap-2 text-sm"><Share2 className="h-4 w-4 text-primary" /> Link público de rastreio</p>
                <div className="flex items-center gap-2">
                  <Input readOnly value={url} className="font-mono text-xs h-8" onFocus={(e) => e.currentTarget.select()} />
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(url); toast.success('Link copiado'); }}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => window.open(wa, '_blank')}>
                    <MessageCircle className="h-3.5 w-3.5 mr-1" /> WhatsApp
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">O cliente vê status, etapas e código de rastreio sem precisar de login.</p>
              </div>
            );
          })()}
        </div>
        <DialogFooter className="gap-2 flex-wrap">
          {order.status === 'picking' && allDone && (
            <Button onClick={markChecked} disabled={busy}><CheckCircle2 className="h-4 w-4 mr-1" />Conferido</Button>
          )}
          {isManager && (order.status === 'checked' || order.status === 'picking') && !order.shipping_label_url && (
            <Button variant="outline" onClick={() => setLabelOpen(true)}><Tag className="h-4 w-4 mr-1" />Gerar etiqueta</Button>
          )}
          {order.status === 'checked' && (
            <Button onClick={markShipped} disabled={busy}><Truck className="h-4 w-4 mr-1" />Despachar</Button>
          )}
        </DialogFooter>

        <ShippingLabelDialog
          open={labelOpen}
          onClose={() => setLabelOpen(false)}
          order={order}
          accountId={accountId}
          onGenerated={() => { setLabelOpen(false); onChanged(); onClose(); }}
        />
      </DialogContent>
    </Dialog>
  );
}

function ShippingLabelDialog({ open, onClose, order, accountId, onGenerated }: any) {
  const [busy, setBusy] = useState(false);
  const [tracking, setTracking] = useState('');
  const [provider, setProvider] = useState('correios');
  const [labelUrl, setLabelUrl] = useState('');

  const generateMelhorEnvio = async () => {
    if (!order?.sale_id) { toast.error('Pedido sem venda vinculada'); return; }
    setBusy(true);
    try {
      // Cotação prévia → o usuário escolhe o serviço mais barato
      const { data: quote, error: qErr } = await supabase.functions.invoke('melhor-envio-quote', {
        body: { accountId, saleId: order.sale_id },
      });
      if (qErr) throw qErr;
      const services = Array.isArray(quote) ? quote.filter((q: any) => !q.error) : [];
      if (!services.length) throw new Error('Sem serviços disponíveis. Verifique remetente/destinatário.');
      const cheapest = services.sort((a: any, b: any) => Number(a.price) - Number(b.price))[0];

      const { data, error } = await supabase.functions.invoke('melhor-envio-buy-label', {
        body: { accountId, saleId: order.sale_id, service_id: cheapest.id, ...quote.__shipment_payload },
      });
      if (error || !data?.success) throw new Error(data?.error?.message || 'Falha ao comprar etiqueta');

      await supabase.from('picking_orders').update({
        shipping_provider: 'melhor_envio',
        shipping_label_url: data.label_url,
        tracking_code: data.tracking,
      }).eq('id', order.id);
      toast.success('Etiqueta gerada com sucesso');
      onGenerated();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar etiqueta');
    } finally {
      setBusy(false);
    }
  };

  const saveManual = async () => {
    if (!tracking.trim()) { toast.error('Informe o código de rastreio'); return; }
    setBusy(true);
    await supabase.from('picking_orders').update({
      shipping_provider: provider, tracking_code: tracking.trim(), shipping_label_url: labelUrl.trim() || null,
    }).eq('id', order.id);
    setBusy(false);
    toast.success('Rastreio salvo');
    onGenerated();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Etiqueta de expedição</DialogTitle>
          <DialogDescription>Gere automaticamente via Melhor Envio ou registre manualmente.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Button className="w-full" onClick={generateMelhorEnvio} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Tag className="h-4 w-4 mr-1" />}
            Gerar via Melhor Envio (mais barato)
          </Button>
          <div className="text-center text-xs text-muted-foreground">— ou registrar manualmente —</div>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Transportadora" value={provider} onChange={e => setProvider(e.target.value)} />
            <Input placeholder="Código de rastreio" value={tracking} onChange={e => setTracking(e.target.value)} />
          </div>
          <Input placeholder="URL da etiqueta (opcional)" value={labelUrl} onChange={e => setLabelUrl(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={saveManual} disabled={busy}>Salvar rastreio</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
