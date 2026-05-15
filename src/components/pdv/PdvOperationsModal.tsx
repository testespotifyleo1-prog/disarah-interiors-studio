import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/utils/activityLog';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Banknote, Plus, ArrowDownLeft, ArrowUpRight, RotateCcw, Search, X, Check, ShoppingCart } from 'lucide-react';
import PinAuthModal from '@/components/PinAuthModal';

interface PdvOperationsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cashRegisterId: string;
}

type OperationView = 'menu' | 'sangria' | 'reforco' | 'devolucao';

export default function PdvOperationsModal({ open, onOpenChange, cashRegisterId }: PdvOperationsModalProps) {
  const { user, currentAccount, currentStore } = useAuth();
  const { toast } = useToast();

  const [view, setView] = useState<OperationView>('menu');
  const [saving, setSaving] = useState(false);

  // Cash balance
  const [cashBalance, setCashBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  // Sangria / Reforço
  const [movAmount, setMovAmount] = useState('');
  const [movReason, setMovReason] = useState('');

  // PIN
  const [pinOpen, setPinOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<OperationView | null>(null);

  // Devolução
  const [searchOrder, setSearchOrder] = useState('');
  const [searchingSale, setSearchingSale] = useState(false);
  const [foundSale, setFoundSale] = useState<any>(null);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
  const [devReason, setDevReason] = useState('');
  const [manualCustomerName, setManualCustomerName] = useState('');

  const fc = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const resetState = () => {
    setView('menu');
    setMovAmount('');
    setMovReason('');
    setSearchOrder('');
    setFoundSale(null);
    setSaleItems([]);
    setSelectedItems({});
    setDevReason('');
    setManualCustomerName('');
    setPendingAction(null);
  };

  const handleClose = (open: boolean) => {
    if (!open) resetState();
    onOpenChange(open);
  };

  const requestPin = (action: OperationView) => {
    setPendingAction(action);
    setPinOpen(true);
  };

  const handlePinAuthorized = () => {
    if (pendingAction) {
      setView(pendingAction);
      setPendingAction(null);
    }
  };

  // ========== FETCH CASH BALANCE ==========
  const fetchCashBalance = useCallback(async () => {
    if (!cashRegisterId || !currentAccount || !currentStore) return;
    setLoadingBalance(true);
    try {
      // Get opening amount
      const { data: reg } = await supabase
        .from('cash_registers')
        .select('opening_amount')
        .eq('id', cashRegisterId)
        .single();
      const opening = reg?.opening_amount ?? 0;

      // Get cash sales (only cash method payments)
      const { data: salesData } = await (supabase as any)
        .from('sales')
        .select('id')
        .eq('store_id', currentStore.id)
        .eq('account_id', currentAccount.id)
        .eq('cash_register_id', cashRegisterId)
        .eq('status', 'paid');

      let totalCashFromSales = 0;
      if (salesData && salesData.length > 0) {
        const saleIds = salesData.map(s => s.id);
        const { data: payments } = await supabase
          .from('payments')
          .select('paid_value')
          .in('sale_id', saleIds)
          .eq('method', 'cash');
        totalCashFromSales = (payments || []).reduce((s, p) => s + (p.paid_value || 0), 0);
      }

      // Get movements (sangria = out, reforco = in)
      const { data: movements } = await supabase
        .from('cash_movements')
        .select('type, amount')
        .eq('cash_register_id', cashRegisterId);

      let totalReforco = 0;
      let totalSangria = 0;
      (movements || []).forEach((m: any) => {
        if (m.type === 'reforco') totalReforco += m.amount;
        if (m.type === 'sangria') totalSangria += m.amount;
      });

      setCashBalance(opening + totalCashFromSales + totalReforco - totalSangria);
    } catch {
      setCashBalance(null);
    } finally {
      setLoadingBalance(false);
    }
  }, [cashRegisterId, currentAccount, currentStore]);

  useEffect(() => {
    if (open && (view === 'sangria' || view === 'menu')) {
      fetchCashBalance();
    }
  }, [open, view, fetchCashBalance]);

  // ========== SANGRIA / REFORÇO ==========
  const submitMovement = async (type: 'sangria' | 'reforco') => {
    if (!currentAccount || !currentStore || !user) return;
    const amount = Number(movAmount);
    if (!amount || amount <= 0) {
      toast({ variant: 'destructive', title: 'Informe um valor válido' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('cash_movements' as any).insert({
        cash_register_id: cashRegisterId,
        account_id: currentAccount.id,
        store_id: currentStore.id,
        type,
        amount,
        reason: movReason.trim() || null,
        created_by: user.id,
        authorized_by: user.id,
      });
      if (error) throw error;

      await logActivity({
        accountId: currentAccount.id, userId: user.id, userName: user.email,
        action: 'create', entityType: 'cash_movement',
        details: { tipo: type, valor: amount, motivo: movReason.trim() || null },
      });

      toast({ title: type === 'sangria' ? 'Sangria registrada!' : 'Reforço registrado!', description: fc(amount) });
      resetState();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
      setSaving(false);
    }
  };

  // ========== DEVOLUÇÃO ==========
  const searchSale = async () => {
    if (!searchOrder.trim() || !currentAccount || !currentStore) return;
    setSearchingSale(true);
    setFoundSale(null);
    setSaleItems([]);
    setSelectedItems({});
    try {
      // Strip # and whitespace, try to parse as order number
      const cleaned = searchOrder.trim().replace(/^#/, '').trim();
      const orderNum = parseInt(cleaned);

      let data: any = null;

      // 1. Try by sale_number first
      if (!isNaN(orderNum) && orderNum > 0) {
        const { data: byOrder, error } = await supabase
          .from('sales')
          .select('*, customers(*), sale_items(*, products(*))')
          .eq('account_id', currentAccount.id)
          .eq('status', 'paid')
          .eq('sale_number', orderNum)
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        data = byOrder;
      }

      // 2. If not found, try by sale UUID
      if (!data && cleaned.length >= 8) {
        const { data: byId, error } = await supabase
          .from('sales')
          .select('*, customers(*), sale_items(*, products(*))')
          .eq('account_id', currentAccount.id)
          .eq('status', 'paid')
          .eq('id', cleaned)
          .limit(1)
          .maybeSingle();
        if (!error) data = byId;
      }

      if (!data) {
        toast({ variant: 'destructive', title: 'Venda não encontrada', description: 'Verifique o número do pedido. Ex: 123 ou #123' });
        return;
      }
      setFoundSale(data);
      setSaleItems(data.sale_items || []);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
      setSearchingSale(false);
    }
  };

  const toggleItem = (itemId: string, maxQty: number) => {
    setSelectedItems(prev => {
      if (prev[itemId]) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [itemId]: maxQty };
    });
  };

  const updateItemQty = (itemId: string, qty: number, maxQty: number) => {
    if (qty <= 0) {
      const { [itemId]: _, ...rest } = selectedItems;
      setSelectedItems(rest);
      return;
    }
    setSelectedItems(prev => ({ ...prev, [itemId]: Math.min(qty, maxQty) }));
  };

  const creditTotal = saleItems
    .filter(i => selectedItems[i.id])
    .reduce((sum, i) => sum + (i.unit_price * (selectedItems[i.id] || 0)), 0);

  const submitReturn = async () => {
    if (!currentAccount || !currentStore || !user || !foundSale) return;
    if (Object.keys(selectedItems).length === 0) {
      toast({ variant: 'destructive', title: 'Selecione pelo menos um item' });
      return;
    }
    // If no linked customer, require manual name
    if (!foundSale.customer_id && !manualCustomerName.trim()) {
      toast({ variant: 'destructive', title: 'Informe o nome do cliente', description: 'Para rastrear o crédito, informe o nome de quem está devolvendo' });
      return;
    }

    setSaving(true);
    try {
      const customerLabel = foundSale.customers?.name || manualCustomerName.trim() || 'Consumidor';

      // 1. Create store credit
      const { error: creditError } = await supabase.from('store_credits' as any).insert({
        account_id: currentAccount.id,
        store_id: currentStore.id,
        customer_id: foundSale.customer_id || null,
        sale_id: foundSale.id,
        original_amount: Math.round(creditTotal * 100) / 100,
        remaining_amount: Math.round(creditTotal * 100) / 100,
        reason: devReason.trim() || 'devolução',
        notes: `Devolução do pedido #${foundSale.sale_number}` + (!foundSale.customer_id ? ` — Cliente: ${customerLabel}` : ''),
        created_by: user.id,
        customer_name_manual: !foundSale.customer_id ? customerLabel : null,
      });
      if (creditError) throw creditError;

      // 2. Restock items
      for (const item of saleItems.filter(i => selectedItems[i.id])) {
        const qty = selectedItems[item.id];
        // Direct inventory update
        const { data: inv } = await supabase
          .from('inventory')
          .select('id, qty_on_hand')
          .eq('store_id', currentStore.id)
          .eq('product_id', item.product_id)
          .maybeSingle();

        if (inv) {
          await supabase.from('inventory').update({
            qty_on_hand: inv.qty_on_hand + qty,
            updated_at: new Date().toISOString(),
          }).eq('id', inv.id);
        } else {
          await supabase.from('inventory').insert({
            store_id: currentStore.id,
            product_id: item.product_id,
            qty_on_hand: qty,
          });
        }
      }

      // 3. Log activity
      await logActivity({
        accountId: currentAccount.id, userId: user.id, userName: user.email,
        action: 'create', entityType: 'store_credit',
        details: {
          venda: foundSale.sale_number,
          cliente: customerLabel,
          valor_credito: Math.round(creditTotal * 100) / 100,
          itens_devolvidos: Object.keys(selectedItems).length,
          motivo: devReason.trim() || 'devolução',
        },
      });

      toast({
        title: 'Devolução realizada!',
        description: `Crédito de ${fc(creditTotal)} gerado para ${customerLabel}`,
      });
      resetState();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          {view === 'menu' && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg">Operações do PDV</DialogTitle>
                <DialogDescription>Selecione a operação desejada</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3 py-2">
                <button
                  onClick={() => requestPin('sangria')}
                  className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-red-300 bg-red-50 dark:bg-red-950/30 p-5 hover:bg-red-100 dark:hover:bg-red-950/50 transition"
                >
                  <ArrowUpRight className="h-8 w-8 text-red-600" />
                  <span className="font-bold text-red-700 dark:text-red-400 text-sm">SANGRIA</span>
                  <span className="text-[10px] text-red-600/70 dark:text-red-400/70 text-center leading-tight">
                    Retirada de valor do caixa
                  </span>
                </button>
                <button
                  onClick={() => requestPin('reforco')}
                  className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-green-300 bg-green-50 dark:bg-green-950/30 p-5 hover:bg-green-100 dark:hover:bg-green-950/50 transition"
                >
                  <ArrowDownLeft className="h-8 w-8 text-green-600" />
                  <span className="font-bold text-green-700 dark:text-green-400 text-sm">REFORÇO</span>
                  <span className="text-[10px] text-green-600/70 dark:text-green-400/70 text-center leading-tight">
                    Adicionar troco no caixa
                  </span>
                </button>
                <button
                  onClick={() => requestPin('devolucao')}
                  className="col-span-2 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-orange-300 bg-orange-50 dark:bg-orange-950/30 p-5 hover:bg-orange-100 dark:hover:bg-orange-950/50 transition"
                >
                  <RotateCcw className="h-8 w-8 text-orange-600" />
                  <span className="font-bold text-orange-700 dark:text-orange-400 text-sm">TROCA / DEVOLUÇÃO</span>
                  <span className="text-[10px] text-orange-600/70 dark:text-orange-400/70 text-center leading-tight">
                    Devolver itens e gerar crédito para o cliente
                  </span>
                </button>
              </div>
            </>
          )}

          {(view === 'sangria' || view === 'reforco') && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {view === 'sangria' ? <ArrowUpRight className="h-5 w-5 text-red-600" /> : <ArrowDownLeft className="h-5 w-5 text-green-600" />}
                  {view === 'sangria' ? 'Sangria' : 'Reforço de Caixa'}
                </DialogTitle>
                <DialogDescription>
                  {view === 'sangria' ? 'Registrar retirada de dinheiro do caixa' : 'Registrar entrada de dinheiro no caixa'}
                </DialogDescription>
              </DialogHeader>

              {view === 'sangria' && (
                <div className="rounded-lg border-2 border-blue-300 bg-blue-50 dark:bg-blue-950/30 p-3 text-center">
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Dinheiro disponível no caixa</p>
                  {loadingBalance ? (
                    <Loader2 className="h-5 w-5 animate-spin mx-auto my-1 text-blue-600" />
                  ) : (
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {cashBalance !== null ? fc(cashBalance) : '—'}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-1">
                  <Label>Valor (R$)</Label>
                  <Input
                    type="number"
                    value={movAmount}
                    onChange={e => setMovAmount(e.target.value)}
                    placeholder="0,00"
                    className="text-lg"
                    autoFocus
                    min={0.01}
                    step={0.01}
                    max={view === 'sangria' && cashBalance !== null ? cashBalance : undefined}
                  />
                  {view === 'sangria' && cashBalance !== null && Number(movAmount) > cashBalance && (
                    <p className="text-xs text-destructive font-medium mt-1">
                      O valor não pode ser maior que o saldo do caixa ({fc(cashBalance)})
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label>Motivo / Observação</Label>
                  <Textarea
                    value={movReason}
                    onChange={e => setMovReason(e.target.value)}
                    rows={2}
                    placeholder={view === 'sangria' ? 'Ex: Depósito bancário, pagamento fornecedor...' : 'Ex: Troco para o caixa...'}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setView('menu')}>Voltar</Button>
                <Button
                  onClick={() => submitMovement(view)}
                  disabled={saving || !movAmount || Number(movAmount) <= 0 || (view === 'sangria' && cashBalance !== null && Number(movAmount) > cashBalance)}
                  className={view === 'sangria' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
                >
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirmar {view === 'sangria' ? 'Sangria' : 'Reforço'}
                </Button>
              </DialogFooter>
            </>
          )}

          {view === 'devolucao' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <RotateCcw className="h-5 w-5 text-orange-600" /> Troca / Devolução
                </DialogTitle>
                <DialogDescription>
                  Busque a venda pelo número do pedido para gerar crédito
                </DialogDescription>
              </DialogHeader>

              {!foundSale ? (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nº do pedido (ex: 123 ou #123)"
                      value={searchOrder}
                      onChange={e => setSearchOrder(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') searchSale(); }}
                      autoFocus
                    />
                    <Button onClick={searchSale} disabled={searchingSale || !searchOrder.trim()}>
                      {searchingSale ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setView('menu')}>Voltar</Button>
                  </DialogFooter>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Sale info */}
                  <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm">Pedido #{foundSale.sale_number}</span>
                      <Badge variant="secondary" className="text-xs">{fc(foundSale.total)}</Badge>
                    </div>
                    {foundSale.customers && (
                      <p className="text-xs text-muted-foreground">{foundSale.customers.name}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(foundSale.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>

                  {!foundSale.customer_id && (
                    <div className="rounded-lg border-2 border-amber-400/50 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
                      <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">Venda sem cliente cadastrado</p>
                      <p className="text-xs text-muted-foreground">Informe o nome de quem está devolvendo para rastrear o crédito</p>
                      <Input
                        placeholder="Nome do cliente..."
                        value={manualCustomerName}
                        onChange={e => setManualCustomerName(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                  )}

                  {/* Items selection */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold uppercase text-muted-foreground">Selecione os itens para devolver</Label>
                    <div className="max-h-48 overflow-auto space-y-1">
                      {saleItems.map(item => {
                        const isSelected = !!selectedItems[item.id];
                        const selectedQty = selectedItems[item.id] || 0;
                        return (
                          <div
                            key={item.id}
                            className={`rounded-lg border p-2 cursor-pointer transition ${isSelected ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/30' : 'hover:bg-muted/50'}`}
                            onClick={() => toggleItem(item.id, item.qty)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className={`h-4 w-4 rounded border flex items-center justify-center ${isSelected ? 'bg-orange-500 border-orange-500' : 'border-muted-foreground/30'}`}>
                                  {isSelected && <Check className="h-3 w-3 text-white" />}
                                </div>
                                <div>
                                  <p className="text-xs font-medium">{item.products?.name}</p>
                                  <p className="text-[10px] text-muted-foreground">{item.qty}x {fc(item.unit_price)}</p>
                                </div>
                              </div>
                              <span className="text-xs font-medium">{fc(item.total_line)}</span>
                            </div>
                            {isSelected && item.qty > 1 && (
                              <div className="flex items-center gap-2 mt-2 ml-6" onClick={e => e.stopPropagation()}>
                                <Label className="text-[10px]">Qtd devolver:</Label>
                                <Input
                                  type="number"
                                  value={selectedQty}
                                  onChange={e => updateItemQty(item.id, Number(e.target.value), item.qty)}
                                  min={1}
                                  max={item.qty}
                                  className="h-6 w-16 text-xs"
                                />
                                <span className="text-[10px] text-muted-foreground">de {item.qty}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Credit preview */}
                  {creditTotal > 0 && (
                    <div className="rounded-lg border-2 border-orange-400 bg-orange-50 dark:bg-orange-950/30 p-3 text-center">
                      <p className="text-xs text-muted-foreground uppercase font-semibold">Crédito para o cliente</p>
                      <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{fc(creditTotal)}</p>
                      <p className="text-[10px] text-muted-foreground">Vinculado ao pedido #{foundSale.sale_number}</p>
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label className="text-xs">Motivo da devolução</Label>
                    <Textarea
                      value={devReason}
                      onChange={e => setDevReason(e.target.value)}
                      rows={2}
                      placeholder="Ex: Produto com defeito, troca de tamanho..."
                    />
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => { setFoundSale(null); setSaleItems([]); setSelectedItems({}); }}>
                      Voltar
                    </Button>
                    <Button
                      onClick={submitReturn}
                      disabled={saving || creditTotal <= 0 || (!foundSale.customer_id && !manualCustomerName.trim())}
                      className="bg-orange-600 hover:bg-orange-700"
                    >
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Confirmar Devolução
                    </Button>
                  </DialogFooter>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <PinAuthModal
        open={pinOpen}
        onOpenChange={setPinOpen}
        title={
          pendingAction === 'sangria' ? 'Autorizar Sangria' :
          pendingAction === 'reforco' ? 'Autorizar Reforço' :
          pendingAction === 'devolucao' ? 'Autorizar Devolução' : 'Autorização'
        }
        description={
          pendingAction === 'sangria' ? 'Autorize a retirada de dinheiro do caixa.' :
          pendingAction === 'reforco' ? 'Autorize a adição de dinheiro ao caixa.' :
          pendingAction === 'devolucao' ? 'Autorize a devolução e geração de crédito.' : ''
        }
        onAuthorized={handlePinAuthorized}
      />
    </>
  );
}
