import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, ArrowRightLeft, PackageCheck, Truck, CheckCircle, XCircle, FileDown } from 'lucide-react';
import { format } from 'date-fns';
import { logActivity } from '@/utils/activityLog';
import { generateTransferPDF } from '@/utils/generateTransferPDF';

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Rascunho', variant: 'secondary' },
  requested: { label: 'Solicitada', variant: 'outline' },
  separated: { label: 'Separada', variant: 'default' },
  shipped: { label: 'Enviada', variant: 'default' },
  received: { label: 'Recebida', variant: 'default' },
  canceled: { label: 'Cancelada', variant: 'destructive' },
};

export default function StoreTransferDetail() {
  const { id } = useParams();
  const { user, currentAccount, stores, canEdit } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [transfer, setTransfer] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => { if (id) loadTransfer(); }, [id]);

  const loadTransfer = async () => {
    setLoading(true);
    const [{ data: t }, { data: itms }] = await Promise.all([
      supabase.from('store_transfers')
        .select('*, from_store:stores!store_transfers_from_store_id_fkey(name, cnpj, address_json), to_store:stores!store_transfers_to_store_id_fkey(name, cnpj, address_json)')
        .eq('id', id!)
        .single(),
      supabase.from('store_transfer_items')
        .select('*, products(name, sku, unit)')
        .eq('transfer_id', id!),
    ]);
    setTransfer(t);
    setItems(itms || []);
    setLoading(false);
  };

  const updateStatus = async (newStatus: string, extraFields: Record<string, any> = {}) => {
    setActing(true);
    try {
      // If shipping, deduct inventory from origin
      if (newStatus === 'shipped') {
        for (const item of items) {
          const { data: inv } = await supabase.from('inventory')
            .select('id, qty_on_hand')
            .eq('store_id', transfer.from_store_id)
            .eq('product_id', item.product_id)
            .single();
          if (!inv || inv.qty_on_hand < item.qty_requested) {
            toast({ variant: 'destructive', title: `Estoque insuficiente para ${item.products?.name}` });
            setActing(false);
            return;
          }
          await supabase.from('inventory').update({ qty_on_hand: inv.qty_on_hand - item.qty_requested, updated_at: new Date().toISOString() }).eq('id', inv.id);
        }
      }

      // If receiving, add inventory to destination
      if (newStatus === 'received') {
        for (const item of items) {
          const qty = item.qty_received > 0 ? item.qty_received : item.qty_requested;
          const { data: inv } = await supabase.from('inventory')
            .select('id, qty_on_hand')
            .eq('store_id', transfer.to_store_id)
            .eq('product_id', item.product_id)
            .maybeSingle();
          if (inv) {
            await supabase.from('inventory').update({ qty_on_hand: inv.qty_on_hand + qty, updated_at: new Date().toISOString() }).eq('id', inv.id);
          } else {
            await supabase.from('inventory').insert({ store_id: transfer.to_store_id, product_id: item.product_id, qty_on_hand: qty });
          }
          // Update received qty
          await supabase.from('store_transfer_items').update({ qty_received: qty }).eq('id', item.id);
        }
      }

      // If canceling after shipped, reverse inventory
      if (newStatus === 'canceled' && transfer.status === 'shipped') {
        for (const item of items) {
          const { data: inv } = await supabase.from('inventory')
            .select('id, qty_on_hand')
            .eq('store_id', transfer.from_store_id)
            .eq('product_id', item.product_id)
            .maybeSingle();
          if (inv) {
            await supabase.from('inventory').update({ qty_on_hand: inv.qty_on_hand + item.qty_requested, updated_at: new Date().toISOString() }).eq('id', inv.id);
          } else {
            await supabase.from('inventory').insert({ store_id: transfer.from_store_id, product_id: item.product_id, qty_on_hand: item.qty_requested });
          }
        }
      }

      const { error } = await supabase.from('store_transfers').update({ status: newStatus, ...extraFields }).eq('id', id!);
      if (error) throw error;

      await logActivity({
        accountId: currentAccount!.id, userId: user!.id, userName: user!.email,
        action: 'update', entityType: 'store_transfer', entityId: id,
        details: { status: newStatus },
      });

      toast({ title: `Transferência ${STATUS_MAP[newStatus]?.label || newStatus}!` });
      loadTransfer();
      setShowCancel(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
      setActing(false);
    }
  };

  const handleDownloadPDF = () => {
    if (transfer && items.length > 0) {
      generateTransferPDF(transfer, items, stores);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!transfer) return <div className="text-center py-12 text-muted-foreground">Transferência não encontrada.</div>;

  const canSeparate = transfer.status === 'requested' && canEdit;
  const canShip = (transfer.status === 'separated' || transfer.status === 'requested') && canEdit;
  const canReceive = transfer.status === 'shipped' && canEdit;
  const canCancel = !['received', 'canceled'].includes(transfer.status) && canEdit;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/app/transfers')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold">Transferência #{transfer.transfer_number}</h1>
            <Badge variant={STATUS_MAP[transfer.status]?.variant}>{STATUS_MAP[transfer.status]?.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{format(new Date(transfer.created_at), 'dd/MM/yyyy HH:mm')}</p>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Loja Origem</CardTitle></CardHeader>
          <CardContent><p className="font-medium">{transfer.from_store?.name}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Loja Destino</CardTitle></CardHeader>
          <CardContent><p className="font-medium">{transfer.to_store?.name}</p></CardContent>
        </Card>
      </div>

      {transfer.notes && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Observações</CardTitle></CardHeader>
          <CardContent><p className="text-sm">{transfer.notes}</p></CardContent>
        </Card>
      )}

      {/* Items Table */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Itens da Transferência</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Qtd Solicitada</TableHead>
                <TableHead className="text-right">Qtd Recebida</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, idx) => (
                <TableRow key={item.id}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell>{item.products?.name}</TableCell>
                  <TableCell>{item.products?.sku || '-'}</TableCell>
                  <TableCell className="text-right">{item.qty_requested}</TableCell>
                  <TableCell className="text-right">{item.qty_received || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Histórico</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>📝 Criada em {format(new Date(transfer.created_at), 'dd/MM/yyyy HH:mm')}</p>
          {transfer.separated_at && <p>📦 Separada em {format(new Date(transfer.separated_at), 'dd/MM/yyyy HH:mm')}</p>}
          {transfer.shipped_at && <p>🚚 Enviada em {format(new Date(transfer.shipped_at), 'dd/MM/yyyy HH:mm')}</p>}
          {transfer.received_at && <p>✅ Recebida em {format(new Date(transfer.received_at), 'dd/MM/yyyy HH:mm')}</p>}
          {transfer.canceled_at && <p>❌ Cancelada em {format(new Date(transfer.canceled_at), 'dd/MM/yyyy HH:mm')}{transfer.cancel_reason ? ` — ${transfer.cancel_reason}` : ''}</p>}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
          <FileDown className="mr-1 h-4 w-4" /> PDF
        </Button>
        {canSeparate && (
          <Button size="sm" onClick={() => updateStatus('separated', { separated_by: user!.id, separated_at: new Date().toISOString() })} disabled={acting}>
            <PackageCheck className="mr-1 h-4 w-4" /> Marcar Separada
          </Button>
        )}
        {canShip && (
          <Button size="sm" onClick={() => updateStatus('shipped', { shipped_by: user!.id, shipped_at: new Date().toISOString() })} disabled={acting}>
            <Truck className="mr-1 h-4 w-4" /> Marcar Enviada
          </Button>
        )}
        {canReceive && (
          <Button size="sm" onClick={() => updateStatus('received', { received_by: user!.id, received_at: new Date().toISOString() })} disabled={acting}>
            <CheckCircle className="mr-1 h-4 w-4" /> Confirmar Recebimento
          </Button>
        )}
        {canCancel && (
          <Button size="sm" variant="destructive" onClick={() => setShowCancel(true)} disabled={acting}>
            <XCircle className="mr-1 h-4 w-4" /> Cancelar
          </Button>
        )}
      </div>

      {/* Cancel Dialog */}
      <Dialog open={showCancel} onOpenChange={setShowCancel}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancelar Transferência</DialogTitle></DialogHeader>
          <Textarea placeholder="Motivo do cancelamento..." value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancel(false)}>Voltar</Button>
            <Button variant="destructive" onClick={() => updateStatus('canceled', { canceled_by: user!.id, canceled_at: new Date().toISOString(), cancel_reason: cancelReason || null })} disabled={acting}>
              {acting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Confirmar Cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
