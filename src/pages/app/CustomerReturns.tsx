import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Plus, RefreshCw, Undo2, ShieldCheck, Paperclip, X, PackageCheck } from 'lucide-react';
import { toast } from 'sonner';

const STATUS: Record<string, { label: string; color: string }> = {
  requested: { label: 'Solicitada', color: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20' },
  approved: { label: 'Aprovada', color: 'bg-blue-500/10 text-blue-700 border-blue-500/20' },
  rejected: { label: 'Rejeitada', color: 'bg-red-500/10 text-red-700 border-red-500/20' },
  resolved: { label: 'Resolvida', color: 'bg-green-500/10 text-green-700 border-green-500/20' },
};

const TYPE_LABEL: Record<string, string> = {
  exchange: 'Troca',
  warranty: 'Garantia',
  refund: 'Reembolso',
  defect: 'Defeito',
};

export default function CustomerReturns() {
  const { currentAccount, currentStore, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<any[]>([]);
  const [tab, setTab] = useState('requested');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  useEffect(() => { if (currentAccount && currentStore) load(); }, [currentAccount?.id, currentStore?.id]);

  const load = async () => {
    if (!currentAccount || !currentStore) return;
    setLoading(true);
    const { data } = await supabase
      .from('customer_returns')
      .select('*, sales(sequential_number, total), customers(name, phone)')
      .eq('account_id', currentAccount.id)
      .eq('store_id', currentStore.id)
      .order('requested_at', { ascending: false })
      .limit(300);
    setList(data || []); setLoading(false);
  };

  const filtered = list.filter(r => r.status === tab);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Trocas & Garantias</h1>
          <p className="text-sm text-muted-foreground">Atendimento de trocas, defeitos, garantias e reembolsos com baixa de estoque.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1" />Atualizar</Button>
          <Button size="sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1" />Nova solicitação</Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {Object.entries(STATUS).map(([k, v]) => (
            <TabsTrigger key={k} value={k}>
              {v.label} <Badge variant="secondary" className="ml-2">{list.filter(r => r.status === k).length}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          {loading ? (
            <div className="flex h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground"><Undo2 className="h-10 w-10 mx-auto mb-2 opacity-40" />Nenhuma solicitação</CardContent></Card>
          ) : (
            <div className="grid gap-2">
              {filtered.map(r => (
                <Card key={r.id} className="cursor-pointer hover:bg-accent/50" onClick={() => setEditing(r)}>
                  <CardContent className="p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">
                        {r.return_type === 'warranty' && <ShieldCheck className="inline h-4 w-4 mr-1 text-primary" />}
                        {TYPE_LABEL[r.return_type] || r.return_type} · {r.customers?.name || 'Sem cliente'}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{r.reason}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-2">
                        Venda #{r.sales?.sequential_number ?? '—'} · {new Date(r.requested_at).toLocaleDateString('pt-BR')}
                        {(r.attachments?.length || 0) > 0 && <span className="inline-flex items-center gap-1"><Paperclip className="h-3 w-3" />{r.attachments.length}</span>}
                        {r.stock_refunded && <span className="inline-flex items-center gap-1 text-green-600"><PackageCheck className="h-3 w-3" />estoque retornado</span>}
                      </p>
                    </div>
                    <Badge className={STATUS[r.status]?.color}>{STATUS[r.status]?.label || r.status}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ReturnFormDialog
        open={creating || !!editing}
        existing={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSaved={() => { setCreating(false); setEditing(null); load(); }}
        accountId={currentAccount?.id}
        storeId={currentStore?.id}
        userId={user?.id}
      />
    </div>
  );
}

function ReturnFormDialog({ open, existing, onClose, onSaved, accountId, storeId, userId }: any) {
  const [type, setType] = useState('exchange');
  const [reason, setReason] = useState('');
  const [saleId, setSaleId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [warrantyUntil, setWarrantyUntil] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [status, setStatus] = useState('requested');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [stockRefunded, setStockRefunded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [refundingStock, setRefundingStock] = useState(false);
  const [salesOptions, setSalesOptions] = useState<any[]>([]);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setType(existing.return_type); setReason(existing.reason); setSaleId(existing.sale_id || '');
      setCustomerId(existing.customer_id || ''); setWarrantyUntil(existing.warranty_until || '');
      setResolutionNotes(existing.resolution_notes || ''); setStatus(existing.status);
      setAttachments(existing.attachments || []); setStockRefunded(!!existing.stock_refunded);
    } else {
      setType('exchange'); setReason(''); setSaleId(''); setCustomerId(''); setWarrantyUntil('');
      setResolutionNotes(''); setStatus('requested'); setAttachments([]); setStockRefunded(false);
    }
    if (accountId && storeId) {
      supabase.from('sales').select('id, sequential_number, customer_id, customer_name')
        .eq('account_id', accountId).eq('store_id', storeId).eq('status', 'paid')
        .order('created_at', { ascending: false }).limit(50)
        .then(({ data }) => setSalesOptions(data || []));
    }
  }, [open, existing?.id]);

  const onSelectSale = (id: string) => {
    setSaleId(id);
    const s = salesOptions.find(x => x.id === id);
    if (s?.customer_id) setCustomerId(s.customer_id);
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    const uploaded: string[] = [];
    for (const file of Array.from(files)) {
      const path = `${accountId}/${Date.now()}_${file.name.replace(/[^\w.\-]/g, '_')}`;
      const { error } = await supabase.storage.from('customer-returns').upload(path, file, { upsert: false });
      if (error) { toast.error(`Falha ao enviar ${file.name}`); continue; }
      const { data: u } = supabase.storage.from('customer-returns').getPublicUrl(path);
      uploaded.push(u.publicUrl);
    }
    setAttachments([...attachments, ...uploaded]);
    setUploading(false);
  };

  const removeAttachment = (i: number) => setAttachments(attachments.filter((_, idx) => idx !== i));

  const refundStock = async () => {
    if (!saleId || !storeId) { toast.error('Vincule uma venda primeiro'); return; }
    if (stockRefunded) { toast.info('Estoque já foi retornado'); return; }
    if (!confirm('Retornar todos os itens da venda ao estoque desta loja?')) return;
    setRefundingStock(true);
    try {
      const { data: items, error: iErr } = await supabase.from('sale_items').select('product_id, qty').eq('sale_id', saleId);
      if (iErr) throw iErr;
      for (const it of items || []) {
        if (!it.product_id) continue;
        const { data: inv } = await supabase.from('inventory').select('qty_on_hand').eq('store_id', storeId).eq('product_id', it.product_id).maybeSingle();
        if (inv) {
          await supabase.from('inventory').update({ qty_on_hand: Number(inv.qty_on_hand || 0) + Number(it.qty || 0), updated_at: new Date().toISOString() })
            .eq('store_id', storeId).eq('product_id', it.product_id);
        } else {
          await supabase.from('inventory').insert({ store_id: storeId, product_id: it.product_id, qty_on_hand: Number(it.qty || 0) });
        }
      }
      setStockRefunded(true);
      toast.success('Estoque retornado');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao retornar estoque');
    } finally {
      setRefundingStock(false);
    }
  };

  const save = async () => {
    if (!reason.trim()) { toast.error('Informe o motivo'); return; }
    setBusy(true);
    const payload: any = {
      account_id: accountId, store_id: storeId, return_type: type, reason,
      sale_id: saleId || null, customer_id: customerId || null,
      warranty_until: warrantyUntil || null, resolution_notes: resolutionNotes || null,
      status, created_by: userId, attachments, stock_refunded: stockRefunded,
    };
    if (status === 'resolved' || status === 'rejected') payload.resolved_at = new Date().toISOString();
    const { error } = existing
      ? await supabase.from('customer_returns').update(payload).eq('id', existing.id)
      : await supabase.from('customer_returns').insert(payload);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Solicitação salva'); onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? 'Editar' : 'Nova'} solicitação</DialogTitle>
          <DialogDescription>Trocas, garantias, defeitos e reembolsos.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Venda relacionada</Label>
            <Select value={saleId} onValueChange={onSelectSale}>
              <SelectTrigger><SelectValue placeholder="(opcional)" /></SelectTrigger>
              <SelectContent>
                {salesOptions.map(s => <SelectItem key={s.id} value={s.id}>#{s.sequential_number} · {s.customer_name || 'Consumidor'}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Motivo</Label>
            <Textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="Descreva o problema..." />
          </div>
          {type === 'warranty' && (
            <div>
              <Label>Garantia até</Label>
              <Input type="date" value={warrantyUntil} onChange={e => setWarrantyUntil(e.target.value)} />
            </div>
          )}
          <div>
            <Label>Anexos (fotos / documentos)</Label>
            <div className="flex items-center gap-2">
              <Input type="file" multiple accept="image/*,application/pdf" onChange={(e) => uploadFiles(e.target.files)} disabled={uploading} />
              {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
            {attachments.length > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {attachments.map((u, i) => (
                  <div key={i} className="relative group border rounded p-1">
                    {u.match(/\.(png|jpe?g|webp|gif)$/i)
                      ? <img src={u} alt={`Anexo ${i+1}`} className="w-full h-20 object-cover rounded" />
                      : <a href={u} target="_blank" rel="noreferrer" className="text-xs flex items-center justify-center h-20 text-primary hover:underline"><Paperclip className="h-4 w-4 mr-1" />Arquivo</a>}
                    <button type="button" onClick={() => removeAttachment(i)} className="absolute top-0.5 right-0.5 bg-background border rounded-full p-0.5 opacity-0 group-hover:opacity-100">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <Label>Resolução / observações</Label>
            <Textarea rows={2} value={resolutionNotes} onChange={e => setResolutionNotes(e.target.value)} />
          </div>

          {existing && saleId && (type === 'exchange' || type === 'refund' || type === 'defect') && (
            <div className="border rounded p-3 bg-accent/30">
              <p className="text-sm font-semibold flex items-center gap-2"><PackageCheck className="h-4 w-4" /> Estoque</p>
              <p className="text-xs text-muted-foreground mb-2">
                {stockRefunded ? 'Itens já retornados ao estoque desta loja.' : 'Retorne os itens da venda ao estoque desta loja após receber a mercadoria.'}
              </p>
              <Button size="sm" variant={stockRefunded ? 'secondary' : 'default'} disabled={stockRefunded || refundingStock} onClick={refundStock}>
                {refundingStock && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                {stockRefunded ? 'Estoque retornado' : 'Retornar ao estoque'}
              </Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
