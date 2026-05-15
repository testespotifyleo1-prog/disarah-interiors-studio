import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, ShoppingCart, Search, AlertTriangle, Package, Filter } from 'lucide-react';
import SmartPagination from '@/components/SmartPagination';

interface ReplenishmentItem {
  product_id: string;
  product_name: string;
  product_sku?: string;
  category?: string;
  supplier_id?: string;
  supplier_name?: string;
  store_id: string;
  store_name: string;
  qty_on_hand: number;
  min_qty: number;
  deficit: number;
  priority: 'critical' | 'low' | 'restock';
}

export default function ReplenishmentSuggestions() {
  const { currentAccount, stores } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [allItems, setAllItems] = useState<ReplenishmentItem[]>([]);
  const [search, setSearch] = useState('');
  const [filterStore, setFilterStore] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterSupplier, setFilterSupplier] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const [suppliers, setSuppliers] = useState<any[]>([]);

  useEffect(() => { if (currentAccount && stores.length > 0) loadData(); }, [currentAccount, stores]);

  const loadData = async () => {
    setLoading(true);
    const storeIds = stores.map(s => s.id);

    // Load inventory with min_qty > 0
    const allInv: any[] = [];
    let from = 0; let hasMore = true;
    while (hasMore) {
      const { data } = await supabase.from('inventory')
        .select('product_id, store_id, qty_on_hand, min_qty')
        .in('store_id', storeIds)
        .gt('min_qty', 0)
        .range(from, from + 999);
      if (data && data.length > 0) { allInv.push(...data); from += 1000; hasMore = data.length === 1000; } else hasMore = false;
    }

    // Load products
    const allProds: any[] = [];
    from = 0; hasMore = true;
    while (hasMore) {
      const { data } = await supabase.from('products')
        .select('id, name, sku, category, supplier_id')
        .eq('account_id', currentAccount!.id)
        .eq('is_active', true)
        .range(from, from + 999);
      if (data && data.length > 0) { allProds.push(...data); from += 1000; hasMore = data.length === 1000; } else hasMore = false;
    }

    // Load suppliers
    const { data: supData } = await supabase.from('suppliers').select('id, name').eq('account_id', currentAccount!.id);
    setSuppliers(supData || []);

    const prodMap = new Map(allProds.map(p => [p.id, p]));
    const supMap = new Map((supData || []).map((s: any) => [s.id, s.name]));
    const storeMap = new Map(stores.map(s => [s.id, s.name]));

    const repItems: ReplenishmentItem[] = allInv
      .filter(inv => inv.qty_on_hand <= inv.min_qty)
      .map(inv => {
        const prod = prodMap.get(inv.product_id);
        if (!prod) return null;
        const deficit = inv.min_qty - inv.qty_on_hand;
        let priority: 'critical' | 'low' | 'restock' = 'restock';
        if (inv.qty_on_hand <= 0) priority = 'critical';
        else if (inv.qty_on_hand <= inv.min_qty * 0.3) priority = 'low';

        return {
          product_id: inv.product_id,
          product_name: prod.name,
          product_sku: prod.sku,
          category: prod.category,
          supplier_id: prod.supplier_id,
          supplier_name: prod.supplier_id ? supMap.get(prod.supplier_id) : undefined,
          store_id: inv.store_id,
          store_name: storeMap.get(inv.store_id) || 'Loja',
          qty_on_hand: inv.qty_on_hand,
          min_qty: inv.min_qty,
          deficit,
          priority,
        };
      })
      .filter(Boolean) as ReplenishmentItem[];

    repItems.sort((a, b) => {
      const p = { critical: 0, low: 1, restock: 2 };
      return (p[a.priority] - p[b.priority]) || (b.deficit - a.deficit);
    });

    setAllItems(repItems);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    return allItems.filter(item => {
      if (filterStore !== 'all' && item.store_id !== filterStore) return false;
      if (filterPriority !== 'all' && item.priority !== filterPriority) return false;
      if (filterSupplier !== 'all' && item.supplier_id !== filterSupplier) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!item.product_name.toLowerCase().includes(q) && !item.product_sku?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [allItems, filterStore, filterPriority, filterSupplier, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [search, filterStore, filterPriority, filterSupplier]);

  const toggleSelect = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const createPurchaseOrder = () => {
    const selectedItems = allItems.filter(i => selected.has(`${i.product_id}:${i.store_id}`));
    if (selectedItems.length === 0) { toast({ variant: 'destructive', title: 'Selecione itens' }); return; }
    // Navigate to new PO with pre-selected items (via state)
    navigate('/app/purchase-orders/new', { state: { replenishmentItems: selectedItems } });
  };

  const priorityBadge = (p: string) => {
    if (p === 'critical') return <Badge variant="destructive">Zerado</Badge>;
    if (p === 'low') return <Badge variant="destructive" className="bg-orange-500">Crítico</Badge>;
    return <Badge variant="outline">Repor</Badge>;
  };

  const criticalCount = allItems.filter(i => i.priority === 'critical').length;
  const lowCount = allItems.filter(i => i.priority === 'low').length;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/app/purchase-orders')}><ArrowLeft className="h-5 w-5" /></Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Sugestão de Reposição</h1>
          <p className="text-sm text-muted-foreground">Produtos que precisam de reposição</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2 p-3"><CardTitle className="text-xs font-medium">Total Itens</CardTitle></CardHeader>
          <CardContent className="p-3 pt-0"><p className="text-xl font-bold">{allItems.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 p-3"><CardTitle className="text-xs font-medium text-destructive">Zerados</CardTitle></CardHeader>
          <CardContent className="p-3 pt-0"><p className="text-xl font-bold text-destructive">{criticalCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 p-3"><CardTitle className="text-xs font-medium text-orange-500">Críticos</CardTitle></CardHeader>
          <CardContent className="p-3 pt-0"><p className="text-xl font-bold text-orange-500">{lowCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 p-3"><CardTitle className="text-xs font-medium">Selecionados</CardTitle></CardHeader>
          <CardContent className="p-3 pt-0"><p className="text-xl font-bold">{selected.size}</p></CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar produto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={filterStore} onValueChange={setFilterStore}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Loja" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todas</SelectItem>{stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Prioridade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="critical">Zerado</SelectItem>
            <SelectItem value="low">Crítico</SelectItem>
            <SelectItem value="restock">Repor</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterSupplier} onValueChange={setFilterSupplier}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Fornecedor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={createPurchaseOrder}>
            <ShoppingCart className="mr-1 h-4 w-4" /> Criar Pedido de Compra ({selected.size} itens)
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Limpar seleção</Button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
          Nenhum produto necessita reposição.
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Loja</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="text-right">Atual</TableHead>
                  <TableHead className="text-right">Mínimo</TableHead>
                  <TableHead className="text-right">Sugestão</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map(item => {
                  const key = `${item.product_id}:${item.store_id}`;
                  return (
                    <TableRow key={key} className={item.priority === 'critical' ? 'bg-destructive/5' : ''}>
                      <TableCell><Checkbox checked={selected.has(key)} onCheckedChange={() => toggleSelect(key)} /></TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">{item.product_name}</p>
                        {item.product_sku && <p className="text-xs text-muted-foreground">{item.product_sku}</p>}
                      </TableCell>
                      <TableCell className="text-sm">{item.store_name}</TableCell>
                      <TableCell className="text-sm">{item.supplier_name || '-'}</TableCell>
                      <TableCell className="text-right font-medium">{item.qty_on_hand}</TableCell>
                      <TableCell className="text-right">{item.min_qty}</TableCell>
                      <TableCell className="text-right font-bold text-primary">{item.deficit}</TableCell>
                      <TableCell>{priorityBadge(item.priority)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {totalPages > 1 && <SmartPagination currentPage={page} totalPages={totalPages} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />}
    </div>
  );
}
