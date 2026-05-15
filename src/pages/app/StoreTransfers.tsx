import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Search, Plus, ArrowRightLeft, Loader2, Eye } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import SmartPagination from '@/components/SmartPagination';
import { format } from 'date-fns';

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Rascunho', variant: 'secondary' },
  requested: { label: 'Solicitada', variant: 'outline' },
  separated: { label: 'Separada', variant: 'default' },
  shipped: { label: 'Enviada', variant: 'default' },
  received: { label: 'Recebida', variant: 'default' },
  canceled: { label: 'Cancelada', variant: 'destructive' },
};

export default function StoreTransfers() {
  const { currentAccount, stores, canEdit } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterStore, setFilterStore] = useState('all');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  useEffect(() => {
    if (currentAccount) loadTransfers();
  }, [currentAccount]);

  const loadTransfers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('store_transfers')
      .select('*, from_store:stores!store_transfers_from_store_id_fkey(name), to_store:stores!store_transfers_to_store_id_fkey(name)')
      .eq('account_id', currentAccount!.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast({ variant: 'destructive', title: 'Erro ao carregar transferências', description: error.message });
    } else {
      setTransfers(data || []);
    }
    setLoading(false);
  };

  const filtered = transfers.filter(t => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (filterStore !== 'all' && t.from_store_id !== filterStore && t.to_store_id !== filterStore) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const num = String(t.transfer_number);
      const from = t.from_store?.name?.toLowerCase() || '';
      const to = t.to_store?.name?.toLowerCase() || '';
      if (!num.includes(q) && !from.includes(q) && !to.includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, filterStatus, filterStore]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Transferências entre Lojas</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} transferência(s)</p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => navigate('/app/transfers/new')}>
            <Plus className="mr-1 h-4 w-4" /> Nova Transferência
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por número ou loja..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStore} onValueChange={setFilterStore}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Loja" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as lojas</SelectItem>
            {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : paginated.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma transferência encontrada.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {paginated.map(t => (
            <Card key={t.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/app/transfers/${t.id}`)}>
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">#{t.transfer_number}</span>
                    <Badge variant={STATUS_MAP[t.status]?.variant || 'secondary'}>{STATUS_MAP[t.status]?.label || t.status}</Badge>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                    <span>{t.from_store?.name || 'Origem'}</span>
                    <ArrowRightLeft className="h-3 w-3" />
                    <span>{t.to_store?.name || 'Destino'}</span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">{format(new Date(t.created_at), 'dd/MM/yyyy HH:mm')}</div>
                <Button size="sm" variant="ghost"><Eye className="h-4 w-4" /></Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 && <SmartPagination currentPage={page} totalPages={totalPages} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />}
    </div>
  );
}
