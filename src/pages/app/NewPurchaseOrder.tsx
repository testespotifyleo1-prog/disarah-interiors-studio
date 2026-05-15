import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Loader2, Save, ShoppingCart } from 'lucide-react';
import { logActivity } from '@/utils/activityLog';

interface POItem {
  tempId: string;
  product_id: string;
  product_name: string;
  product_sku?: string;
  qty_ordered: number;
  unit_cost: number;
  total_line: number;
  notes?: string;
}

export default function NewPurchaseOrder() {
  const { user, currentAccount, stores } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [supplierId, setSupplierId] = useState('');
  const [storeId, setStoreId] = useState('');
  const [notes, setNotes] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [items, setItems] = useState<POItem[]>([]);
  const [saving, setSaving] = useState(false);

  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState('');

  useEffect(() => {
    if (currentAccount) {
      loadSuppliers();
      loadProducts();
    }
  }, [currentAccount]);

  const loadSuppliers = async () => {
    const allRows: any[] = [];
    let from = 0; let hasMore = true;
    while (hasMore) {
      const { data } = await supabase.from('suppliers').select('id, name').eq('account_id', currentAccount!.id).range(from, from + 999).order('name');
      if (data && data.length > 0) { allRows.push(...data); from += 1000; hasMore = data.length === 1000; } else hasMore = false;
    }
    setSuppliers(allRows);
  };

  const loadProducts = async () => {
    const allRows: any[] = [];
    let from = 0; let hasMore = true;
    while (hasMore) {
      const { data } = await supabase.from('products').select('id, name, sku, cost_default, unit, supplier_id').eq('account_id', currentAccount!.id).eq('is_active', true).range(from, from + 999).order('name');
      if (data && data.length > 0) { allRows.push(...data); from += 1000; hasMore = data.length === 1000; } else hasMore = false;
    }
    setProducts(allRows);
  };

  const availableProducts = useMemo(() => {
    return products
      .filter(p => {
        if (items.some(it => it.product_id === p.id)) return false;
        if (supplierId && p.supplier_id && p.supplier_id !== supplierId) return false;
        if (productSearch.trim()) {
          const q = productSearch.toLowerCase();
          if (!p.name.toLowerCase().includes(q) && !p.sku?.toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .slice(0, 50);
  }, [products, items, productSearch, supplierId]);

  const addProduct = (p: any) => {
    setItems(prev => [...prev, {
      tempId: crypto.randomUUID(),
      product_id: p.id,
      product_name: p.name,
      product_sku: p.sku,
      qty_ordered: 1,
      unit_cost: p.cost_default || 0,
      total_line: p.cost_default || 0,
    }]);
    setProductSearch('');
  };

  const updateItem = (tempId: string, field: string, value: any) => {
    setItems(prev => prev.map(i => {
      if (i.tempId !== tempId) return i;
      const updated = { ...i, [field]: value };
      if (field === 'qty_ordered' || field === 'unit_cost') {
        updated.total_line = Number(updated.qty_ordered) * Number(updated.unit_cost);
      }
      return updated;
    }));
  };

  const subtotal = items.reduce((s, i) => s + i.total_line, 0);
  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const handleSave = async (asDraft: boolean) => {
    if (items.length === 0) { toast({ variant: 'destructive', title: 'Adicione ao menos um produto' }); return; }

    setSaving(true);
    try {
      const { data: po, error } = await supabase.from('purchase_orders').insert({
        account_id: currentAccount!.id,
        supplier_id: supplierId || null,
        store_id: storeId || null,
        type: 'manual',
        status: asDraft ? 'draft' : 'requested',
        notes: notes || null,
        expected_delivery_date: expectedDate || null,
        created_by: user!.id,
        subtotal,
        total: subtotal,
      }).select().single();
      if (error) throw error;

      const poItems = items.map(i => ({
        purchase_order_id: po.id,
        product_id: i.product_id,
        qty_ordered: i.qty_ordered,
        unit_cost: i.unit_cost,
        total_line: i.total_line,
        notes: i.notes || null,
      }));
      const { error: ie } = await supabase.from('purchase_order_items').insert(poItems);
      if (ie) throw ie;

      await logActivity({ accountId: currentAccount!.id, userId: user!.id, userName: user!.email, action: 'create', entityType: 'purchase_order', entityId: po.id, details: { numero: po.order_number } });
      toast({ title: `Pedido de Compra #${po.order_number} criado!` });
      navigate(`/app/purchase-orders/${po.id}`);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/app/purchase-orders')}><ArrowLeft className="h-5 w-5" /></Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Novo Pedido de Compra</h1>
          <p className="text-sm text-muted-foreground">Solicite produtos aos fornecedores</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Fornecedor</Label>
          <Select value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Loja de Destino</Label>
          <Select value={storeId} onValueChange={setStoreId}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Previsão de Entrega</Label>
          <Input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} />
        </div>
      </div>

      <div>
        <Label>Observações</Label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observações do pedido..." rows={2} />
      </div>

      {/* Products */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Itens do Pedido</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Buscar produto..." value={productSearch} onChange={e => setProductSearch(e.target.value)} />
          {productSearch.trim() && availableProducts.length > 0 && (
            <div className="border rounded-md max-h-40 overflow-auto">
              {availableProducts.map(p => (
                <button key={p.id} onClick={() => addProduct(p)} className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex justify-between">
                  <span>{p.name} {p.sku ? `(${p.sku})` : ''}</span>
                  <span className="text-xs text-muted-foreground">Custo: {formatCurrency(p.cost_default)}</span>
                </button>
              ))}
            </div>
          )}
          {items.length > 0 && (
            <div className="space-y-2 mt-3">
              {items.map(item => (
                <div key={item.tempId} className="flex flex-wrap items-center gap-2 p-2 border rounded-md">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.product_name}</p>
                    {item.product_sku && <p className="text-xs text-muted-foreground">{item.product_sku}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <div>
                      <Label className="text-xs">Qtd</Label>
                      <Input type="number" min={1} value={item.qty_ordered} onChange={e => updateItem(item.tempId, 'qty_ordered', Number(e.target.value))} className="w-20 h-8" />
                    </div>
                    <div>
                      <Label className="text-xs">Custo Unit.</Label>
                      <Input type="number" min={0} step={0.01} value={item.unit_cost} onChange={e => updateItem(item.tempId, 'unit_cost', Number(e.target.value))} className="w-24 h-8" />
                    </div>
                    <div className="text-right min-w-[80px]">
                      <Label className="text-xs">Total</Label>
                      <p className="text-sm font-medium">{formatCurrency(item.total_line)}</p>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => setItems(prev => prev.filter(i => i.tempId !== item.tempId))} className="mt-4">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
              <div className="text-right pt-2 border-t">
                <p className="text-sm">Subtotal: <span className="font-bold">{formatCurrency(subtotal)}</span></p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => handleSave(true)} disabled={saving}>
          {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />} Salvar Rascunho
        </Button>
        <Button onClick={() => handleSave(false)} disabled={saving}>
          {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <ShoppingCart className="mr-1 h-4 w-4" />} Solicitar Compra
        </Button>
      </div>
    </div>
  );
}
