import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Search, Loader2, Banknote, Gift, RefreshCw } from 'lucide-react';
import PinAuthModal from '@/components/PinAuthModal';
import { logActivity } from '@/utils/activityLog';

interface StoreCredit {
  id: string;
  account_id: string;
  store_id: string;
  customer_id: string | null;
  sale_id: string | null;
  original_amount: number;
  remaining_amount: number;
  reason: string;
  notes: string | null;
  status: string;
  created_by: string;
  created_at: string;
  used_at: string | null;
  used_in_sale_id: string | null;
  customer_name_manual: string | null;
  customers?: { name: string } | null;
  sales?: { order_number: number } | null;
}

export default function StoreCredits() {
  const { user, currentAccount, currentStore } = useAuth();
  const { toast } = useToast();

  const [credits, setCredits] = useState<StoreCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'used' | 'refunded'>('active');

  // Refund dialog
  const [refundCredit, setRefundCredit] = useState<StoreCredit | null>(null);
  const [refundNotes, setRefundNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // PIN
  const [pinOpen, setPinOpen] = useState(false);
  const [pendingRefund, setPendingRefund] = useState<StoreCredit | null>(null);

  const fc = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const fetchCredits = async () => {
    if (!currentAccount || !currentStore) return;
    setLoading(true);
    try {
      let query = (supabase as any)
        .from('store_credits')
        .select('*, customers(name), sales!store_credits_sale_id_fkey(order_number)')
        .eq('account_id', currentAccount.id)
        .eq('store_id', currentStore.id)
        .order('created_at', { ascending: false });

      if (filter === 'active') query = query.eq('status', 'active');
      else if (filter === 'used') query = query.eq('status', 'used');
      else if (filter === 'refunded') query = query.eq('status', 'refunded');

      const { data, error } = await query;
      if (error) throw error;
      setCredits(data || []);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCredits();
  }, [currentAccount?.id, currentStore?.id, filter]);

  const filteredCredits = credits.filter(c => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    const customerName = c.customers?.name || c.customer_name_manual || '';
    const orderNum = c.sales?.order_number ? `#${c.sales.order_number}` : '';
    return customerName.toLowerCase().includes(s)
      || orderNum.includes(s)
      || c.reason.toLowerCase().includes(s)
      || c.id.toLowerCase().includes(s);
  });

  const requestRefund = (credit: StoreCredit) => {
    setPendingRefund(credit);
    setPinOpen(true);
  };

  const handlePinAuthorized = () => {
    if (pendingRefund) {
      setRefundCredit(pendingRefund);
      setPendingRefund(null);
    }
  };

  const submitRefund = async () => {
    if (!refundCredit || !currentAccount || !user) return;
    setSaving(true);
    try {
      await (supabase as any)
        .from('store_credits')
        .update({
          status: 'refunded',
          remaining_amount: 0,
          used_at: new Date().toISOString(),
          notes: (refundCredit.notes || '') + `\nDevolvido em dinheiro: ${refundNotes.trim() || 'Sem observação'}`,
        })
        .eq('id', refundCredit.id);

      await logActivity({
        accountId: currentAccount.id, userId: user.id, userName: user.email,
        action: 'refund', entityType: 'store_credit', entityId: refundCredit.id,
        details: {
          valor: refundCredit.remaining_amount,
          cliente: refundCredit.customers?.name || refundCredit.customer_name_manual || 'Sem nome',
          motivo: refundNotes.trim() || 'Sem observação',
        },
      });

      toast({ title: 'Crédito devolvido em dinheiro!', description: fc(refundCredit.remaining_amount) });
      setRefundCredit(null);
      setRefundNotes('');
      fetchCredits();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'active') return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-300">Ativo</Badge>;
    if (status === 'used') return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-300">Usado</Badge>;
    if (status === 'refunded') return <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-300">Devolvido</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
  };

  const totalActive = credits.filter(c => c.status === 'active').reduce((s, c) => s + c.remaining_amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Créditos de Loja</h1>
          <p className="text-sm text-muted-foreground">Gerencie créditos de devoluções e trocas</p>
        </div>
        {totalActive > 0 && (
          <div className="rounded-lg border-2 border-green-400 bg-green-50 dark:bg-green-950/30 px-4 py-2 text-center">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Total ativo</p>
            <p className="text-lg font-bold text-green-600 dark:text-green-400">{fc(totalActive)}</p>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por cliente, pedido, motivo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          {(['active', 'all', 'used', 'refunded'] as const).map(f => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {f === 'active' ? 'Ativos' : f === 'all' ? 'Todos' : f === 'used' ? 'Usados' : 'Devolvidos'}
            </Button>
          ))}
          <Button variant="ghost" size="icon" onClick={fetchCredits} className="h-9 w-9">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filteredCredits.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Gift className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhum crédito encontrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredCredits.map(credit => {
            const customerName = credit.customers?.name || credit.customer_name_manual || 'Sem nome';
            return (
              <Card key={credit.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm">{customerName}</span>
                        {getStatusBadge(credit.status)}
                      </div>
                      {credit.sales?.order_number && (
                        <p className="text-xs text-muted-foreground">Pedido #{credit.sales.order_number}</p>
                      )}
                      <p className="text-xs text-muted-foreground">{credit.reason}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(credit.created_at).toLocaleDateString('pt-BR')} às {new Date(credit.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {credit.notes && <p className="text-[10px] text-muted-foreground italic">{credit.notes}</p>}
                    </div>
                    <div className="text-right shrink-0 space-y-2">
                      <div>
                        {credit.status === 'active' && credit.remaining_amount < credit.original_amount && (
                          <p className="text-[10px] text-muted-foreground line-through">{fc(credit.original_amount)}</p>
                        )}
                        <p className={`text-lg font-bold ${credit.status === 'active' ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                          {fc(credit.status === 'active' ? credit.remaining_amount : credit.original_amount)}
                        </p>
                      </div>
                      {credit.status === 'active' && credit.remaining_amount > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => requestRefund(credit)}
                        >
                          <Banknote className="mr-1 h-3 w-3" /> Devolver $
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Refund dialog */}
      <Dialog open={!!refundCredit} onOpenChange={o => { if (!o) setRefundCredit(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-orange-600" /> Devolver em Dinheiro
            </DialogTitle>
            <DialogDescription>
              Devolver o crédito restante em dinheiro para o cliente
            </DialogDescription>
          </DialogHeader>
          {refundCredit && (
            <div className="space-y-3">
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                <p className="font-bold text-sm">{refundCredit.customers?.name || refundCredit.customer_name_manual || 'Sem nome'}</p>
                <p className="text-xs text-muted-foreground">Crédito restante: <span className="font-bold text-green-600">{fc(refundCredit.remaining_amount)}</span></p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Observação</Label>
                <Textarea
                  value={refundNotes}
                  onChange={e => setRefundNotes(e.target.value)}
                  rows={2}
                  placeholder="Ex: Devolvido a pedido do cliente..."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundCredit(null)}>Cancelar</Button>
            <Button onClick={submitRefund} disabled={saving} className="bg-orange-600 hover:bg-orange-700">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Devolução
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PinAuthModal
        open={pinOpen}
        onOpenChange={setPinOpen}
        title="Autorizar Devolução em Dinheiro"
        description="PIN do dono necessário para devolver crédito em dinheiro."
        onAuthorized={handlePinAuthorized}
      />
    </div>
  );
}
