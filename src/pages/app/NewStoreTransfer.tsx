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
import { ArrowLeft, Plus, Trash2, Loader2, Save, ArrowRightLeft } from 'lucide-react';
import { logActivity } from '@/utils/activityLog';

interface TransferItem {
  tempId: string;
  product_id: string;
  product_name: string;
  product_sku?: string;
  qty_requested: number;
  available_qty: number;
}

export default function NewStoreTransfer() {
  const { user, currentAccount, stores, canEdit } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [fromStoreId, setFromStoreId] = useState('');
  const [toStoreId, setToStoreId] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<TransferItem[]>([]);
  const [saving, setSaving] = useState(false);

  const [products, setProducts] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState('');

  useEffect(() => {
    if (currentAccount) loadProducts();
  }, [currentAccount]);

  useEffect(() => {
    if (fromStoreId) loadInventory(fromStoreId);
  }, [fromStoreId]);

  const loadProducts = async () => {
    const allRows: any[] = [];
    let from = 0;
    let hasMore = true;
    while (hasMore) {
      const { data } = await supabase
        .from('products')
        .select('id, name, sku, unit')
        .eq('account_id', currentAccount!.id)
        .eq('is_active', true)
        .range(from, from + 999)
        .order('name');
      if (data && data.length > 0) { allRows.push(...data); from += 1000; hasMore = data.length === 1000; }
      else hasMore = false;
    }
    setProducts(allRows);
  };

  const loadInventory = async (storeId: string) => {
    const allRows: any[] = [];
    let from = 0;
    let hasMore = true;
    while (hasMore) {
      const { data } = await supabase
        .from('inventory')
        .select('product_id, qty_on_hand')
        .eq('store_id', storeId)
        .range(from, from + 999);
      if (data && data.length > 0) { allRows.push(...data); from += 1000; hasMore = data.length === 1000; }
      else hasMore = false;
    }
    setInventory(allRows);
  };

  const availableProducts = useMemo(() => {
    if (!fromStoreId) return [];
    const invMap = new Map(inventory.map(i => [i.product_id, i.qty_on_hand]));
    return products
      .filter(p => {
        if (items.some(it => it.product_id === p.id)) return false;
        if (productSearch.trim()) {
          const q = productSearch.toLowerCase();
          if (!p.name.toLowerCase().includes(q) && !p.sku?.toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .map(p => ({ ...p, available: invMap.get(p.id) || 0 }))
      .slice(0, 50);
  }, [products, inventory, fromStoreId, items, productSearch]);

  const addProduct = (p: any) => {
    setItems(prev => [...prev, {
      tempId: crypto.randomUUID(),
      product_id: p.id,
      product_name: p.name,
      product_sku: p.sku,
      qty_requested: 1,
      available_qty: p.available,
    }]);
    setProductSearch('');
  };

  const updateItem = (tempId: string, field: string, value: any) => {
    setItems(prev => prev.map(i => i.tempId === tempId ? { ...i, [field]: value } : i));
  };

  const removeItem = (tempId: string) => {
    setItems(prev => prev.filter(i => i.tempId !== tempId));
  };

  const handleSave = async (asDraft: boolean) => {
    if (!fromStoreId || !toStoreId) {
      toast({ variant: 'destructive', title: 'Selecione loja de origem e destino' });
      return;
    }
    if (fromStoreId === toStoreId) {
      toast({ variant: 'destructive', title: 'Origem e destino devem ser diferentes' });
      return;
    }
    if (items.length === 0) {
      toast({ variant: 'destructive', title: 'Adicione ao menos um produto' });
      return;
    }
    for (const item of items) {
      if (item.qty_requested <= 0) {
        toast({ variant: 'destructive', title: `Quantidade inválida para ${item.product_name}` });
        return;
      }
      if (item.qty_requested > item.available_qty) {
        toast({ variant: 'destructive', title: `Estoque insuficiente para ${item.product_name} (disponível: ${item.available_qty})` });
        return;
      }
    }

    setSaving(true);
    try {
      const { data: transfer, error } = await supabase.from('store_transfers').insert({
        account_id: currentAccount!.id,
        from_store_id: fromStoreId,
        to_store_id: toStoreId,
        status: asDraft ? 'draft' : 'requested',
        notes: notes || null,
        created_by: user!.id,
      }).select().single();

      if (error) throw error;

      const itemsToInsert = items.map(i => ({
        transfer_id: transfer.id,
        product_id: i.product_id,
        qty_requested: i.qty_requested,
      }));

      const { error: itemsError } = await supabase.from('store_transfer_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      await logActivity({
        accountId: currentAccount!.id, userId: user!.id, userName: user!.email,
        action: 'create', entityType: 'store_transfer',
        entityId: transfer.id,
        details: { numero: transfer.transfer_number, status: transfer.status },
      });

      toast({ title: `Transferência #${transfer.transfer_number} criada!` });
      navigate(`/app/transfers/${transfer.id}`);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/app/transfers')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Nova Transferência</h1>
          <p className="text-sm text-muted-foreground">Transferência de produtos entre lojas</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Loja de Origem *</Label>
          <Select value={fromStoreId} onValueChange={setFromStoreId}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Loja de Destino *</Label>
          <Select value={toStoreId} onValueChange={setToStoreId}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {stores.filter(s => s.id !== fromStoreId).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Observações</Label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observações sobre a transferência..." rows={2} />
      </div>

      {/* Add Products */}
      {fromStoreId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Produtos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Buscar produto para adicionar..."
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
            />
            {productSearch.trim() && availableProducts.length > 0 && (
              <div className="border rounded-md max-h-40 overflow-auto">
                {availableProducts.map(p => (
                  <button
                    key={p.id}
                    onClick={() => addProduct(p)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex justify-between items-center"
                  >
                    <span>{p.name} {p.sku ? `(${p.sku})` : ''}</span>
                    <span className="text-xs text-muted-foreground">Disp: {p.available}</span>
                  </button>
                ))}
              </div>
            )}

            {items.length > 0 && (
              <div className="space-y-2 mt-3">
                {items.map(item => (
                  <div key={item.tempId} className="flex items-center gap-2 p-2 border rounded-md">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.product_name}</p>
                      <p className="text-xs text-muted-foreground">Disponível: {item.available_qty}</p>
                    </div>
                    <Input
                      type="number"
                      min={1}
                      max={item.available_qty}
                      value={item.qty_requested}
                      onChange={e => updateItem(item.tempId, 'qty_requested', Number(e.target.value))}
                      className="w-20"
                    />
                    <Button size="icon" variant="ghost" onClick={() => removeItem(item.tempId)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => handleSave(true)} disabled={saving}>
          {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
          Salvar Rascunho
        </Button>
        <Button onClick={() => handleSave(false)} disabled={saving}>
          {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <ArrowRightLeft className="mr-1 h-4 w-4" />}
          Solicitar Transferência
        </Button>
      </div>
    </div>
  );
}
