import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { isModuleEnabled } from '@/utils/accountModules';
import { useProductSearch } from '@/hooks/useProductSearch';
import { useCustomerSearch } from '@/hooks/useCustomerSearch';
import { logActivity } from '@/utils/activityLog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Minus, Trash2, Search, User, X, CreditCard } from 'lucide-react';
import type { SaleWithDetails, Product, Customer, SaleStatus } from '@/types/database';
import MultiPaymentForm, { type NewPaymentEntry } from './MultiPaymentForm';
import { addMonths, format } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { hasJpOrigin, setJpOrigin, stripJpOrigin } from '@/lib/saleOrigin';

interface EditItem {
  id?: string; // existing sale_item id
  product_id: string;
  product_name: string;
  sku?: string;
  unit?: string;
  qty: number;
  unit_price: number;
  unit_cost: number;
  total_line: number;
  isNew?: boolean;
}

interface SaleEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: SaleWithDetails;
  onSaved: () => void;
}

export default function SaleEditModal({ open, onOpenChange, sale, onSaved }: SaleEditModalProps) {
  const { user, currentAccount } = useAuth();
  const { toast } = useToast();

  const [items, setItems] = useState<EditItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerCreditAuthorized, setCustomerCreditAuthorized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [newPayments, setNewPayments] = useState<NewPaymentEntry[]>([]);
  const [existingPayments, setExistingPayments] = useState<any[]>([]);
  const [markPaidOnSave, setMarkPaidOnSave] = useState(false);
  const [notes, setNotes] = useState('');
  const [keepJpOrigin, setKeepJpOrigin] = useState(false);
  const [saleDate, setSaleDate] = useState(''); // yyyy-MM-dd

  const { query: prodQuery, setQuery: setProdQuery, results: prodResults, searching: prodSearching } = useProductSearch({
    accountId: currentAccount?.id,
  });

  const { query: custQuery, setQuery: setCustQuery, results: custResults, searching: custSearching } = useCustomerSearch({
    accountId: currentAccount?.id,
  });

  useEffect(() => {
    if (open && sale) {
      const mapped: EditItem[] = (sale.sale_items || []).map((si: any) => ({
        id: si.id,
        product_id: si.product_id,
        product_name: si.products?.name || 'Produto',
        sku: si.products?.sku,
        unit: si.products?.unit,
        qty: si.qty,
        unit_price: si.unit_price,
        unit_cost: si.unit_cost,
        total_line: si.total_line,
      }));
      setItems(mapped);
      setDiscount(sale.discount || 0);
      setDeliveryFee((sale as any).delivery_fee || 0);
      setCustomerId((sale as any).customer_id || null);
      setCustomerName(sale.customers?.name || '');
      setCustomerCreditAuthorized(Boolean((sale as any).customers?.credit_authorized));
      setProdQuery('');
      setCustQuery('');
      setShowProductSearch(false);
      setShowCustomerSearch(false);
      setNewPayments([]);
      setExistingPayments((sale.payments || []).map((p: any) => ({ ...p })));
      setMarkPaidOnSave(false);
      const rawNotes = (sale as any).notes || '';
      setKeepJpOrigin(hasJpOrigin(rawNotes));
      setNotes(stripJpOrigin(rawNotes));
      const createdAt = (sale as any).created_at;
      if (createdAt) {
        const d = new Date(createdAt);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        setSaleDate(`${yyyy}-${mm}-${dd}`);
      } else {
        setSaleDate('');
      }
    }
  }, [open, sale]);

  const subtotal = items.reduce((s, i) => s + i.total_line, 0);
  const total = subtotal - discount + deliveryFee;
  const existingPaid = existingPayments.reduce((s: number, p: any) => s + Number(p.paid_value || 0), 0);
  const newPaid = newPayments.reduce((s, p) => s + p.amount, 0);
  const balance = Math.max(0, +(total - existingPaid - newPaid).toFixed(2));

  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const updateItemQty = (idx: number, newQty: number) => {
    if (newQty < 0.01) return;
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, qty: newQty, total_line: +(newQty * item.unit_price).toFixed(2) } : item));
  };

  const updateItemPrice = (idx: number, newPrice: number) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, unit_price: newPrice, total_line: +(item.qty * newPrice).toFixed(2) } : item));
  };

  const removeItem = (idx: number) => {
    if (items.length <= 1) {
      toast({ variant: 'destructive', title: 'A venda precisa ter pelo menos 1 item' });
      return;
    }
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const addProduct = (product: Product) => {
    const existing = items.findIndex(i => i.product_id === product.id);
    if (existing >= 0) {
      updateItemQty(existing, items[existing].qty + 1);
    } else {
      setItems(prev => [...prev, {
        product_id: product.id,
        product_name: product.name,
        sku: product.sku,
        unit: product.unit,
        qty: 1,
        unit_price: product.price_default,
        unit_cost: product.cost_default,
        total_line: product.price_default,
        isNew: true,
      }]);
    }
    setProdQuery('');
    setShowProductSearch(false);
  };

  const selectCustomer = (customer: Customer) => {
    setCustomerId(customer.id);
    setCustomerName(customer.name);
    setCustomerCreditAuthorized(Boolean((customer as any).credit_authorized));
    setCustQuery('');
    setShowCustomerSearch(false);
  };

  const clearCustomer = () => {
    setCustomerId(null);
    setCustomerName('');
    setCustomerCreditAuthorized(false);
  };

  const handleSave = async () => {
    if (!sale || !user) return;
    if (items.length === 0) {
      toast({ variant: 'destructive', title: 'Adicione pelo menos um item' });
      return;
    }
    setSaving(true);
    try {
      const oldItemIds = (sale.sale_items || []).map((si: any) => si.id);
      const keptItemIds = items.filter(i => i.id).map(i => i.id!);
      const removedIds = oldItemIds.filter(id => !keptItemIds.includes(id));
      const newItems = items.filter(i => i.isNew);
      const updatedItems = items.filter(i => i.id && !i.isNew);

      // If sale is paid, we need to handle inventory adjustments
      const isPaid = sale.status === 'paid';

      // 1. Remove deleted items
      if (removedIds.length > 0) {
        if (isPaid) {
          // Restore inventory for removed items
          for (const removedId of removedIds) {
            const removedItem = (sale.sale_items || []).find((si: any) => si.id === removedId);
            if (removedItem) {
              await supabase.rpc('restore_inventory_for_item' as any, {
                _store_id: sale.store_id,
                _product_id: (removedItem as any).product_id,
                _qty: (removedItem as any).qty,
              }).then(() => {});
              // Fallback: direct update if RPC doesn't exist
              await supabase.from('inventory')
                .update({ qty_on_hand: supabase.rpc ? undefined : 0 } as any)
                .eq('store_id', sale.store_id)
                .eq('product_id', (removedItem as any).product_id);
            }
          }
        }
        await supabase.from('sale_items').delete().in('id', removedIds);
      }

      // 2. Update existing items
      for (const item of updatedItems) {
        const oldItem = (sale.sale_items || []).find((si: any) => si.id === item.id);
        const qtyDiff = oldItem ? item.qty - (oldItem as any).qty : 0;

        await supabase.from('sale_items').update({
          qty: item.qty,
          unit_price: item.unit_price,
          total_line: item.total_line,
        }).eq('id', item.id!);

        // Adjust inventory if paid and qty changed
        if (isPaid && qtyDiff !== 0) {
          // Decrease for positive diff, increase for negative
          const { data: inv } = await supabase
            .from('inventory')
            .select('id, qty_on_hand')
            .eq('store_id', sale.store_id)
            .eq('product_id', item.product_id)
            .maybeSingle();
          
          if (inv) {
            await supabase.from('inventory').update({
              qty_on_hand: inv.qty_on_hand - qtyDiff,
              updated_at: new Date().toISOString(),
            }).eq('id', inv.id);
          } else if (qtyDiff > 0) {
            await supabase.from('inventory').insert({
              store_id: sale.store_id,
              product_id: item.product_id,
              qty_on_hand: -qtyDiff,
            });
          }
        }
      }

      // 3. Insert new items
      if (newItems.length > 0) {
        await supabase.from('sale_items').insert(
          newItems.map(item => ({
            sale_id: sale.id,
            product_id: item.product_id,
            qty: item.qty,
            unit_price: item.unit_price,
            unit_cost: item.unit_cost,
            total_line: item.total_line,
          }))
        );

        // Decrease inventory for new items if paid
        if (isPaid) {
          for (const item of newItems) {
            const { data: inv } = await supabase
              .from('inventory')
              .select('id, qty_on_hand')
              .eq('store_id', sale.store_id)
              .eq('product_id', item.product_id)
              .maybeSingle();
            
            if (inv) {
              await supabase.from('inventory').update({
                qty_on_hand: inv.qty_on_hand - item.qty,
                updated_at: new Date().toISOString(),
              }).eq('id', inv.id);
            } else {
              await supabase.from('inventory').insert({
                store_id: sale.store_id,
                product_id: item.product_id,
                qty_on_hand: -item.qty,
              });
            }
          }
        }
      }

      // 4. Update sale header (customer, discount, delivery_fee, totals)
      const newSubtotal = items.reduce((s, i) => s + i.total_line, 0);
      const newTotal = newSubtotal - discount + deliveryFee;
      const totalPaidAfter = existingPaid + newPaid;
      const newBalance = Math.max(0, +(newTotal - totalPaidAfter).toFixed(2));
      const willMarkPaid = markPaidOnSave && newBalance < 0.01 && sale.status !== 'paid';
      const newStatus: SaleStatus = willMarkPaid ? 'paid' : (sale.status as SaleStatus);

      const cleanNotes = (notes || '').trim();
      const finalNotes = keepJpOrigin ? setJpOrigin(cleanNotes, true) : (cleanNotes || null);

      const headerUpdate: any = {
        customer_id: customerId,
        discount,
        delivery_fee: deliveryFee,
        subtotal: newSubtotal,
        total: newTotal,
        notes: finalNotes,
        updated_at: new Date().toISOString(),
      };
      if (saleDate) {
        // Preserva o horário original (apenas troca a data)
        const orig = (sale as any).created_at ? new Date((sale as any).created_at) : new Date();
        const [y, m, d] = saleDate.split('-').map(Number);
        const newCreated = new Date(orig);
        newCreated.setFullYear(y, m - 1, d);
        const minTs = Date.now() - 1000 * 60 * 60 * 24 * 365 * 2;
        // Bloqueia datas futuras ou anos absurdos (anterior a 2 anos atrás).
        if (y >= 2000 && y <= 2100 && newCreated.getTime() <= Date.now() && newCreated.getTime() >= minTs) {
          headerUpdate.created_at = newCreated.toISOString();
        }
      }
      if (willMarkPaid) {
        headerUpdate.status = 'paid';
        // Cleared the partial flag once fully paid
        headerUpdate.remaining_balance = 0;
        headerUpdate.payment_on_delivery = false;
      } else if (newPayments.length > 0 && (sale as any).payment_on_delivery) {
        // Recompute remaining balance for partial sales when new payments come in
        headerUpdate.remaining_balance = newBalance;
      }

      // 4a. Insert new payments + accounts_receivable for crediário
      for (const p of newPayments) {
        const feeValue = p.method === 'card' ? +(p.amount * (p.cardFeePercent || 0) / 100).toFixed(2) : 0;
        await supabase.from('payments').insert({
          sale_id: sale.id,
          method: p.method as any,
          card_type: p.method === 'card' ? (p.cardType || null) : null,
          brand: p.method === 'card' ? (p.cardBrand || null) : null,
          installments: p.installments || 1,
          card_fee_percent: p.method === 'card' ? (p.cardFeePercent || 0) : (p.method === 'financeira' ? (p.financeiraRetention || 0) : 0),
          card_fee_value: feeValue,
          paid_value: p.amount,
        });

        if (p.method === 'crediario' && p.crediarioFirstDate) {
          const installmentsCount = Math.max(1, p.installments || 1);
          const installmentValue = +(p.amount / installmentsCount).toFixed(2);
          const baseDate = new Date(p.crediarioFirstDate);
          for (let i = 0; i < installmentsCount; i++) {
            const due = addMonths(baseDate, i);
            await supabase.from('accounts_receivable').insert({
              account_id: sale.account_id,
              store_id: sale.store_id,
              customer_id: customerId,
              sale_id: sale.id,
              category: 'crediário',
              description: `Crediário venda #${(sale as any).sale_number || sale.id.substring(0, 8)} (${i + 1}/${installmentsCount})`,
              amount: installmentValue,
              due_date: format(due, 'yyyy-MM-dd'),
              installment_number: i + 1,
              total_installments: installmentsCount,
              status: 'open',
            });
          }
        }
      }

      // 4b. Update existing card payments (fee %)
      for (const ep of existingPayments) {
        const original = (sale.payments || []).find((p: any) => p.id === ep.id);
        if (!original) continue;
        const newFee = ep.method === 'card' ? Number(ep.card_fee_percent || 0) : 0;
        const newFeeValue = ep.method === 'card' ? +(Number(ep.paid_value) * newFee / 100).toFixed(2) : 0;
        await supabase.from('payments').update({
          method: ep.method,
          paid_value: Number(ep.paid_value || 0),
          installments: Number(ep.installments || 1),
          card_fee_percent: newFee,
          card_fee_value: newFeeValue,
          card_type: ep.method === 'card' ? (ep.card_type || null) : null,
          brand: ep.method === 'card' ? (ep.brand || null) : null,
        }).eq('id', ep.id);
      }

      const { error: saleError } = await supabase.from('sales').update(headerUpdate).eq('id', sale.id);

      if (saleError) throw saleError;

      // 5. If paid and total changed, update commission
      if (isPaid && newTotal !== sale.total) {
        const { data: existingComm } = await supabase
          .from('commissions')
          .select('id, percent')
          .eq('sale_id', sale.id)
          .eq('status', 'pending')
          .maybeSingle();

        if (existingComm) {
          const newCommValue = +(newTotal * existingComm.percent / 100).toFixed(2);
          await supabase.from('commissions').update({ value: newCommValue }).eq('id', existingComm.id);
        }
      }

      // 6. Log activity
      await logActivity({
        accountId: sale.account_id,
        userId: user.id,
        userName: user.email,
        action: 'update',
        entityType: 'sale',
        entityId: sale.id,
        details: { old_total: sale.total, new_total: newTotal },
      });

      toast({ title: 'Venda atualizada com sucesso!' });
      onOpenChange(false);
      onSaved();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Venda #{(sale as any).sale_number || '—'}</DialogTitle>
          <DialogDescription>Altere itens, quantidades, preços, cliente e valores.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Customer section */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Cliente</Label>
            {customerId ? (
              <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/50">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm flex-1">{customerName}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearCustomer}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Consumidor Final</p>
            )}
            {!showCustomerSearch ? (
              <Button variant="outline" size="sm" onClick={() => setShowCustomerSearch(true)}>
                <Search className="mr-1 h-3 w-3" /> {customerId ? 'Trocar cliente' : 'Vincular cliente'}
              </Button>
            ) : (
              <div className="relative">
                <Input
                  placeholder="Buscar cliente por nome, CPF ou telefone..."
                  value={custQuery}
                  onChange={(e) => setCustQuery(e.target.value)}
                  autoFocus
                />
                {custQuery.trim() && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-40 overflow-y-auto">
                    {custSearching ? (
                      <div className="p-3 text-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-1" /> Buscando...</div>
                    ) : custResults.length === 0 ? (
                      <div className="p-3 text-center text-sm text-muted-foreground">Nenhum cliente encontrado</div>
                    ) : (
                      custResults.map(c => (
                        <button key={c.id} className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center gap-2" onClick={() => selectCustomer(c)}>
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span>{c.name}</span>
                          {c.document && <span className="text-xs text-muted-foreground">{c.document}</span>}
                        </button>
                      ))
                    )}
                  </div>
                )}
                <Button variant="ghost" size="sm" className="mt-1" onClick={() => { setShowCustomerSearch(false); setCustQuery(''); }}>
                  Cancelar
                </Button>
              </div>
            )}
          </div>

          {/* Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Itens</Label>
              <Button variant="outline" size="sm" onClick={() => setShowProductSearch(!showProductSearch)}>
                <Plus className="mr-1 h-3 w-3" /> Adicionar
              </Button>
            </div>

            {showProductSearch && (
              <div className="relative">
                <Input
                  placeholder="Buscar produto por nome, SKU ou código..."
                  value={prodQuery}
                  onChange={(e) => setProdQuery(e.target.value)}
                  autoFocus
                />
                {prodQuery.trim() && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-40 overflow-y-auto">
                    {prodSearching ? (
                      <div className="p-3 text-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-1" /> Buscando...</div>
                    ) : prodResults.length === 0 ? (
                      <div className="p-3 text-center text-sm text-muted-foreground">Nenhum produto encontrado</div>
                    ) : (
                      prodResults.map(p => (
                        <button key={p.id} className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center justify-between" onClick={() => addProduct(p)}>
                          <div>
                            <span className="font-medium">{p.name}</span>
                            {p.sku && <span className="text-xs text-muted-foreground ml-2">{p.sku}</span>}
                          </div>
                          <span className="text-xs font-medium">{formatCurrency(p.price_default)}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {items.map((item, idx) => (
                <div key={item.id || `new-${idx}`} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.product_name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {item.sku && <span>{item.sku}</span>}
                        {item.isNew && <Badge variant="secondary" className="text-[10px] px-1 py-0">Novo</Badge>}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(idx)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Qtd</Label>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateItemQty(idx, item.qty - 1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Input
                          type="number"
                          value={item.qty}
                          onChange={(e) => updateItemQty(idx, Number(e.target.value))}
                          className="h-7 text-center text-sm w-14 px-1"
                          min={0.01}
                          step={1}
                        />
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateItemQty(idx, item.qty + 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Preço Unit.</Label>
                      <Input
                        type="number"
                        value={item.unit_price}
                        onChange={(e) => updateItemPrice(idx, Number(e.target.value))}
                        className="h-7 text-sm"
                        min={0}
                        step={0.01}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Total</Label>
                      <div className="h-7 flex items-center text-sm font-medium">
                        {formatCurrency(item.total_line)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Discount & Delivery Fee */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-sm">Desconto (R$)</Label>
              <Input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
                min={0}
                step={0.01}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Taxa de Entrega (R$)</Label>
              <Input
                type="number"
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(Number(e.target.value))}
                min={0}
                step={0.01}
              />
            </div>
          </div>

          {/* Sale date + Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-sm">Data da venda</Label>
              <Input
                type="date"
                value={saleDate}
                min={(() => { const d = new Date(); d.setFullYear(d.getFullYear()-2); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })()}
                max={(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })()}
                onChange={(e) => setSaleDate(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">Permite registrar a venda em data anterior (não futura).</p>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Observações</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observações do pedido..."
                className="min-h-[60px] resize-none"
              />
            </div>
          </div>

          {/* Totals */}
          <div className="rounded-lg bg-muted p-3 space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            {discount > 0 && <div className="flex justify-between text-destructive"><span>Desconto</span><span>-{formatCurrency(discount)}</span></div>}
            {deliveryFee > 0 && <div className="flex justify-between text-primary"><span>Entrega</span><span>+{formatCurrency(deliveryFee)}</span></div>}
            <div className="flex justify-between font-bold text-base border-t pt-1"><span>Total</span><span>{formatCurrency(total)}</span></div>
            {existingPaid > 0 && (
              <div className="flex justify-between text-success"><span>Já pago</span><span>-{formatCurrency(existingPaid)}</span></div>
            )}
            {newPaid > 0 && (
              <div className="flex justify-between text-success"><span>Novos pagamentos</span><span>-{formatCurrency(newPaid)}</span></div>
            )}
            {(existingPaid + newPaid) > 0 && (
              <div className="flex justify-between font-semibold border-t pt-1">
                <span>Saldo</span>
                <span className={balance < 0.01 ? 'text-success' : 'text-warning'}>{formatCurrency(balance)}</span>
              </div>
            )}
          </div>

          {/* Existing payments — allow editing card fee */}
          {existingPayments.length > 0 && (
            <div className="space-y-2 rounded-lg border p-3">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <CreditCard className="h-4 w-4" /> Pagamentos registrados
              </Label>
              <div className="space-y-2">
                {existingPayments.map((p, idx) => (
                  <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-2 text-sm">
                    <div className="flex-1 min-w-[140px]">
                      <Label className="text-[10px] text-muted-foreground">Forma</Label>
                      <Select value={p.method} onValueChange={(value) => setExistingPayments(prev => prev.map((x, i) => i === idx ? { ...x, method: value } : x))}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pix">Pix</SelectItem>
                          <SelectItem value="cash">Dinheiro</SelectItem>
                          <SelectItem value="card">Cartão</SelectItem>
                          <SelectItem value="crediario">Crediário</SelectItem>
                          <SelectItem value="financeira">Financeira</SelectItem>
                          <SelectItem value="store_credit">Crédito loja</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-28">
                      <Label className="text-[10px] text-muted-foreground">Valor</Label>
                      <Input
                        type="number"
                        value={p.paid_value ?? 0}
                        min={0}
                        step={0.01}
                        className="h-8"
                        onChange={(e) => setExistingPayments(prev => prev.map((x, i) => i === idx ? { ...x, paid_value: Number(e.target.value) } : x))}
                      />
                    </div>
                    {p.method === 'card' && (
                      <div className="flex items-center gap-1">
                        <Label className="text-[10px] text-muted-foreground whitespace-nowrap">Taxa (%)</Label>
                        <Input
                          type="number"
                          value={p.card_fee_percent ?? 0}
                          min={0}
                          max={100}
                          step={0.01}
                          className="h-7 w-20 text-sm"
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setExistingPayments(prev => prev.map((x, i) => i === idx ? { ...x, card_fee_percent: v } : x));
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">Edite a taxa do cartão se foi registrada incorretamente. O valor da taxa será recalculado automaticamente.</p>
            </div>
          )}

          {/* Payments section — for non-canceled sales */}
          {sale.status !== 'cancelled' && (
            <div className="space-y-2 rounded-lg border-2 border-dashed border-primary/30 p-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <CreditCard className="h-4 w-4" /> Registrar pagamentos
                </Label>
                {balance < 0.01 && newPayments.length > 0 && sale.status !== 'paid' && (
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={markPaidOnSave}
                      onChange={e => setMarkPaidOnSave(e.target.checked)}
                      className="h-3.5 w-3.5"
                    />
                    <span className="font-medium">Finalizar venda como paga</span>
                  </label>
                )}
              </div>
              <MultiPaymentForm
                remaining={balance}
                entries={newPayments}
                onAdd={p => setNewPayments(prev => [...prev, p])}
                onRemove={id => setNewPayments(prev => prev.filter(p => p.id !== id))}
                allowCrediario={customerCreditAuthorized && isModuleEnabled(currentAccount, 'crediario')}
                customerSelected={!!customerId}
              />
              {balance < 0.01 && newPayments.length > 0 && sale.status !== 'paid' && !markPaidOnSave && (
                <p className="text-[11px] text-muted-foreground">
                  Marque a opção acima para finalizar a venda automaticamente (gera comissão, baixa de estoque e habilita NF-e).
                </p>
              )}
            </div>
          )}

          {sale.status === 'paid' && (
            <p className="text-xs text-warning bg-warning/10 p-2 rounded-md">
              ⚠️ Esta venda já foi paga. Alterações em itens serão refletidas no estoque e comissões automaticamente.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
