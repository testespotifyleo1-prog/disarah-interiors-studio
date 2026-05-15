import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Search, Plus, Loader2, Eye, ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SmartPagination from '@/components/SmartPagination';
import { format } from 'date-fns';

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Rascunho', variant: 'secondary' },
  requested: { label: 'Solicitado', variant: 'outline' },
  approved: { label: 'Aprovado', variant: 'default' },
  ordered: { label: 'Pedido ao Fornecedor', variant: 'default' },
  partial_received: { label: 'Recebido Parcial', variant: 'outline' },
  received: { label: 'Recebido', variant: 'default' },
  canceled: { label: 'Cancelado', variant: 'destructive' },
};

export default function PurchaseOrders() {
  const { currentAccount, stores, canEdit } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterStore, setFilterStore] = useState('all');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  useEffect(() => { if (currentAccount) loadOrders(); }, [currentAccount]);

  const loadOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('*, suppliers(name), stores(name)')
      .eq('account_id', currentAccount!.id)
      .order('created_at', { ascending: false });
    if (error) toast({ variant: 'destructive', title: 'Erro', description: error.message });
    else setOrders(data || []);
    setLoading(false);
  };

  const filtered = orders.filter(o => {
    if (filterStatus !== 'all' && o.status !== filterStatus) return false;
    if (filterStore !== 'all' && o.store_id !== filterStore) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const num = String(o.order_number);
      const sup = o.suppliers?.name?.toLowerCase() || '';
      if (!num.includes(q) && !sup.includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [search, filterStatus, filterStore]);

  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Pedidos de Compra</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} pedido(s)</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => navigate('/app/purchase-orders/new')}>
              <Plus className="mr-1 h-4 w-4" /> Novo Pedido
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate('/app/replenishment')}>
              <ShoppingCart className="mr-1 h-4 w-4" /> Sugestão de Reposição
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por número ou fornecedor..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
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
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum pedido de compra encontrado.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {paginated.map(o => (
            <Card key={o.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/app/purchase-orders/${o.id}`)}>
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">PC #{o.order_number}</span>
                    <Badge variant={STATUS_MAP[o.status]?.variant || 'secondary'}>{STATUS_MAP[o.status]?.label || o.status}</Badge>
                    {o.type === 'replenishment' && <Badge variant="outline" className="text-xs">Reposição</Badge>}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                    {o.suppliers?.name && <span>Forn: {o.suppliers.name}</span>}
                    {o.stores?.name && <span>• {o.stores.name}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm">{formatCurrency(o.total)}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(o.created_at), 'dd/MM/yyyy')}</p>
                </div>
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
