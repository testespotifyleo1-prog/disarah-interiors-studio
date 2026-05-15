import { useState, useEffect, useRef } from 'react';
import { useProductSearch } from '@/hooks/useProductSearch';
import { useCustomerSearch } from '@/hooks/useCustomerSearch';
import { useAuth } from '@/contexts/AuthContext';
import { useOfflinePDV } from '@/hooks/useOfflinePDV';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/utils/activityLog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Search, Plus, Minus, Trash2, ShoppingCart, Save, CreditCard,
  Banknote, Smartphone, Loader2, FileText, Copy, Check, BookOpen, ShieldAlert, KeyRound, X, User, Building2, History, WifiOff,
} from 'lucide-react';
import type { Product, Customer, Sale, PaymentMethod, CardType } from '@/types/database';
import { usePriceTiers } from '@/hooks/usePriceTiers';
import { addMonths, format } from 'date-fns';
import { generatePixPayload, getPixQrCodeUrl } from '@/utils/pixUtils';
import OfflineIndicator from '@/components/pdv/OfflineIndicator';
import { ContingencyBadge } from '@/components/pdv/ContingencyBadge';
import { MercadoPagoPixDialog } from '@/components/payment/MercadoPagoPixDialog';
import { MercadoPagoPointDialog } from '@/components/payment/MercadoPagoPointDialog';
import { Switch } from '@/components/ui/switch';
import { isMirandaEFarias, hasJpOrigin, setJpOrigin, stripJpOrigin } from '@/lib/saleOrigin';
import { isMirandaGroupStore } from '@/utils/mirandaBranding';
import { isModuleEnabled, isModuleDisabled, MODULE_BLOCKED_MESSAGE } from '@/utils/accountModules';
import { useFiscalBlock } from '@/hooks/useFiscalBlock';

interface CartItem {
  product: Product;
  qty: number;
  unit_price: number;
}

interface PaymentEntry {
  id: string;
  method: PaymentMethod;
  amount: number;
  cardType?: CardType;
  cardBrand?: string;
  installments: number;
  cardFeePercent: number;
  // financeira
  financeiraRetention?: number;
  financeiraInstallments?: number;
  // crediario
  crediarioFirstDate?: string;
}

const cardBrands = [
  'Visa', 'MasterCard', 'Elo', 'Hipercard', 'American Express',
  'Diners', 'Discover', 'Aura', 'JCB', 'UnionPay', 'Maestro',
];

export default function PDV() {
  const { user, currentAccount, currentStore, canEdit, userRole } = useAuth();
  const { isOnline, createOfflineSale } = useOfflinePDV({
    accountId: currentAccount?.id,
    storeId: currentStore?.id,
    userId: user?.id,
    userEmail: user?.email || undefined,
  });
  const { toast } = useToast();

  const { query: searchQuery, setQuery: setSearchQuery, results: filteredProducts, searching: searchingProducts } = useProductSearch({
    accountId: currentAccount?.id,
    activeOnly: true,
    limit: 20,
    debounceMs: 250,
  });

  const {
    query: customerQuery, setQuery: setCustomerQuery,
    results: filteredCustomers, searching: searchingCustomers,
    allCustomers: customers, refresh: refreshCustomers,
  } = useCustomerSearch({ accountId: currentAccount?.id });

  const [cart, setCart] = useState<CartItem[]>([]);
  const { blockEnabled: fiscalBlockEnabled, validateCart: validateFiscalCart } = useFiscalBlock(currentStore?.id);
  const cartProductIds = cart.map(i => i.product.id);
  const { getTierPrice } = usePriceTiers(cartProductIds);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const customerSearchRef = useRef<HTMLInputElement>(null);
  const [discount, setDiscount] = useState(0);
  const [couponCode, setCouponCode] = useState('');
  const [couponApplied, setCouponApplied] = useState<{ code: string; discount: number; description?: string | null } | null>(null);
  const [couponValidating, setCouponValidating] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [assemblyFee, setAssemblyFee] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Multi-payment state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentEntries, setPaymentEntries] = useState<PaymentEntry[]>([]);
  // Partial payment ("Sinal + Saldo na Entrega")
  const [partialMode, setPartialMode] = useState(false);
  // Current payment being added
  const [curMethod, setCurMethod] = useState<PaymentMethod>('cash');
  const [curAmount, setCurAmount] = useState(0);
  const [curCardType, setCurCardType] = useState<CardType>('debit');
  const [curCardBrand, setCurCardBrand] = useState('');
  const [curInstallments, setCurInstallments] = useState(1);
  const [curCardFeePercent, setCurCardFeePercent] = useState(0);
  const [curFinanceiraRetention, setCurFinanceiraRetention] = useState(0);
  const [curFinanceiraInstallments, setCurFinanceiraInstallments] = useState(1);
  const [curCrediarioInstallments, setCurCrediarioInstallments] = useState(1);
  const [curCrediarioFirstDate, setCurCrediarioFirstDate] = useState('');

  // Crediário state
  const [customerUsedCredit, setCustomerUsedCredit] = useState(0);

  // Credit override
  const [overrideRequestId, setOverrideRequestId] = useState<string | null>(null);
  const [overrideApproved, setOverrideApproved] = useState(false);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [ownerPin, setOwnerPin] = useState('');
  const [pinValidating, setPinValidating] = useState(false);

  // PIX copy
  const [pixCopied, setPixCopied] = useState(false);

  // Draft sales
  const [draftSales, setDraftSales] = useState<Sale[]>([]);
  const [showDrafts, setShowDrafts] = useState(false);
  const [currentSaleId, setCurrentSaleId] = useState<string | null>(null);

  // Order confirmation
  const [showOrderConfirmation, setShowOrderConfirmation] = useState(false);

  // Mercado Pago auto-cobrança
  const [mpConn, setMpConn] = useState<{ status?: string; enabled_methods?: string[]; point_device_id?: string | null } | null>(null);
  const [mpDialog, setMpDialog] = useState<null | { kind: 'pix' | 'point_credit' | 'point_debit'; saleId: string; amount: number }>(null);
  const [mpCharging, setMpCharging] = useState(false);

  // Customer history
  const [showCustomerHistory, setShowCustomerHistory] = useState(false);
  const [customerSales, setCustomerSales] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [saleNotes, setSaleNotes] = useState('');
  const [isJpOrigin, setIsJpOrigin] = useState(false);
  const [saleDate, setSaleDate] = useState(''); // yyyy-MM-dd opcional
  const showJpToggle = isMirandaEFarias(currentStore?.name);
  // Helper: junta a tag JP (se aplicável) com as observações do usuário
  const buildNotesForSave = () => {
    const clean = saleNotes.trim();
    if (showJpToggle && isJpOrigin) return setJpOrigin(clean, true);
    return clean || null;
  };
  // YYYY-MM-DD de hoje (data local) — usado como `max` do input para evitar datas futuras.
  const todayLocalISO = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  // Data mínima permitida: 2 anos atrás. Evita digitação acidental de anos errados (ex: 1979).
  const minLocalISO = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 2);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  // Retorna ISO com horário do meio-dia local quando uma data customizada é informada (evita timezone shifts)
  const buildCreatedAt = (): string | undefined => {
    if (!saleDate) return undefined;
    const [y, m, d] = saleDate.split('-').map(Number);
    if (!y || !m || !d) return undefined;
    // Bloqueia anos absurdos (ex: 1979 digitado por engano)
    if (y < 2000 || y > 2100) return undefined;
    const now = new Date();
    const dt = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds());
    // Bloqueia datas futuras ou anteriores a 2 anos: usa o horário do servidor (undefined).
    if (dt.getTime() > now.getTime()) return undefined;
    const minTs = now.getTime() - 1000 * 60 * 60 * 24 * 365 * 2;
    if (dt.getTime() < minTs) return undefined;
    return dt.toISOString();
  };

  // Close customer search on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (customerSearchRef.current && !customerSearchRef.current.closest('.relative')?.contains(e.target as Node)) {
        setShowCustomerSearch(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const [mobileView, setMobileView] = useState<'products' | 'cart'>('products');

  useEffect(() => {
    if (currentAccount && currentStore) {
      loadDraftSales();
      setLoading(false);
    }
  }, [currentAccount, currentStore]);

  // Carrega conexão Mercado Pago da loja
  useEffect(() => {
    if (!currentStore?.id) { setMpConn(null); return; }
    (async () => {
      const { data } = await (supabase as any)
        .from('mp_connections')
        .select('status, enabled_methods, point_device_id')
        .eq('store_id', currentStore.id)
        .maybeSingle();
      setMpConn(data || null);
    })();
  }, [currentStore?.id]);

  // Load customer's used credit whenever customer changes
  useEffect(() => {
    if (selectedCustomer && currentAccount) {
      loadCustomerUsedCredit(selectedCustomer);
    } else {
      setCustomerUsedCredit(0);
    }
    setOverrideRequestId(null);
    setOverrideApproved(false);
  }, [selectedCustomer]);

  const loadCustomerUsedCredit = async (customerId: string) => {
    if (!currentAccount) return;
    const { data, error } = await supabase.rpc('get_customer_used_credit' as any, {
      _customer_id: customerId,
      _account_id: currentAccount.id,
    });
    setCustomerUsedCredit(error ? 0 : Number(data || 0));
  };

  const loadDraftSales = async () => {
    if (!currentStore || !user) return;
    const { data } = await supabase.from('sales').select('*').eq('store_id', currentStore.id).eq('seller_user_id', user.id).eq('status', 'draft').order('updated_at', { ascending: false });
    if (data) setDraftSales(data);
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) {
        const newQty = existing.qty + 1;
        const tier = getTierPrice(product.id, newQty);
        return prev.map(i => i.product.id === product.id ? { ...i, qty: newQty, unit_price: tier ? tier.price : product.price_default } : i);
      }
      return [...prev, { product, qty: 1, unit_price: product.price_default }];
    });
    setSearchQuery('');
  };

  const updateQty = (productId: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.product.id !== productId) return i;
      const newQty = Math.max(0, i.qty + delta);
      if (newQty === 0) return { ...i, qty: 0 };
      const tier = getTierPrice(productId, newQty);
      return { ...i, qty: newQty, unit_price: tier ? tier.price : i.product.price_default };
    }).filter(i => i.qty > 0));
  };

  // Lojas Miranda (Miranda e Farias, JP Móveis, Miranda e Miranda):
  // vendedores podem alterar o preço diretamente no PDV (sem precisar ser admin/manager).
  const sellerCanEditPriceHere = isMirandaGroupStore(currentStore?.name);
  const canEditPriceInline = canEdit || sellerCanEditPriceHere;

  const updatePrice = (productId: string, price: number) => {
    if (!canEditPriceInline) return;
    setCart(prev => prev.map(i => i.product.id === productId ? { ...i, unit_price: price } : i));
  };

  const removeFromCart = (productId: string) => setCart(prev => prev.filter(i => i.product.id !== productId));

  const subtotal = cart.reduce((sum, item) => sum + item.qty * item.unit_price, 0);
  const total = subtotal - discount + deliveryFee + assemblyFee;
  const totalPaid = paymentEntries.reduce((s, e) => s + e.amount, 0);
  const remaining = Math.max(0, total - totalPaid);

  const fc = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const selectedCustomerObj = customers.find(c => c.id === selectedCustomer);
  const pixKey = currentStore?.pix_key;

  // Crediário validation
  const canUseCrediario = selectedCustomerObj?.credit_authorized === true;
  const creditLimit = selectedCustomerObj?.credit_limit || 0;
  const creditAvailable = creditLimit - customerUsedCredit;

  const copyPixKey = async () => {
    if (!pixKey) return;
    const pixPayload = generatePixPayload({
      pixKey,
      merchantName: currentStore?.name || 'Loja',
      amount: curAmount > 0 ? curAmount : remaining > 0 ? remaining : undefined,
    });
    await navigator.clipboard.writeText(pixPayload);
    setPixCopied(true);
    setTimeout(() => setPixCopied(false), 2000);
  };

  // Load customer history
  const loadCustomerHistory = async () => {
    if (!selectedCustomer || !currentAccount) return;
    setLoadingHistory(true);
    const { data } = await supabase
      .from('sales')
      .select('*, stores(name), payments(method, paid_value, installments, card_type)')
      .eq('account_id', currentAccount.id)
      .eq('customer_id', selectedCustomer)
      .order('created_at', { ascending: false })
      .limit(50);
    setCustomerSales(data || []);
    setLoadingHistory(false);
    setShowCustomerHistory(true);
  };

  const saveDraft = async () => {
    if (cart.length === 0) { toast({ variant: 'destructive', title: 'Carrinho vazio' }); return; }
    if (!currentAccount || !currentStore || !user) return;
    setSaving(true);
    try {
      let saleId = currentSaleId;
      const customCreated = buildCreatedAt();
      if (saleId) {
        const upd: any = { customer_id: selectedCustomer || null, discount, delivery_fee: deliveryFee, assembly_fee: assemblyFee, subtotal, total, notes: buildNotesForSave(), updated_at: new Date().toISOString() };
        if (customCreated) upd.created_at = customCreated;
        await supabase.from('sales').update(upd).eq('id', saleId);
        await supabase.from('sale_items').delete().eq('sale_id', saleId);
      } else {
        const insertObj: any = {
          account_id: currentAccount.id, store_id: currentStore.id, seller_user_id: user.id,
          customer_id: selectedCustomer || null, status: 'draft', discount, delivery_fee: deliveryFee, assembly_fee: assemblyFee, subtotal, total, notes: buildNotesForSave(),
        };
        if (customCreated) insertObj.created_at = customCreated;
        const { data: sale, error } = await supabase.from('sales').insert(insertObj).select().single();
        if (error) throw error;
        saleId = sale.id; setCurrentSaleId(saleId);
      }
      const items = cart.map(item => ({
        sale_id: saleId!, product_id: item.product.id, qty: item.qty,
        unit_price: item.unit_price, unit_cost: item.product.cost_default, total_line: item.qty * item.unit_price,
      }));
      await supabase.from('sale_items').insert(items);
      toast({ title: 'Rascunho salvo!' }); loadDraftSales();
    } catch (e: any) { toast({ variant: 'destructive', title: 'Erro', description: e.message }); }
    finally { setSaving(false); }
  };

  const loadDraft = async (sale: Sale) => {
    setSaving(true);
    try {
      const { data: items } = await supabase.from('sale_items').select('*, products(*)').eq('sale_id', sale.id);
      if (items) setCart(items.map((i: any) => ({ product: i.products, qty: i.qty, unit_price: i.unit_price })));
      setSelectedCustomer(sale.customer_id || null);
      setDiscount(sale.discount);
      setDeliveryFee(sale.delivery_fee || 0);
      setAssemblyFee((sale as any).assembly_fee || 0);
      const rawNotes = (sale as any).notes || '';
      setIsJpOrigin(hasJpOrigin(rawNotes));
      setSaleNotes(stripJpOrigin(rawNotes));
      if ((sale as any).created_at) {
        const d = new Date((sale as any).created_at);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        setSaleDate(`${yyyy}-${mm}-${dd}`);
      } else {
        setSaleDate('');
      }
      setCurrentSaleId(sale.id);
      setShowDrafts(false);
      toast({ title: 'Rascunho carregado!', description: 'Continue editando e finalize quando quiser.' });
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  // Add payment entry
  const addPaymentEntry = () => {
    if (curAmount <= 0) {
      toast({ variant: 'destructive', title: 'Informe o valor do pagamento' });
      return;
    }
    if (curMethod === 'card' && !curCardBrand) {
      toast({ variant: 'destructive', title: 'Selecione a bandeira do cartão' });
      return;
    }
    if (curMethod === 'pix' && !pixKey) {
      toast({ variant: 'destructive', title: 'PIX não configurado' });
      return;
    }
    if (curMethod === 'crediario') {
      if (!canUseCrediario) {
        toast({ variant: 'destructive', title: 'Cliente sem crediário autorizado' });
        return;
      }
      if (!curCrediarioFirstDate) {
        toast({ variant: 'destructive', title: 'Informe a data do 1º pagamento' });
        return;
      }
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const firstDue = new Date(curCrediarioFirstDate + 'T00:00:00');
      if (firstDue < today) {
        toast({ variant: 'destructive', title: 'Data inválida', description: 'A 1ª parcela do crediário não pode ter data anterior a hoje.' });
        return;
      }
    }
    const entry: PaymentEntry = {
      id: crypto.randomUUID(),
      method: curMethod,
      amount: curAmount,
      cardType: curMethod === 'card' ? curCardType : undefined,
      cardBrand: curMethod === 'card' ? curCardBrand : undefined,
      installments: curMethod === 'card' && curCardType === 'credit' ? curInstallments : curMethod === 'financeira' ? curFinanceiraInstallments : curMethod === 'crediario' ? curCrediarioInstallments : 1,
      cardFeePercent: curMethod === 'card' ? curCardFeePercent : curMethod === 'financeira' ? curFinanceiraRetention : 0,
      financeiraRetention: curMethod === 'financeira' ? curFinanceiraRetention : undefined,
      financeiraInstallments: curMethod === 'financeira' ? curFinanceiraInstallments : undefined,
      crediarioFirstDate: curMethod === 'crediario' ? curCrediarioFirstDate : undefined,
    };
    setPaymentEntries(prev => [...prev, entry]);
    // Reset form and set remaining as next amount
    const newRemaining = remaining - curAmount;
    setCurAmount(Math.max(0, Math.round(newRemaining * 100) / 100));
    setCurCardBrand('');
    setCurInstallments(1);
    setCurCardFeePercent(0);
    setCurFinanceiraRetention(0);
    setCurFinanceiraInstallments(1);
    setCurCrediarioInstallments(1);
    setCurCrediarioFirstDate('');
  };

  const removePaymentEntry = (id: string) => {
    setPaymentEntries(prev => prev.filter(e => e.id !== id));
  };

  // Request credit override
  const handleRequestOverride = async () => {
    if (!currentAccount || !currentStore || !user || !selectedCustomer) return;
    setSaving(true);
    try {
      let saleId = currentSaleId;
      if (!saleId) {
        const _customCreated = buildCreatedAt();
        const _ins: any = {
          account_id: currentAccount.id, store_id: currentStore.id, seller_user_id: user.id,
          customer_id: selectedCustomer, status: 'draft', discount, delivery_fee: deliveryFee, assembly_fee: assemblyFee, subtotal, total,
        };
        if (_customCreated) _ins.created_at = _customCreated;
        const { data: sale, error } = await supabase.from('sales').insert(_ins).select().single();
        if (error) throw error;
        saleId = sale.id;
        setCurrentSaleId(saleId);
        const items = cart.map(item => ({
          sale_id: saleId!, product_id: item.product.id, qty: item.qty,
          unit_price: item.unit_price, unit_cost: item.product.cost_default, total_line: item.qty * item.unit_price,
        }));
        await supabase.from('sale_items').insert(items);
      }

      const crediarioAmount = curAmount || remaining;
      const { data: req, error } = await supabase.from('credit_override_requests').insert({
        account_id: currentAccount.id,
        store_id: currentStore.id,
        sale_id: saleId,
        customer_id: selectedCustomer,
        requested_by: user.id,
        current_limit: creditLimit,
        used_balance: customerUsedCredit,
        sale_amount: crediarioAmount,
        excess_amount: crediarioAmount - creditAvailable,
      }).select().single();
      if (error) throw error;
      setOverrideRequestId(req.id);
      toast({ title: 'Solicitação enviada', description: 'Aguarde aprovação do dono ou use o PIN.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally { setSaving(false); }
  };

  const checkOverrideStatus = async () => {
    if (!overrideRequestId) return;
    const { data } = await supabase.from('credit_override_requests').select('status').eq('id', overrideRequestId).single();
    if (data?.status === 'approved') {
      setOverrideApproved(true);
      toast({ title: 'Autorizado!', description: 'Crediário liberado pelo dono.' });
    } else if (data?.status === 'denied') {
      toast({ variant: 'destructive', title: 'Negado', description: 'O dono negou a autorização.' });
      setOverrideRequestId(null);
    }
  };

  const handlePinValidation = async () => {
    if (!ownerPin.trim() || !overrideRequestId || !currentAccount) return;
    setPinValidating(true);
    try {
      const { error } = await supabase.rpc('approve_credit_override_with_pin' as any, {
        _request_id: overrideRequestId,
        _pin: ownerPin.trim(),
        _account_id: currentAccount.id,
      });
      if (error) throw error;
      setOverrideApproved(true);
      setShowPinDialog(false);
      setOwnerPin('');
      toast({ title: 'Autorizado via PIN!', description: 'Crediário liberado.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally { setPinValidating(false); }
  };

  const finalizeSale = async () => {
    if (cart.length === 0) { toast({ variant: 'destructive', title: 'Carrinho vazio' }); return; }
    if (paymentEntries.length === 0) { toast({ variant: 'destructive', title: 'Adicione ao menos um pagamento' }); return; }

    // ✋ Bloqueia se houver pagamento em CARTÃO sem taxa preenchida ou com taxa = 0
    const cardWithoutFee = paymentEntries.find(e => e.method === 'card' && (e.cardFeePercent === undefined || e.cardFeePercent === null || Number.isNaN(e.cardFeePercent as any) || Number(e.cardFeePercent) <= 0));
    if (cardWithoutFee) {
      toast({ variant: 'destructive', title: 'Taxa do cartão obrigatória', description: 'Informe a taxa (%) do cartão antes de finalizar. A taxa não pode ser 0.' });
      return;
    }

    const totalPaidNow = paymentEntries.reduce((s, e) => s + e.amount, 0);
    if (partialMode) {
      if (totalPaidNow <= 0) { toast({ variant: 'destructive', title: 'Informe o valor do sinal' }); return; }
      if (totalPaidNow >= total - 0.01) { toast({ variant: 'destructive', title: 'Sinal não pode ser igual ou maior que o total. Desmarque o pagamento parcial.' }); return; }
    } else {
      if (Math.abs(totalPaidNow - total) > 0.01) { toast({ variant: 'destructive', title: 'Valor dos pagamentos não confere com o total' }); return; }
    }

    // Validate crediario entries
    const crediarioEntries = paymentEntries.filter(e => e.method === 'crediario');
    if (crediarioEntries.length > 0) {
      const crediarioTotal = crediarioEntries.reduce((s, e) => s + e.amount, 0);
      if (!canUseCrediario) { toast({ variant: 'destructive', title: 'Cliente sem crediário autorizado' }); return; }
      if (crediarioTotal > creditAvailable && !overrideApproved) { toast({ variant: 'destructive', title: 'Limite de crediário excedido. Solicite autorização.' }); return; }
    }

    if (!currentAccount || !currentStore || !user) return;

    // === OFFLINE MODE ===
    if (!isOnline) {
      setSaving(true);
      try {
        const offlineItems = cart.map(item => ({
          product_id: item.product.id,
          product_name: item.product.name,
          sku: item.product.sku || null,
          qty: item.qty,
          unit_price: item.unit_price,
          unit_cost: item.product.cost_default,
          total_line: Math.round(item.qty * item.unit_price * 100) / 100,
        }));
        const offlinePayments = paymentEntries.map(e => ({
          method: e.method,
          amount: e.amount,
          card_type: e.cardType || null,
          card_brand: e.cardBrand || null,
          installments: e.installments,
          card_fee_percent: e.cardFeePercent,
        }));
        const customerName = selectedCustomerObj?.name || null;
        await createOfflineSale({
          customerId: selectedCustomer,
          customerName,
          discount,
          deliveryFee,
          assemblyFee,
          subtotal,
          total,
          notes: buildNotesForSave(),
          items: offlineItems,
          payments: offlinePayments,
        });
        toast({ title: '✅ Venda salva offline!', description: 'Será sincronizada quando a conexão voltar.' });
        resetAll();
      } catch (e: any) {
        toast({ variant: 'destructive', title: 'Erro ao salvar offline', description: e.message });
      } finally { setSaving(false); }
      return;
    }
    // === END OFFLINE MODE ===

    setSaving(true);
    try {
      let saleId = currentSaleId;
      const remainingBalance = partialMode ? Math.round((total - totalPaidNow) * 100) / 100 : 0;
      const downPayment = partialMode ? totalPaidNow : 0;
      const customCreated2 = buildCreatedAt();
      if (!saleId) {
        const insObj: any = {
          account_id: currentAccount.id, store_id: currentStore.id, seller_user_id: user.id,
          customer_id: selectedCustomer || null, status: 'open', discount, delivery_fee: deliveryFee, assembly_fee: assemblyFee, subtotal, total, notes: buildNotesForSave(),
          down_payment: downPayment, remaining_balance: remainingBalance, payment_on_delivery: partialMode,
        };
        if (customCreated2) insObj.created_at = customCreated2;
        const { data: sale, error } = await supabase.from('sales').insert(insObj as any).select().single();
        if (error) throw error;
        saleId = sale.id;
        const items = cart.map(item => ({
          sale_id: saleId!, product_id: item.product.id, qty: item.qty,
          unit_price: item.unit_price, unit_cost: item.product.cost_default, total_line: item.qty * item.unit_price,
        }));
        await supabase.from('sale_items').insert(items);
      } else {
        const updObj: any = {
          customer_id: selectedCustomer || null, status: 'open', discount, delivery_fee: deliveryFee, assembly_fee: assemblyFee, subtotal, total, notes: buildNotesForSave(),
          down_payment: downPayment, remaining_balance: remainingBalance, payment_on_delivery: partialMode,
          updated_at: new Date().toISOString(),
        };
        if (customCreated2) updObj.created_at = customCreated2;
        await supabase.from('sales').update(updObj as any).eq('id', saleId);
        await supabase.from('sale_items').delete().eq('sale_id', saleId);
        const items = cart.map(item => ({
          sale_id: saleId!, product_id: item.product.id, qty: item.qty,
          unit_price: item.unit_price, unit_cost: item.product.cost_default, total_line: item.qty * item.unit_price,
        }));
        await supabase.from('sale_items').insert(items);
      }

      // Create multiple payments — skip crediário entries (they are represented by parcels in accounts_receivable
      // and only create payment rows when each installment is actually received in /app/crediario)
      for (const entry of paymentEntries) {
        if (entry.method === 'crediario') continue;
        const feeValue = entry.cardFeePercent > 0 ? Math.round(entry.amount * entry.cardFeePercent / 100 * 100) / 100 : 0;
        await supabase.from('payments').insert({
          sale_id: saleId,
          method: entry.method as any,
          card_type: entry.method === 'card' ? (entry.cardType || null) : null,
          brand: entry.method === 'card' ? (entry.cardBrand || null) : null,
          installments: entry.installments,
          card_fee_percent: entry.cardFeePercent || 0,
          card_fee_value: feeValue,
          paid_value: entry.amount,
        });
      }

      // Mark sale status:
      // - 'open' if partialMode (will be collected on delivery)
      // - 'crediario' if there is at least one crediário entry (only finalizes when all parcels are paid)
      // - 'paid' otherwise
      if (!partialMode) {
        const hasCrediario = crediarioEntries.length > 0;
        const newStatus = hasCrediario ? 'crediario' : 'paid';
        await supabase.from('sales').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', saleId);
      }

      // Generate crediário receivables for each crediário entry
      for (const entry of crediarioEntries) {
        if (!selectedCustomer || !entry.crediarioFirstDate) continue;
        const parcels = [];
        const numInstallments = entry.installments || 1;
        const parcelValue = Math.round((entry.amount / numInstallments) * 100) / 100;
        for (let i = 0; i < numInstallments; i++) {
          const dueDate = addMonths(new Date(entry.crediarioFirstDate), i);
          parcels.push({
            account_id: currentAccount.id,
            store_id: currentStore.id,
            sale_id: saleId,
            customer_id: selectedCustomer,
            description: `Crediário - Parcela ${i + 1}/${numInstallments}`,
            category: 'crediário',
            amount: i === numInstallments - 1 ? entry.amount - parcelValue * (numInstallments - 1) : parcelValue,
            due_date: format(dueDate, 'yyyy-MM-dd'),
            installment_number: i + 1,
            total_installments: numInstallments,
            status: 'open',
          });
        }
        await supabase.from('accounts_receivable').insert(parcels);
      }

      // Reload customer credit
      if (crediarioEntries.length > 0 && selectedCustomer) {
        await loadCustomerUsedCredit(selectedCustomer);
      }

      // Log activity
      await logActivity({
        accountId: currentAccount.id,
        userId: user.id,
        userName: user.email,
        action: 'finalize',
        entityType: 'sale',
        entityId: saleId!,
        details: { total, payments: paymentEntries.map(e => ({ method: e.method, amount: e.amount })), customer: selectedCustomerObj?.name || null },
      });

      // Birthday coupon redemption removed (single-tenant cleanup)

      toast({ title: 'Venda finalizada com sucesso!' });
      resetAll();
      loadDraftSales();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao finalizar', description: e.message });
    } finally { setSaving(false); }
  };

  const applyCoupon = async () => {
    toast({ variant: 'destructive', title: 'Cupons indisponíveis', description: 'Funcionalidade desativada.' });
  };
  const clearCoupon = () => {
    if (couponApplied) setDiscount(0);
    setCouponApplied(null); setCouponCode('');
  };

  const resetAll = () => {
    setCart([]); setSelectedCustomer(null); setDiscount(0); setDeliveryFee(0); setAssemblyFee(0); setCurrentSaleId(null); setSaleNotes(''); setIsJpOrigin(false); setSaleDate('');
    setCouponApplied(null); setCouponCode('');
    setShowPaymentModal(false); setShowOrderConfirmation(false);
    setPaymentEntries([]);
    setPartialMode(false);
    setCurMethod('cash'); setCurAmount(0); setCurCardType('debit'); setCurCardBrand('');
    setCurInstallments(1); setCurCardFeePercent(0);
    setCurFinanceiraRetention(0); setCurFinanceiraInstallments(1);
    setCurCrediarioInstallments(1); setCurCrediarioFirstDate('');
    setOverrideRequestId(null); setOverrideApproved(false);
  };

  const clearCart = () => { setCart([]); setSelectedCustomer(null); setDiscount(0); setDeliveryFee(0); setAssemblyFee(0); setCurrentSaleId(null); setSaleNotes(''); setIsJpOrigin(false); setSaleDate(''); setOverrideRequestId(null); setOverrideApproved(false); setPaymentEntries([]); setPartialMode(false); setCouponApplied(null); setCouponCode(''); };

  const openPaymentModal = () => {
    if (fiscalBlockEnabled) {
      const v = validateFiscalCart(cart);
      if (!v.ok) {
        toast({
          variant: 'destructive',
          title: 'Venda bloqueada — dados fiscais incompletos',
          description: `Cadastre NCM e CFOP nos produtos: ${v.missing.slice(0, 3).join(', ')}${v.missing.length > 3 ? `, +${v.missing.length - 3}` : ''}`,
        });
        return;
      }
    }
    setPaymentEntries([]);
    setPartialMode(false);
    setCurAmount(total);
    setCurMethod('cash');
    setShowPaymentModal(true);
  };

  // Cria a venda em estado 'open' e abre o diálogo MP. O webhook + trigger DB marcam como paga.
  const chargeWithMercadoPago = async (kind: 'pix' | 'point_credit' | 'point_debit') => {
    if (!currentAccount || !currentStore || !user) return;
    if (cart.length === 0) { toast({ variant: 'destructive', title: 'Carrinho vazio' }); return; }
    if (total <= 0) return;
    setMpCharging(true);
    try {
      let saleId = currentSaleId;
      if (!saleId) {
        const _cc = buildCreatedAt();
        const _mpIns: any = {
          account_id: currentAccount.id, store_id: currentStore.id, seller_user_id: user.id,
          customer_id: selectedCustomer || null, status: 'open',
          discount, delivery_fee: deliveryFee, assembly_fee: assemblyFee, subtotal, total, notes: buildNotesForSave(),
        };
        if (_cc) _mpIns.created_at = _cc;
        const { data: sale, error } = await supabase.from('sales').insert(_mpIns as any).select().single();
        if (error) throw error;
        saleId = sale.id;
        const items = cart.map(item => ({
          sale_id: saleId!, product_id: item.product.id, qty: item.qty,
          unit_price: item.unit_price, unit_cost: item.product.cost_default, total_line: item.qty * item.unit_price,
        }));
        await supabase.from('sale_items').insert(items);
        setCurrentSaleId(saleId);
      }
      setMpDialog({ kind, saleId: saleId!, amount: total });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao iniciar cobrança MP', description: e.message });
    } finally {
      setMpCharging(false);
    }
  };

  const handleMpApproved = () => {
    toast({ title: '✅ Venda finalizada via Mercado Pago' });
    setMpDialog(null);
    resetAll();
    loadDraftSales();
  };

  const getPaymentLabel = (method: PaymentMethod, entry?: any) => {
    if (method === 'pix') return 'Pix';
    if (method === 'cash') return 'Dinheiro';
    if (method === 'card') {
      // Accept both camelCase (from local PaymentEntry) and snake_case (from DB payments table)
      const cardType = entry?.cardType ?? entry?.card_type;
      const cardBrand = entry?.cardBrand ?? entry?.brand;
      return `Cartão ${cardType === 'credit' ? 'Crédito' : 'Débito'}${cardBrand ? ` (${cardBrand})` : ''}`;
    }
    if (method === 'crediario') return 'Crediário';
    if (method === 'financeira') return 'Financeira';
    return method;
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] gap-4">
      {/* Offline + Contingency indicators */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <OfflineIndicator storeId={currentStore?.id} />
        <ContingencyBadge storeId={currentStore?.id} />
      </div>
      <div className="flex flex-col lg:flex-row flex-1 gap-4 min-h-0">
      {/* Mobile toggle */}
      <div className="flex lg:hidden gap-2">
        <Button variant={mobileView === 'products' ? 'default' : 'outline'} className="flex-1" size="sm" onClick={() => setMobileView('products')}>
          <Search className="mr-1 h-4 w-4" /> Produtos
        </Button>
        <Button variant={mobileView === 'cart' ? 'default' : 'outline'} className="flex-1" size="sm" onClick={() => setMobileView('cart')}>
          <ShoppingCart className="mr-1 h-4 w-4" /> Carrinho ({cart.length})
        </Button>
      </div>

      {/* Products */}
      <div className={`flex flex-col gap-3 lg:w-1/2 ${mobileView === 'cart' ? 'hidden lg:flex' : 'flex'}`}>
        <Card className="flex-1 flex flex-col min-h-0">
          <CardHeader className="pb-2 p-3 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Produtos</CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar por nome ou SKU..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-3 pt-0 sm:p-6 sm:pt-0">
            {searchQuery.trim() ? (
              <div className="space-y-2">
                {searchingProducts ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">Buscando...</span>
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">Nenhum produto encontrado</p>
                ) : (
                  filteredProducts.map(product => (
                    <div key={product.id} className="flex items-center justify-between rounded-lg border p-2 sm:p-3 hover:bg-accent cursor-pointer" onClick={() => addToCart(product)}>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.sku && `${product.sku} • `}{fc(product.price_default)}</p>
                      </div>
                      <Button size="sm" variant="ghost"><Plus className="h-4 w-4" /></Button>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <div className="text-center"><Search className="mx-auto h-8 w-8 mb-2" /><p className="text-sm">Digite para buscar</p></div>
              </div>
            )}
          </CardContent>
        </Card>
        <Button variant="outline" size="sm" onClick={() => setShowDrafts(true)}>
          <FileText className="mr-2 h-4 w-4" /> Rascunhos ({draftSales.length})
        </Button>
      </div>

      {/* Cart */}
      <div className={`flex flex-col gap-3 lg:w-1/2 min-h-0 overflow-auto ${mobileView === 'products' ? 'hidden lg:flex' : 'flex'}`}>
        {/* Cart items */}
        {cart.length > 0 && (
          <Card className="flex-shrink-0">
            <CardHeader className="pb-2 p-3 sm:p-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> Carrinho ({cart.length})</CardTitle>
                <Button variant="ghost" size="sm" onClick={clearCart}>Limpar</Button>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="space-y-2 max-h-[40vh] overflow-auto">
                {cart.map(item => (
                  <div key={item.product.id} className="flex items-center gap-2 rounded-lg border p-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.product.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Input type="number" value={item.unit_price} onChange={(e) => updatePrice(item.product.id, Number(e.target.value))} className="w-20 h-7 text-xs" disabled={!canEditPriceInline} />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">= {fc(item.qty * item.unit_price)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQty(item.product.id, -1)}><Minus className="h-3 w-3" /></Button>
                      <span className="w-6 text-center text-sm font-medium">{item.qty}</span>
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQty(item.product.id, 1)}><Plus className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeFromCart(item.product.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary */}
        <Card className="flex-shrink-0">
          <CardContent className="p-3 sm:pt-4 sm:p-6 space-y-3">
            <div className="space-y-2">
              <Label className="text-xs">Cliente</Label>
              <div className="relative">
                {selectedCustomerObj ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 h-9 text-sm">
                      <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="truncate flex-1">{selectedCustomerObj.name}</span>
                      {selectedCustomerObj.document && <span className="text-xs text-muted-foreground hidden sm:inline">{selectedCustomerObj.document}</span>}
                      {selectedCustomerObj.credit_authorized && <span className="text-xs">✅</span>}
                      <Button variant="ghost" size="icon" className="h-5 w-5 flex-shrink-0" onClick={() => loadCustomerHistory()} title="Histórico">
                        <History className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-5 w-5 flex-shrink-0" onClick={() => setSelectedCustomer(null)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      ref={customerSearchRef}
                      placeholder="Buscar cliente (nome, CPF/CNPJ)..."
                      value={customerQuery}
                      onChange={(e) => { setCustomerQuery(e.target.value); setShowCustomerSearch(true); }}
                      onFocus={() => { if (customerQuery.trim()) setShowCustomerSearch(true); }}
                      className="pl-8 h-9 text-sm"
                    />
                    {showCustomerSearch && customerQuery.trim() && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md border bg-popover shadow-lg max-h-48 overflow-auto">
                        {searchingCustomers ? (
                          <div className="flex items-center justify-center py-3">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          </div>
                        ) : filteredCustomers.length === 0 ? (
                          <p className="text-center text-xs text-muted-foreground py-3">Nenhum cliente encontrado</p>
                        ) : (
                          filteredCustomers.map(c => (
                            <div
                              key={c.id}
                              className="flex items-center gap-2 px-3 py-2 hover:bg-accent cursor-pointer text-sm border-b last:border-b-0"
                              onClick={() => { setSelectedCustomer(c.id); setCustomerQuery(''); setShowCustomerSearch(false); }}
                            >
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{c.name}{c.credit_authorized ? ' ✅' : ''}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {c.document || 'Sem documento'}{c.phone ? ` • ${c.phone}` : ''}
                                </p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {selectedCustomerObj && selectedCustomerObj.credit_authorized && (
                <div className="text-xs space-y-0.5">
                  <p className="text-green-600">Crediário: Limite {fc(creditLimit)}</p>
                  <p className="text-muted-foreground">Utilizado: {fc(customerUsedCredit)} | Disponível: {fc(creditAvailable)}</p>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Desconto (R$)</Label>
              <Input type="number" value={discount} onChange={(e) => { setDiscount(Number(e.target.value)); if (couponApplied) setCouponApplied(null); }} min={0} max={subtotal} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cupom de desconto</Label>
              {couponApplied ? (
                <div className="flex items-center justify-between rounded-md border-2 border-dashed border-primary px-2 py-1.5 bg-primary/5">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-primary truncate">{couponApplied.code}</p>
                    <p className="text-[10px] text-muted-foreground">-{fc(couponApplied.discount)}{couponApplied.description ? ` · ${couponApplied.description}` : ''}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={clearCoupon}>Remover</Button>
                </div>
              ) : (
                <div className="flex gap-1">
                  <Input value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} placeholder="Código" className="h-9 text-xs uppercase" />
                  <Button size="sm" className="h-9" onClick={applyCoupon} disabled={couponValidating}>
                    {couponValidating ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Aplicar'}
                  </Button>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground leading-tight">Cupom é pessoal — selecione o cliente vinculado.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Taxa de Entrega (R$)</Label>
                <Input type="number" value={deliveryFee} onChange={(e) => setDeliveryFee(Number(e.target.value))} min={0} step={0.01} className="h-9" />
              </div>
              {isModuleEnabled(currentAccount, 'assemblies') && (
                <div className="space-y-1">
                  <Label className="text-xs">Taxa de Montagem (R$)</Label>
                  <Input type="number" value={assemblyFee} onChange={(e) => setAssemblyFee(Number(e.target.value))} min={0} step={0.01} className="h-9" />
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data da venda</Label>
              <Input
                type="date"
                value={saleDate}
                min={minLocalISO}
                max={todayLocalISO}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v && v > todayLocalISO) { setSaleDate(todayLocalISO); return; }
                  if (v && v < minLocalISO) { setSaleDate(minLocalISO); return; }
                  setSaleDate(v);
                }}
                className="h-9"
              />
              <p className="text-[10px] text-muted-foreground leading-tight">Em branco = hoje. Permite registrar em data anterior (não futura, máx. 2 anos).</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Observações</Label>
              <textarea
                value={saleNotes}
                onChange={(e) => setSaleNotes(e.target.value)}
                placeholder="Observações do pedido..."
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring h-16 resize-none"
              />
            </div>
            {showJpToggle && (
              <div className="flex items-start justify-between gap-2 rounded-md border border-orange-300 bg-orange-50 dark:bg-orange-950/30 px-3 py-2">
                <div className="flex-1">
                  <Label htmlFor="jp-origin-toggle" className="text-xs font-semibold text-orange-700 dark:text-orange-300 cursor-pointer">
                    🔄 Venda da JP Móveis (faturada aqui)
                  </Label>
                  <p className="text-[10px] text-orange-600/80 dark:text-orange-400/80 leading-tight mt-0.5">
                    Marca temporária para identificar vendas da JP enquanto a NF está suspensa.
                  </p>
                </div>
                <Switch id="jp-origin-toggle" checked={isJpOrigin} onCheckedChange={setIsJpOrigin} />
              </div>
            )}
            <div className="space-y-1 pt-2 border-t">
              <div className="flex justify-between text-sm"><span>Subtotal</span><span>{fc(subtotal)}</span></div>
              {discount > 0 && <div className="flex justify-between text-sm text-destructive"><span>Desconto</span><span>-{fc(discount)}</span></div>}
              {deliveryFee > 0 && <div className="flex justify-between text-sm text-blue-600"><span>Taxa Entrega</span><span>+{fc(deliveryFee)}</span></div>}
              {assemblyFee > 0 && <div className="flex justify-between text-sm text-purple-600"><span>Taxa Montagem</span><span>+{fc(assemblyFee)}</span></div>}
              <div className="flex justify-between text-lg font-bold"><span>Total</span><span>{fc(total)}</span></div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" size="sm" onClick={saveDraft} disabled={saving || cart.length === 0}>
                {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />} Salvar
              </Button>
              <Button className="flex-1" size="sm" onClick={openPaymentModal} disabled={saving || cart.length === 0}>
                Finalizar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Modal - Multi-payment */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pagamento</DialogTitle>
            <DialogDescription>
              Total: {fc(total)}
              {partialMode
                ? ` | Sinal: ${fc(totalPaid)} | Saldo na entrega: ${fc(Math.max(0, total - totalPaid))}`
                : (paymentEntries.length > 0 && ` | Restante: ${fc(remaining)}`)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Partial payment toggle */}
            <label className="flex items-start gap-2 rounded-lg border border-status-warning/40 bg-status-warning/5 p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={partialMode}
                onChange={(e) => {
                  setPartialMode(e.target.checked);
                  if (e.target.checked) {
                    setCurAmount(0);
                  } else {
                    setCurAmount(Math.max(0, total - paymentEntries.reduce((s, p) => s + p.amount, 0)));
                  }
                }}
                className="mt-0.5 h-4 w-4 cursor-pointer"
              />
              <div className="text-xs">
                <p className="font-semibold">Pagamento parcial — Saldo na entrega (A Receber)</p>
                <p className="text-muted-foreground mt-0.5">
                  Cliente paga um sinal agora e o restante somente no ato da entrega. A venda fica em aberto e a nota só será emitida na quitação.
                </p>
              </div>
            </label>

            {/* Added payments list */}
            {paymentEntries.length > 0 && (
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">
                  {partialMode ? 'Sinal Adicionado' : 'Pagamentos Adicionados'}
                </p>
                {paymentEntries.map(entry => (
                  <div key={entry.id} className="flex items-center justify-between text-sm">
                    <span>{getPaymentLabel(entry.method, entry)}{entry.installments > 1 ? ` ${entry.installments}x` : ''}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{fc(entry.amount)}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removePaymentEntry(entry.id)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-bold border-t pt-1">
                  <span>{partialMode ? 'Total do sinal' : 'Total pago'}</span>
                  <span>{fc(totalPaid)}</span>
                </div>
                {partialMode && (
                  <div className="flex justify-between text-sm font-bold text-status-warning">
                    <span>Saldo a receber na entrega</span>
                    <span>{fc(Math.max(0, total - totalPaid))}</span>
                  </div>
                )}
              </div>
            )}

            {/* Add new payment — show if there's room or partial mode is on */}
            {(partialMode ? (totalPaid < total - 0.01) : remaining > 0.01) && (
              <>
                <div className="space-y-2">
                  <Label>Forma de Pagamento</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {([['pix', Smartphone, 'Pix'], ['cash', Banknote, 'Dinheiro'], ['card', CreditCard, 'Cartão'], ['crediario', BookOpen, 'Crediário'], ['financeira', Building2, 'Financeira']] as const).map(([method, Icon, label]) => {
                      const blocked = method === 'crediario' && isModuleDisabled(currentAccount, 'crediario');
                      return (
                        <Button key={method} variant={curMethod === method ? 'default' : 'outline'} className="flex flex-col gap-1 h-auto py-2 relative" onClick={() => setCurMethod(method as PaymentMethod)} size="sm" disabled={blocked} title={blocked ? MODULE_BLOCKED_MESSAGE : undefined}>
                          <Icon className="h-4 w-4" /><span className="text-[10px]">{label}</span>
                          {blocked && <span className="absolute top-0.5 right-0.5 text-[8px]">🔒</span>}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Valor</Label>
                  <Input type="number" value={curAmount} onChange={e => setCurAmount(Number(e.target.value))} min={0.01} max={remaining} step={0.01} />
                  <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setCurAmount(Math.round(remaining * 100) / 100)}>
                    Usar valor restante ({fc(remaining)})
                  </Button>
                </div>

                {/* PIX info */}
                {curMethod === 'pix' && pixKey && (
                  <div className="rounded-lg border p-3 space-y-2">
                    {(() => {
                      const pixPayload = generatePixPayload({ pixKey, merchantName: currentStore?.name || 'Loja', amount: curAmount > 0 ? curAmount : undefined });
                      const qrUrl = getPixQrCodeUrl(pixPayload, 140);
                      return (
                        <div className="flex flex-col items-center gap-2">
                          <img src={qrUrl} alt="QR Code PIX" className="w-[140px] h-[140px] rounded-lg border" />
                          <div className="flex items-center gap-2 w-full">
                            <Input value={pixPayload} readOnly className="h-8 text-xs font-mono" />
                            <Button variant="outline" size="icon" className="h-8 w-8 flex-shrink-0" onClick={copyPixKey}>
                              {pixCopied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                            </Button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
                {curMethod === 'pix' && !pixKey && (
                  <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-center">
                    <ShieldAlert className="h-6 w-6 mx-auto text-destructive mb-1" />
                    <p className="text-xs text-destructive">PIX não configurado. Configure na tela de Lojas.</p>
                  </div>
                )}

                {/* Card options */}
                {curMethod === 'card' && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant={curCardType === 'debit' ? 'default' : 'outline'} size="sm" onClick={() => { setCurCardType('debit'); setCurInstallments(1); }}>Débito</Button>
                      <Button variant={curCardType === 'credit' ? 'default' : 'outline'} size="sm" onClick={() => setCurCardType('credit')}>Crédito</Button>
                    </div>
                    <Select value={curCardBrand} onValueChange={setCurCardBrand}>
                      <SelectTrigger><SelectValue placeholder="Bandeira" /></SelectTrigger>
                      <SelectContent>{cardBrands.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                    </Select>
                    {curCardType === 'credit' && (
                      <Select value={String(curInstallments)} onValueChange={v => setCurInstallments(Number(v))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{Array.from({ length: 20 }, (_, i) => i + 1).map(n => <SelectItem key={n} value={String(n)}>{n}x de {fc(curAmount / n)}</SelectItem>)}</SelectContent>
                      </Select>
                    )}
                    <div className="space-y-1">
                      <Label className="text-xs">Taxa (%)</Label>
                      <Input type="number" value={curCardFeePercent} onChange={e => setCurCardFeePercent(Number(e.target.value))} min={0} max={100} step={0.01} className="h-8" />
                    </div>
                  </>
                )}

                {/* Financeira options */}
                {curMethod === 'financeira' && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs">Retenção (%)</Label>
                      <Input type="number" value={curFinanceiraRetention} onChange={e => setCurFinanceiraRetention(Number(e.target.value))} min={0} max={100} step={0.01} className="h-8" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Parcelas</Label>
                      <Select value={String(curFinanceiraInstallments)} onValueChange={v => setCurFinanceiraInstallments(Number(v))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{Array.from({ length: 24 }, (_, i) => i + 1).map(n => <SelectItem key={n} value={String(n)}>{n}x de {fc(curAmount / n)}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    {curFinanceiraRetention > 0 && (
                      <div className="rounded-lg bg-muted p-2 space-y-1 text-xs">
                        <div className="flex justify-between"><span>Bruto</span><span>{fc(curAmount)}</span></div>
                        <div className="flex justify-between text-destructive"><span>Retenção ({curFinanceiraRetention}%)</span><span>-{fc(curAmount * curFinanceiraRetention / 100)}</span></div>
                        <div className="flex justify-between font-medium border-t pt-1"><span>Líquido</span><span>{fc(curAmount * (1 - curFinanceiraRetention / 100))}</span></div>
                      </div>
                    )}
                  </>
                )}

                {/* Crediário options */}
                {curMethod === 'crediario' && (
                  <div className="space-y-3">
                    {!selectedCustomer ? (
                      <p className="text-xs text-destructive">Selecione um cliente para usar crediário.</p>
                    ) : !canUseCrediario ? (
                      <p className="text-xs text-destructive">Cliente sem crediário autorizado.</p>
                    ) : (
                      <>
                        <div className="rounded-lg border-green-500/30 border bg-green-500/5 p-2">
                          <p className="text-xs font-medium text-green-700">Crediário autorizado</p>
                          <p className="text-[10px] text-muted-foreground">Limite: {fc(creditLimit)} | Disponível: {fc(creditAvailable)}</p>
                        </div>
                        {curAmount > creditAvailable && !overrideApproved && (
                          <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-2 space-y-2">
                            <p className="text-xs font-medium text-destructive flex items-center gap-1"><ShieldAlert className="h-3 w-3" /> Limite excedido</p>
                            {!overrideRequestId ? (
                              <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={handleRequestOverride} disabled={saving}>
                                Solicitar autorização
                              </Button>
                            ) : (
                              <div className="flex gap-1">
                                <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={checkOverrideStatus}>Verificar</Button>
                                <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={() => setShowPinDialog(true)}>
                                  <KeyRound className="mr-1 h-3 w-3" /> PIN
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                        {(curAmount <= creditAvailable || overrideApproved) && (
                          <>
                            <div className="space-y-1">
                              <Label className="text-xs">Data 1º pagamento *</Label>
                              <Input type="date" value={curCrediarioFirstDate} min={new Date().toISOString().slice(0, 10)} onChange={e => setCurCrediarioFirstDate(e.target.value)} className="h-8" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Parcelas</Label>
                              <Select value={String(curCrediarioInstallments)} onValueChange={v => setCurCrediarioInstallments(Number(v))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>{Array.from({ length: 24 }, (_, i) => i + 1).map(n => <SelectItem key={n} value={String(n)}>{n}x de {fc(curAmount / n)}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}

                <Button variant="secondary" className="w-full" onClick={addPaymentEntry} size="sm">
                  <Plus className="mr-1 h-4 w-4" /> Adicionar Pagamento
                </Button>
              </>
            )}
          </div>
          {mpConn?.status === 'connected' && total > 0 && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-2 space-y-1.5">
              <p className="text-xs font-medium">Cobrança automática Mercado Pago</p>
              <div className="flex flex-wrap gap-1.5">
                {(mpConn.enabled_methods || []).includes('pix') && (
                  <Button size="sm" variant="outline" disabled={mpCharging} onClick={() => chargeWithMercadoPago('pix')} className="h-8 gap-1">
                    <Smartphone className="h-3.5 w-3.5" /> PIX dinâmico
                  </Button>
                )}
                {mpConn.point_device_id && (mpConn.enabled_methods || []).includes('credit_card') && (
                  <Button size="sm" variant="outline" disabled={mpCharging} onClick={() => chargeWithMercadoPago('point_credit')} className="h-8 gap-1">
                    <CreditCard className="h-3.5 w-3.5" /> Point Crédito
                  </Button>
                )}
                {mpConn.point_device_id && (mpConn.enabled_methods || []).includes('debit_card') && (
                  <Button size="sm" variant="outline" disabled={mpCharging} onClick={() => chargeWithMercadoPago('point_debit')} className="h-8 gap-1">
                    <CreditCard className="h-3.5 w-3.5" /> Point Débito
                  </Button>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentModal(false)}>Cancelar</Button>
            <Button
              onClick={() => { setShowPaymentModal(false); setShowOrderConfirmation(true); }}
              disabled={
                paymentEntries.length === 0 ||
                (partialMode
                  ? (totalPaid <= 0 || totalPaid >= total - 0.01)
                  : remaining > 0.01)
              }
            >
              Revisar Pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mercado Pago dialogs */}
      {mpDialog && currentStore?.id && (
        <>
          {mpDialog.kind === 'pix' && (
            <MercadoPagoPixDialog
              open
              onClose={() => setMpDialog(null)}
              storeId={currentStore.id}
              amount={mpDialog.amount}
              saleId={mpDialog.saleId}
              source="pdv"
              onApproved={handleMpApproved}
            />
          )}
          {mpDialog.kind === 'point_credit' && (
            <MercadoPagoPointDialog
              open
              onClose={() => setMpDialog(null)}
              storeId={currentStore.id}
              amount={mpDialog.amount}
              saleId={mpDialog.saleId}
              method="credit_card"
              onApproved={handleMpApproved}
            />
          )}
          {mpDialog.kind === 'point_debit' && (
            <MercadoPagoPointDialog
              open
              onClose={() => setMpDialog(null)}
              storeId={currentStore.id}
              amount={mpDialog.amount}
              saleId={mpDialog.saleId}
              method="debit_card"
              onApproved={handleMpApproved}
            />
          )}
        </>
      )}

      {/* Owner PIN Dialog */}
      <AlertDialog open={showPinDialog} onOpenChange={setShowPinDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Autorizar com PIN do Dono</AlertDialogTitle>
            <AlertDialogDescription>Solicite o PIN ao dono da empresa.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label>PIN do Dono</Label>
            <Input type="password" value={ownerPin} onChange={e => setOwnerPin(e.target.value)} placeholder="Digite o PIN" maxLength={10} className="mt-2" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setOwnerPin('')}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handlePinValidation} disabled={pinValidating || !ownerPin.trim()}>
              {pinValidating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Validar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Order Confirmation Summary */}
      <Dialog open={showOrderConfirmation} onOpenChange={setShowOrderConfirmation}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> Resumo do Pedido
            </DialogTitle>
            <DialogDescription>Confira todos os dados antes de finalizar</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Store info */}
            <div className="rounded-lg border p-3 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Loja</p>
              <p className="font-medium text-sm">{currentStore?.name}</p>
              {currentStore?.cnpj && <p className="text-xs text-muted-foreground">CNPJ: {currentStore.cnpj}</p>}
            </div>

            {/* Customer info */}
            <div className="rounded-lg border p-3 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Cliente</p>
              {selectedCustomerObj ? (
                <>
                  <p className="font-medium text-sm">{selectedCustomerObj.name}</p>
                  {selectedCustomerObj.document && <p className="text-xs text-muted-foreground">CPF/CNPJ: {selectedCustomerObj.document}</p>}
                  {selectedCustomerObj.email && <p className="text-xs text-muted-foreground">E-mail: {selectedCustomerObj.email}</p>}
                  {selectedCustomerObj.phone && <p className="text-xs text-muted-foreground">Telefone: {selectedCustomerObj.phone}</p>}
                  {selectedCustomerObj.address_json && (() => {
                    const addr = selectedCustomerObj.address_json as any;
                    const parts = [addr.street, addr.number, addr.complement, addr.district, addr.city, addr.state, addr.postalCode].filter(Boolean);
                    return parts.length > 0 ? <p className="text-xs text-muted-foreground">Endereço: {parts.join(', ')}</p> : null;
                  })()}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Consumidor Final</p>
              )}
            </div>

            {/* Items */}
            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Itens ({cart.length})</p>
              <div className="space-y-1.5 max-h-40 overflow-auto">
                {cart.map((item, idx) => (
                  <div key={item.product.id} className="flex justify-between text-sm">
                    <span className="truncate flex-1 mr-2">
                      {idx + 1}. {item.product.name} <span className="text-muted-foreground">× {item.qty}</span>
                    </span>
                    <span className="font-medium whitespace-nowrap">{fc(item.qty * item.unit_price)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="rounded-lg border p-3 space-y-1">
              <div className="flex justify-between text-sm"><span>Subtotal</span><span>{fc(subtotal)}</span></div>
              {discount > 0 && <div className="flex justify-between text-sm text-destructive"><span>Desconto</span><span>-{fc(discount)}</span></div>}
              {deliveryFee > 0 && <div className="flex justify-between text-sm text-blue-600"><span>Taxa Entrega</span><span>+{fc(deliveryFee)}</span></div>}
              {assemblyFee > 0 && <div className="flex justify-between text-sm text-purple-600"><span>Taxa Montagem</span><span>+{fc(assemblyFee)}</span></div>}
              <div className="flex justify-between text-lg font-bold border-t pt-1"><span>Total</span><span>{fc(total)}</span></div>
            </div>

            {/* Payments */}
            <div className="rounded-lg border p-3 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase">
                {partialMode ? `Sinal pago agora (${paymentEntries.length})` : `Pagamentos (${paymentEntries.length})`}
              </p>
              {paymentEntries.map(entry => (
                <div key={entry.id} className="flex justify-between text-sm">
                  <span>
                    {getPaymentLabel(entry.method, entry)}
                    {entry.installments > 1 && ` ${entry.installments}x`}
                  </span>
                  <span className="font-medium">{fc(entry.amount)}</span>
                </div>
              ))}
              {partialMode && (
                <div className="mt-2 rounded border border-status-warning/40 bg-status-warning/10 p-2">
                  <div className="flex justify-between text-sm font-bold text-status-warning">
                    <span>⏳ Saldo a receber na entrega</span>
                    <span>{fc(Math.max(0, total - totalPaid))}</span>
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    A nota fiscal será emitida apenas quando o saldo for pago no ato da entrega.
                  </p>
                </div>
              )}
            </div>

            {/* Notes */}
            {saleNotes.trim() && (
              <div className="rounded-lg border p-3 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Observações</p>
                <p className="text-sm whitespace-pre-wrap">{saleNotes}</p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowOrderConfirmation(false); setShowPaymentModal(true); }}>Voltar</Button>
            <Button onClick={() => { setShowOrderConfirmation(false); finalizeSale(); }} disabled={saving} className="flex-1">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              ✓ Confirmar e Finalizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Drafts Modal */}
      <Dialog open={showDrafts} onOpenChange={setShowDrafts}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vendas em Rascunho</DialogTitle>
            <DialogDescription>Clique para continuar a venda</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-auto">
            {draftSales.length === 0 ? <p className="text-center text-muted-foreground py-8">Nenhum rascunho</p> : draftSales.map(sale => (
              <div key={sale.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent">
                <div className="cursor-pointer flex-1" onClick={() => loadDraft(sale)}>
                  <p className="font-medium">{fc(sale.total)}</p>
                  <p className="text-sm text-muted-foreground">{new Date(sale.updated_at).toLocaleString('pt-BR')}</p>
                  <p className="text-xs text-primary">Clique para continuar →</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive flex-shrink-0" onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    await supabase.from('sale_items').delete().eq('sale_id', sale.id);
                    await supabase.from('sales').delete().eq('id', sale.id);
                    if (currentSaleId === sale.id) { setCurrentSaleId(null); clearCart(); }
                    toast({ title: 'Rascunho excluído' });
                    loadDraftSales();
                  } catch (err: any) { toast({ variant: 'destructive', title: 'Erro', description: err.message }); }
                }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Customer History Dialog */}
      <Dialog open={showCustomerHistory} onOpenChange={setShowCustomerHistory}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" /> Histórico do Cliente
            </DialogTitle>
            <DialogDescription>{selectedCustomerObj?.name}</DialogDescription>
          </DialogHeader>
          {selectedCustomerObj && (
            <div className="space-y-4">
              {/* Customer info */}
              <div className="rounded-lg border p-3 space-y-1 text-sm">
                <p className="font-medium">{selectedCustomerObj.name}</p>
                {selectedCustomerObj.document && <p className="text-muted-foreground">CPF/CNPJ: {selectedCustomerObj.document}</p>}
                {selectedCustomerObj.phone && <p className="text-muted-foreground">Tel: {selectedCustomerObj.phone}</p>}
                {selectedCustomerObj.email && <p className="text-muted-foreground">E-mail: {selectedCustomerObj.email}</p>}
                {selectedCustomerObj.address_json && (() => {
                  const addr = selectedCustomerObj.address_json as any;
                  const parts = [addr.street, addr.number, addr.complement, addr.district, addr.city, addr.state, addr.postalCode].filter(Boolean);
                  return parts.length > 0 ? <p className="text-muted-foreground">Endereço: {parts.join(', ')}</p> : null;
                })()}
                {selectedCustomerObj.credit_authorized && (
                  <p className="text-green-600 text-xs">Crediário: Limite {fc(creditLimit)} | Usado: {fc(customerUsedCredit)} | Disponível: {fc(creditAvailable)}</p>
                )}
              </div>

              {/* Sales history */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Últimas Vendas</p>
                {loadingHistory ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : customerSales.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-4">Nenhuma venda encontrada</p>
                ) : (
                  customerSales.map((s: any) => (
                    <div key={s.id} className="border rounded-lg p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">#{s.order_number || '—'}</span>
                        <Badge variant={s.status === 'paid' ? 'default' : s.status === 'canceled' ? 'destructive' : 'secondary'} className="text-xs">
                          {{ draft: 'Rascunho', open: 'Aberta', paid: 'Paga', canceled: 'Cancelada' }[s.status as string] || s.status}
                        </Badge>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{new Date(s.created_at).toLocaleDateString('pt-BR')}</span>
                        <span className="font-medium text-foreground">{fc(s.total)}</span>
                      </div>
                      {s.payments && s.payments.length > 0 && (
                        <p className="text-[10px] text-muted-foreground">
                          {s.payments.map((p: any) => getPaymentLabel(p.method, p)).join(', ')}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
