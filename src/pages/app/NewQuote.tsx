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
import { ArrowLeft, Trash2, Loader2, Save, FileText } from 'lucide-react';
import { logActivity } from '@/utils/activityLog';
import { isModuleEnabled } from '@/utils/accountModules';

interface QuoteItem {
  tempId: string;
  product_id: string;
  product_name: string;
  product_sku?: string;
  qty: number;
  unit_price: number;
  discount: number;
  total_line: number;
}

export default function NewQuote() {
  const { user, currentAccount, stores } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [storeId, setStoreId] = useState(stores.length === 1 ? stores[0].id : '');
  const [customerId, setCustomerId] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [discount, setDiscount] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [assemblyFee, setAssemblyFee] = useState(0);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [saving, setSaving] = useState(false);

  const [products, setProducts] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);

  useEffect(() => { if (currentAccount) { loadProducts(); } }, [currentAccount]);

  useEffect(() => {
    if (!currentAccount || !customerSearch.trim()) { setCustomers([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase.from('customers').select('id, name, phone').eq('account_id', currentAccount.id).ilike('name', `%${customerSearch}%`).limit(20);
      setCustomers(data || []);
    }, 200);
    return () => clearTimeout(timer);
  }, [customerSearch, currentAccount]);

  const loadProducts = async () => {
    const allRows: any[] = [];
    let from = 0; let hasMore = true;
    while (hasMore) {
      const { data } = await supabase.from('products').select('id, name, sku, price_default, unit').eq('account_id', currentAccount!.id).eq('is_active', true).range(from, from + 999).order('name');
      if (data && data.length > 0) { allRows.push(...data); from += 1000; hasMore = data.length === 1000; } else hasMore = false;
    }
    setProducts(allRows);
  };

  const availableProducts = useMemo(() => {
    return products.filter(p => {
      if (items.some(it => it.product_id === p.id)) return false;
      if (productSearch.trim()) {
        const q = productSearch.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !p.sku?.toLowerCase().includes(q)) return false;
      }
      return true;
    }).slice(0, 50);
  }, [products, items, productSearch]);

  const addProduct = (p: any) => {
    setItems(prev => [...prev, {
      tempId: crypto.randomUUID(), product_id: p.id, product_name: p.name, product_sku: p.sku,
      qty: 1, unit_price: p.price_default || 0, discount: 0, total_line: p.price_default || 0,
    }]);
    setProductSearch('');
  };

  const updateItem = (tempId: string, field: string, value: any) => {
    setItems(prev => prev.map(i => {
      if (i.tempId !== tempId) return i;
      const u = { ...i, [field]: value };
      if (['qty', 'unit_price', 'discount'].includes(field)) {
        u.total_line = u.qty * u.unit_price - u.discount;
      }
      return u;
    }));
  };

  const subtotal = items.reduce((s, i) => s + i.total_line, 0);
  const total = subtotal - discount + deliveryFee + assemblyFee;
  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const handleSave = async (asDraft: boolean) => {
    if (!storeId) { toast({ variant: 'destructive', title: 'Selecione a loja' }); return; }
    if (items.length === 0) { toast({ variant: 'destructive', title: 'Adicione ao menos um produto' }); return; }

    setSaving(true);
    try {
      const { data: quote, error } = await supabase.from('quotes').insert({
        account_id: currentAccount!.id, store_id: storeId, customer_id: customerId || null,
        seller_id: user!.id, status: asDraft ? 'draft' : 'sent',
        valid_until: validUntil || null, subtotal, discount, delivery_fee: deliveryFee, assembly_fee: assemblyFee, total,
        notes: notes || null,
      }).select().single();
      if (error) throw error;

      const qItems = items.map(i => ({
        quote_id: quote.id, product_id: i.product_id, qty: i.qty,
        unit_price: i.unit_price, discount: i.discount, total_line: i.total_line,
      }));
      const { error: ie } = await supabase.from('quote_items').insert(qItems);
      if (ie) throw ie;

      await logActivity({ accountId: currentAccount!.id, userId: user!.id, userName: user!.email, action: 'create', entityType: 'quote', entityId: quote.id, details: { numero: quote.quote_number } });
      toast({ title: `Orçamento #${quote.quote_number} criado!` });
      navigate(`/app/quotes/${quote.id}`);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/app/quotes')}><ArrowLeft className="h-5 w-5" /></Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Novo Orçamento</h1>
          <p className="text-sm text-muted-foreground">Crie um orçamento para enviar ao cliente</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Loja *</Label>
          <Select value={storeId} onValueChange={setStoreId}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>{stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Cliente</Label>
          <Input placeholder="Buscar cliente..." value={customerSearch} onChange={e => { setCustomerSearch(e.target.value); setCustomerId(''); }} />
          {customers.length > 0 && customerSearch.trim() && !customerId && (
            <div className="border rounded-md max-h-32 overflow-auto mt-1">
              {customers.map((c: any) => (
                <button key={c.id} onClick={() => { setCustomerId(c.id); setCustomerSearch(c.name); }} className="w-full text-left px-3 py-2 text-sm hover:bg-muted">
                  {c.name} {c.phone ? `(${c.phone})` : ''}
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <Label>Validade do Orçamento</Label>
          <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
        </div>
      </div>

      <div><Label>Observações</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observações..." rows={2} /></div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Itens do Orçamento</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Buscar produto..." value={productSearch} onChange={e => setProductSearch(e.target.value)} />
          {productSearch.trim() && availableProducts.length > 0 && (
            <div className="border rounded-md max-h-40 overflow-auto">
              {availableProducts.map(p => (
                <button key={p.id} onClick={() => addProduct(p)} className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex justify-between">
                  <span>{p.name} {p.sku ? `(${p.sku})` : ''}</span>
                  <span className="text-xs text-muted-foreground">{formatCurrency(p.price_default)}</span>
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
                  </div>
                  <Input type="number" min={1} value={item.qty} onChange={e => updateItem(item.tempId, 'qty', Number(e.target.value))} className="w-16 h-8" placeholder="Qtd" />
                  <Input type="number" min={0} step={0.01} value={item.unit_price} onChange={e => updateItem(item.tempId, 'unit_price', Number(e.target.value))} className="w-24 h-8" placeholder="Preço" />
                  <span className="text-sm font-medium min-w-[80px] text-right">{formatCurrency(item.total_line)}</span>
                  <Button size="icon" variant="ghost" onClick={() => setItems(prev => prev.filter(i => i.tempId !== item.tempId))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-4">
        <div><Label>Desconto (R$)</Label><Input type="number" min={0} step={0.01} value={discount} onChange={e => setDiscount(Number(e.target.value))} /></div>
        <div><Label>Taxa de Entrega (R$)</Label><Input type="number" min={0} step={0.01} value={deliveryFee} onChange={e => setDeliveryFee(Number(e.target.value))} /></div>
        {isModuleEnabled(currentAccount, 'assemblies') && (
          <div><Label>Taxa de Montagem (R$)</Label><Input type="number" min={0} step={0.01} value={assemblyFee} onChange={e => setAssemblyFee(Number(e.target.value))} /></div>
        )}
        <div className="flex items-end"><p className="text-lg font-bold">Total: {formatCurrency(total)}</p></div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => handleSave(true)} disabled={saving}>
          <Save className="mr-1 h-4 w-4" /> Salvar Rascunho
        </Button>
        <Button onClick={() => handleSave(false)} disabled={saving}>
          <FileText className="mr-1 h-4 w-4" /> Enviar Orçamento
        </Button>
      </div>
    </div>
  );
}
