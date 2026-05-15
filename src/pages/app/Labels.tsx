import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Search, Printer, Loader2, Tag, Calendar, Package } from 'lucide-react';
import { printLabel } from '@/utils/generateLabel';
import SmartPagination from '@/components/SmartPagination';

interface ProductRow {
  id: string;
  name: string;
  sku: string | null;
  gtin: string | null;
  price_default: number;
  unit: string | null;
  presentations?: { id: string; name: string; gtin: string | null; price: number | null; conversion_factor: number }[];
  inventoryExpDate?: string | null;
}

export default function Labels() {
  const { currentAccount, currentStore } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const pageSize = 30;

  // Selected items for batch print
  const [selected, setSelected] = useState<Map<string, { copies: number; expDate: string; label: string; price: number; gtin: string; unit: string }>>(new Map());

  useEffect(() => {
    if (currentAccount && currentStore) loadProducts();
  }, [currentAccount, currentStore, page, search]);

  const loadProducts = async () => {
    if (!currentAccount || !currentStore) return;
    setLoading(true);
    let query = supabase
      .from('products')
      .select('id, name, sku, gtin, price_default, unit', { count: 'exact' })
      .eq('account_id', currentAccount.id)
      .eq('is_active', true)
      .order('name')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (search.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(`name.ilike.${term},sku.ilike.${term},gtin.ilike.${term}`);
    }

    const { data, count } = await query;
    if (data) {
      // Load presentations and inventory expiration dates
      const ids = data.map(p => p.id);
      const [{ data: pres }, { data: inv }] = await Promise.all([
        supabase.from('product_presentations').select('id, name, gtin, price, conversion_factor, product_id').eq('is_active', true).eq('is_sale', true).in('product_id', ids),
        supabase.from('inventory').select('product_id, expiration_date').eq('store_id', currentStore.id).in('product_id', ids),
      ]);

      const presMap = new Map<string, any[]>();
      (pres || []).forEach(p => {
        if (!presMap.has(p.product_id)) presMap.set(p.product_id, []);
        presMap.get(p.product_id)!.push(p);
      });

      const invMap = new Map<string, string | null>();
      (inv || []).forEach(i => invMap.set(i.product_id, i.expiration_date));

      setProducts(data.map(p => ({
        ...p,
        presentations: presMap.get(p.id) || [],
        inventoryExpDate: invMap.get(p.id) || null,
      })));
    }
    setTotal(count || 0);
    setLoading(false);
  };

  const toggleProduct = (product: ProductRow, presId?: string) => {
    const key = presId || product.id;
    const pres = presId ? product.presentations?.find(p => p.id === presId) : undefined;
    const newSelected = new Map(selected);

    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.set(key, {
        copies: 1,
        expDate: product.inventoryExpDate || '',
        label: pres ? `${product.name} (${pres.name})` : product.name,
        price: pres?.price ?? product.price_default,
        gtin: (pres?.gtin || product.gtin || product.sku || ''),
        unit: product.unit || 'UN',
      });
    }
    setSelected(newSelected);
  };

  const updateSelected = (key: string, field: 'copies' | 'expDate', value: string | number) => {
    const newSelected = new Map(selected);
    const item = newSelected.get(key);
    if (item) {
      newSelected.set(key, { ...item, [field]: value });
      setSelected(newSelected);
    }
  };

  const handlePrint = () => {
    if (selected.size === 0) {
      toast({ variant: 'destructive', title: 'Selecione ao menos um produto' });
      return;
    }

    const items = Array.from(selected.entries()).map(([_, item]) => ({
      productName: item.label,
      sku: item.gtin,
      gtin: item.gtin,
      price: item.price,
      expirationDate: item.expDate || undefined,
      unit: item.unit,
    }));

    const copies = Array.from(selected.values()).map(v => v.copies);

    // Print each item with its copies
    const allItems: { productName: string; sku?: string; gtin?: string; price: number; expirationDate?: string; unit?: string }[] = [];
    items.forEach((item, idx) => {
      for (let i = 0; i < copies[idx]; i++) {
        allItems.push(item);
      }
    });

    printLabel(allItems, 1);
    toast({ title: `Imprimindo ${allItems.length} etiqueta(s)` });
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2"><Tag className="h-5 w-5" /> Etiquetas</h1>
          <p className="text-sm text-muted-foreground">Gere etiquetas com código de barras, preço e validade</p>
        </div>
        <Button onClick={handlePrint} disabled={selected.size === 0}>
          <Printer className="mr-2 h-4 w-4" /> Imprimir {selected.size > 0 ? `(${selected.size})` : ''}
        </Button>
      </div>

      {/* Selected items summary */}
      {selected.size > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Itens Selecionados ({selected.size})</CardTitle>
          </CardHeader>
          <CardContent className="py-0 pb-3">
            <div className="space-y-2 max-h-48 overflow-auto">
              {Array.from(selected.entries()).map(([key, item]) => (
                <div key={key} className="flex items-center gap-3 text-sm border-b pb-2 last:border-0">
                  <span className="flex-1 truncate font-medium">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Cópias:</Label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={item.copies}
                      onChange={e => updateSelected(key, 'copies', Math.max(1, Number(e.target.value)))}
                      className="w-16 h-7 text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Validade:</Label>
                    <Input
                      type="date"
                      value={item.expDate}
                      onChange={e => updateSelected(key, 'expDate', e.target.value)}
                      className="w-36 h-7 text-xs"
                    />
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => {
                    const n = new Map(selected); n.delete(key); setSelected(n);
                  }}>✕</Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar produto por nome, SKU ou código..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : products.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Nenhum produto encontrado</p>
      ) : (
        <>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left py-2 px-3 font-medium w-8"></th>
                  <th className="text-left py-2 px-3 font-medium">Produto</th>
                  <th className="text-left py-2 px-3 font-medium w-28">SKU</th>
                  <th className="text-left py-2 px-3 font-medium w-32">Código</th>
                  <th className="text-right py-2 px-3 font-medium w-24">Preço</th>
                  <th className="text-left py-2 px-3 font-medium w-28">Validade</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <>
                    <tr key={p.id} className={`border-b hover:bg-muted/30 cursor-pointer ${selected.has(p.id) ? 'bg-primary/5' : ''}`}
                      onClick={() => toggleProduct(p)}>
                      <td className="py-2 px-3">
                        <input type="checkbox" checked={selected.has(p.id)} readOnly className="rounded" />
                      </td>
                      <td className="py-2 px-3 font-medium">{p.name}</td>
                      <td className="py-2 px-3 text-muted-foreground text-xs">{p.sku || '—'}</td>
                      <td className="py-2 px-3 text-muted-foreground text-xs font-mono">{p.gtin || '—'}</td>
                      <td className="py-2 px-3 text-right">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.price_default)}</td>
                      <td className="py-2 px-3">
                        {p.inventoryExpDate ? (
                          <Badge variant="outline" className="text-xs"><Calendar className="mr-1 h-3 w-3" />{p.inventoryExpDate}</Badge>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                    </tr>
                    {/* Presentations */}
                    {p.presentations && p.presentations.length > 0 && p.presentations.map(pres => (
                      <tr key={pres.id} className={`border-b hover:bg-muted/30 cursor-pointer bg-muted/10 ${selected.has(pres.id) ? 'bg-primary/5' : ''}`}
                        onClick={() => toggleProduct(p, pres.id)}>
                        <td className="py-1.5 px-3 pl-6">
                          <input type="checkbox" checked={selected.has(pres.id)} readOnly className="rounded" />
                        </td>
                        <td className="py-1.5 px-3 text-xs pl-6">↳ {pres.name} <Badge variant="secondary" className="text-[10px] ml-1">Fração</Badge></td>
                        <td className="py-1.5 px-3 text-xs text-muted-foreground">—</td>
                        <td className="py-1.5 px-3 text-xs text-muted-foreground font-mono">{pres.gtin || '—'}</td>
                        <td className="py-1.5 px-3 text-right text-xs">
                          {pres.price != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pres.price) : '—'}
                        </td>
                        <td className="py-1.5 px-3 text-xs text-muted-foreground">—</td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <SmartPagination currentPage={page + 1} totalPages={totalPages} totalItems={total} pageSize={pageSize} onPageChange={p => setPage(p - 1)} />
          )}
        </>
      )}
    </div>
  );
}
