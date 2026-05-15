import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Search, Plus, Loader2, Eye, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SmartPagination from '@/components/SmartPagination';
import { format } from 'date-fns';

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Rascunho', variant: 'secondary' },
  sent: { label: 'Enviado', variant: 'outline' },
  approved: { label: 'Aprovado', variant: 'default' },
  rejected: { label: 'Recusado', variant: 'destructive' },
  expired: { label: 'Vencido', variant: 'destructive' },
  converted: { label: 'Convertido', variant: 'default' },
};

export default function Quotes() {
  const { currentAccount, stores } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [quotes, setQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  useEffect(() => { if (currentAccount) loadQuotes(); }, [currentAccount]);

  const loadQuotes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('quotes')
      .select('*, customers(name), stores(name)')
      .eq('account_id', currentAccount!.id)
      .order('created_at', { ascending: false });
    if (error) toast({ variant: 'destructive', title: 'Erro', description: error.message });
    else setQuotes(data || []);
    setLoading(false);
  };

  const filtered = quotes.filter(q => {
    if (filterStatus !== 'all' && q.status !== filterStatus) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      const num = String(q.quote_number);
      const cust = q.customers?.name?.toLowerCase() || '';
      if (!num.includes(s) && !cust.includes(s)) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [search, filterStatus]);

  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Orçamentos</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} orçamento(s)</p>
        </div>
        <Button size="sm" onClick={() => navigate('/app/quotes/new')}>
          <Plus className="mr-1 h-4 w-4" /> Novo Orçamento
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por número ou cliente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : paginated.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum orçamento encontrado.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {paginated.map(q => (
            <Card key={q.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/app/quotes/${q.id}`)}>
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">ORC #{q.quote_number}</span>
                    <Badge variant={STATUS_MAP[q.status]?.variant || 'secondary'}>{STATUS_MAP[q.status]?.label || q.status}</Badge>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {q.customers?.name || 'Consumidor Final'}
                    {q.stores?.name && <span> • {q.stores.name}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm">{formatCurrency(q.total)}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(q.created_at), 'dd/MM/yyyy')}</p>
                  {q.valid_until && <p className="text-xs text-muted-foreground">Válido até {format(new Date(q.valid_until + 'T12:00:00'), 'dd/MM/yyyy')}</p>}
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
