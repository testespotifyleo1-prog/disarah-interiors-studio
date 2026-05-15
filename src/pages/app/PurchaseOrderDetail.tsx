import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, CheckCircle, XCircle, FileDown, Truck, PackageCheck, ThumbsUp } from 'lucide-react';
import { format } from 'date-fns';
import { logActivity } from '@/utils/activityLog';
import { generatePurchaseOrderPDF } from '@/utils/generatePurchaseOrderPDF';

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Rascunho', variant: 'secondary' },
  requested: { label: 'Solicitado', variant: 'outline' },
  approved: { label: 'Aprovado', variant: 'default' },
  ordered: { label: 'Pedido ao Fornecedor', variant: 'default' },
  partial_received: { label: 'Recebido Parcial', variant: 'outline' },
  received: { label: 'Recebido', variant: 'default' },
  cancelled: { label: 'Cancelado', variant: 'destructive' },
};

export default function PurchaseOrderDetail() {
  const { id } = useParams();
  const { user, currentAccount, stores, canEdit } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => { if (id) loadOrder(); }, [id]);

  const loadOrder = async () => {
    setLoading(true);
    const [{ data: o }, { data: itms }] = await Promise.all([
      supabase.from('purchase_orders').select('*, suppliers(name, phone, document), stores(name, phone, address_json)').eq('id', id!).single(),
      supabase.from('purchase_order_items').select('*, products(name, sku, unit)').eq('purchase_order_id', id!),
    ]);
    setOrder(o);
    setItems(itms || []);
    setLoading(false);
  };

  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const updateStatus = async (newStatus: string, extra: Record<string, any> = {}) => {
    setActing(true);
    try {
      // If receiving, update inventory
      if (newStatus === 'received' && order.store_id) {
        for (const item of items) {
          const qty = item.qty_received > 0 ? item.qty_received : item.qty_ordered;
          const { data: inv } = await supabase.from('inventory')
            .select('id, qty_on_hand').eq('store_id', order.store_id).eq('product_id', item.product_id).maybeSingle();
          if (inv) {
            await supabase.from('inventory').update({ qty_on_hand: inv.qty_on_hand + qty, updated_at: new Date().toISOString() }).eq('id', inv.id);
          } else {
            await supabase.from('inventory').insert({ store_id: order.store_id, product_id: item.product_id, qty_on_hand: qty });
          }
          // Update cost if provided
          if (item.unit_cost > 0) {
            await supabase.from('products').update({ cost_default: item.unit_cost }).eq('id', item.product_id);
          }
          await supabase.from('purchase_order_items').update({ qty_received: qty }).eq('id', item.id);
        }
      }

      const { error } = await supabase.from('purchase_orders').update({ status: newStatus, ...extra }).eq('id', id!);
      if (error) throw error;

      await logActivity({ accountId: currentAccount!.id, userId: user!.id, userName: user!.email, action: 'update', entityType: 'purchase_order', entityId: id, details: { status: newStatus } });
      toast({ title: `Pedido ${STATUS_MAP[newStatus]?.label || newStatus}!` });
      loadOrder();
      setShowCancel(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally { setActing(false); }
  };

  const handleDownloadPDF = () => {
    if (order && items.length > 0) generatePurchaseOrderPDF(order, items);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!order) return <div className="text-center py-12 text-muted-foreground">Pedido não encontrado.</div>;

  const canApprove = order.status === 'requested' && canEdit;
  const canOrder = order.status === 'approved' && canEdit;
  const canReceive = ['ordered', 'partial_received'].includes(order.status) && canEdit;
  const canCancel = !['received', 'cancelled'].includes(order.status) && canEdit;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/app/purchase-orders')}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold">PC #{order.order_number}</h1>
            <Badge variant={STATUS_MAP[order.status]?.variant}>{STATUS_MAP[order.status]?.label}</Badge>
            {order.type === 'replenishment' && <Badge variant="outline">Reposição</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{format(new Date(order.created_at), 'dd/MM/yyyy HH:mm')}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Fornecedor</CardTitle></CardHeader>
          <CardContent><p className="font-medium">{order.suppliers?.name || 'Não informado'}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Loja Destino</CardTitle></CardHeader>
          <CardContent><p className="font-medium">{order.stores?.name || 'Não informado'}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total</CardTitle></CardHeader>
          <CardContent><p className="font-bold text-lg">{formatCurrency(order.total)}</p></CardContent>
        </Card>
      </div>

      {order.notes && (
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Observações</CardTitle></CardHeader>
        <CardContent><p className="text-sm">{order.notes}</p></CardContent></Card>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Itens do Pedido</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Custo Unit.</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Recebido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, idx) => (
                <TableRow key={item.id}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell>{item.products?.name}</TableCell>
                  <TableCell>{item.products?.sku || '-'}</TableCell>
                  <TableCell className="text-right">{item.qty_ordered}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.unit_cost)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.total_line)}</TableCell>
                  <TableCell className="text-right">{item.qty_received > 0 ? item.qty_received : '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="text-right pt-3 border-t mt-3">
            <p className="font-bold">Total: {formatCurrency(order.total)}</p>
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Histórico</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>📝 Criado em {format(new Date(order.created_at), 'dd/MM/yyyy HH:mm')}</p>
          {order.approved_at && <p>✅ Aprovado em {format(new Date(order.approved_at), 'dd/MM/yyyy HH:mm')}</p>}
          {order.ordered_at && <p>📦 Pedido ao fornecedor em {format(new Date(order.ordered_at), 'dd/MM/yyyy HH:mm')}</p>}
          {order.received_at && <p>🏪 Recebido em {format(new Date(order.received_at), 'dd/MM/yyyy HH:mm')}</p>}
          {order.canceled_at && <p>❌ Cancelado em {format(new Date(order.canceled_at), 'dd/MM/yyyy HH:mm')}{order.cancel_reason ? ` — ${order.cancel_reason}` : ''}</p>}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={handleDownloadPDF}><FileDown className="mr-1 h-4 w-4" /> PDF</Button>
        {canApprove && <Button size="sm" onClick={() => updateStatus('approved', { approved_by: user!.id, approved_at: new Date().toISOString() })} disabled={acting}><ThumbsUp className="mr-1 h-4 w-4" /> Aprovar</Button>}
        {canOrder && <Button size="sm" onClick={() => updateStatus('ordered', { ordered_at: new Date().toISOString() })} disabled={acting}><Truck className="mr-1 h-4 w-4" /> Marcar Pedido</Button>}
        {canReceive && <Button size="sm" onClick={() => updateStatus('received', { received_by: user!.id, received_at: new Date().toISOString() })} disabled={acting}><CheckCircle className="mr-1 h-4 w-4" /> Confirmar Recebimento</Button>}
        {canCancel && <Button size="sm" variant="destructive" onClick={() => setShowCancel(true)} disabled={acting}><XCircle className="mr-1 h-4 w-4" /> Cancelar</Button>}
      </div>

      <Dialog open={showCancel} onOpenChange={setShowCancel}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancelar Pedido de Compra</DialogTitle></DialogHeader>
          <Textarea placeholder="Motivo..." value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancel(false)}>Voltar</Button>
            <Button variant="destructive" onClick={() => updateStatus('cancelled', { canceled_by: user!.id, canceled_at: new Date().toISOString(), cancel_reason: cancelReason || null })} disabled={acting}>
              {acting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
