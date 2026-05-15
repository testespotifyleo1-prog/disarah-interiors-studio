import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/utils/activityLog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, FileInput, Eye, XCircle, RefreshCw, Inbox, ArrowRight } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

export default function FiscalEntries() {
  const { currentAccount, isOwnerOrAdmin, stores } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStoreId, setFilterStoreId] = useState<string>('all');
  const [canceling, setCanceling] = useState<string | null>(null);
  const [destinedPending, setDestinedPending] = useState(0);

  useEffect(() => {
    if (currentAccount) { loadEntries(); loadDestinedPending(); }
  }, [currentAccount, filterStoreId]);

  const loadDestinedPending = async () => {
    if (!currentAccount) return;
    const { data: storesData } = await supabase.from('stores').select('id').eq('account_id', currentAccount.id);
    const ids = (storesData || []).map(s => s.id);
    if (ids.length === 0) return;
    const { count } = await supabase
      .from('nfe_destination_manifest')
      .select('id', { count: 'exact', head: true })
      .in('store_id', ids)
      .neq('status', 'manifested');
    setDestinedPending(count || 0);
  };

  const loadEntries = async () => {
    if (!currentAccount) return;
    setLoading(true);

    const { data: accountStores } = await supabase
      .from('stores').select('id').eq('account_id', currentAccount.id);

    if (!accountStores?.length) { setEntries([]); setLoading(false); return; }

    const storeIds = filterStoreId !== 'all' ? [filterStoreId] : accountStores.map(s => s.id);

    const { data } = await supabase
      .from('fiscal_entries')
      .select('*, suppliers(name, cnpj), stores(name)')
      .in('store_id', storeIds)
      .order('created_at', { ascending: false });

    setEntries(data || []);
    setLoading(false);
  };

  const handleCancel = async (entryId: string) => {
    if (!confirm('Tem certeza que deseja cancelar/estornar esta entrada? O estoque será revertido.')) return;
    setCanceling(entryId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sessão expirada');

      // Get entry items to reverse stock
      const { data: items } = await supabase
        .from('fiscal_entry_items')
        .select('product_id, quantity')
        .eq('fiscal_entry_id', entryId)
        .not('product_id', 'is', null);

      const { data: entry } = await supabase
        .from('fiscal_entries')
        .select('store_id, status')
        .eq('id', entryId)
        .single();

      if (!entry || entry.status === 'cancelled') throw new Error('Entrada já cancelada ou não encontrada');

      // Reverse stock if was confirmed
      if (entry.status === 'confirmed' && items) {
        for (const item of items) {
          if (item.product_id) {
            await supabase.rpc('is_account_member', { _user_id: user.id, _account_id: currentAccount!.id }); // just a check
            const { data: inv } = await supabase
              .from('inventory')
              .select('id, qty_on_hand')
              .eq('store_id', entry.store_id)
              .eq('product_id', item.product_id)
              .single();

            if (inv) {
              await supabase.from('inventory').update({
                qty_on_hand: inv.qty_on_hand - item.quantity,
                updated_at: new Date().toISOString(),
              }).eq('id', inv.id);
            }
          }
        }
      }

      // Cancel accounts payable linked
      const { error: apError } = await supabase
        .from('accounts_payable')
        .update({ status: 'cancelled' })
        .eq('account_id', currentAccount!.id)
        .like('notes', `fiscal_entry:${entryId}%`);
      
      if (apError) console.error('Erro ao cancelar contas a pagar:', apError);

      // Mark entry as canceled
      await supabase
        .from('fiscal_entries')
        .update({ status: 'cancelled', canceled_at: new Date().toISOString(), canceled_by: user.id })
        .eq('id', entryId);

      await logActivity({
        accountId: currentAccount!.id,
        userId: user.id,
        userName: user.email,
        action: 'reverse',
        entityType: 'fiscal_entry',
        entityId: entryId,
        details: { action: 'Estorno de entrada fiscal' },
      });
      toast({ title: 'Entrada cancelada e estoque estornado.' });
      loadEntries();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao cancelar', description: e.message });
    } finally {
      setCanceling(null);
    }
  };

  const fc = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  const formatDate = (d: string) => new Date(d).toLocaleString('pt-BR');

  const statusLabels: Record<string, string> = {
    draft: 'Rascunho', confirmed: 'Confirmada', canceled: 'Cancelada',
  };
  const statusColors: Record<string, string> = {
    draft: 'bg-yellow-500', confirmed: 'bg-green-600', canceled: 'bg-muted',
  };

  if (!isOwnerOrAdmin) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">Acesso restrito a administradores</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Entrada Fiscal</h1>
          <p className="text-sm text-muted-foreground">Importe XML de NF-e de fornecedores para dar entrada no estoque</p>
        </div>
        <Button onClick={() => navigate('/app/fiscal-entries/new')}>
          <Plus className="mr-2 h-4 w-4" /> Nova Entrada
        </Button>
      </div>

      {/* Manifestação do Destinatário (MD-e) banner */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <Inbox className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm flex items-center gap-2">
                NF-es Destinadas (Manifestação SEFAZ)
                {destinedPending > 0 && (
                  <Badge variant="destructive" className="text-[10px]">{destinedPending} pendente{destinedPending > 1 ? 's' : ''}</Badge>
                )}
              </p>
              <p className="text-xs text-muted-foreground">Confirme ou recuse NF-es que fornecedores emitiram contra seu CNPJ.</p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/app/fiscal-extras">Abrir <ArrowRight className="ml-1 h-3 w-3" /></Link>
          </Button>
        </CardContent>
      </Card>

      {stores.length > 1 && (
        <div className="flex gap-3">
          <Select value={filterStoreId} onValueChange={setFilterStoreId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtrar por loja" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as lojas</SelectItem>
              {stores.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {entries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileInput className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Nenhuma entrada fiscal registrada.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map(entry => (
            <Card key={entry.id}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <FileInput className="h-4 w-4 text-primary" />
                      <span className="font-medium truncate">
                        {entry.suppliers?.name || 'Fornecedor desconhecido'}
                      </span>
                      <Badge className={`${statusColors[entry.status] || 'bg-muted'} text-white text-xs`}>
                        {statusLabels[entry.status] || entry.status}
                      </Badge>
                    </div>
                    {entry.access_key && (
                      <p className="text-xs text-muted-foreground font-mono break-all truncate">
                        Chave: {entry.access_key}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{entry.stores?.name}</span>
                      <span>•</span>
                      <span>{fc(entry.total_nfe)}</span>
                      <span>•</span>
                      <span>{formatDate(entry.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => navigate(`/app/fiscal-entries/${entry.id}`)}>
                      <Eye className="h-3 w-3 mr-1" /> Ver
                    </Button>
                    {entry.status === 'confirmed' && (
                      <Button
                        variant="destructive" size="sm"
                        onClick={() => handleCancel(entry.id)}
                        disabled={canceling === entry.id}
                      >
                        {canceling === entry.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3 mr-1" />}
                        Estornar
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
