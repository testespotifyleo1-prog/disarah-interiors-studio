import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useProductSearch } from '@/hooks/useProductSearch';
import { useCustomerSearch } from '@/hooks/useCustomerSearch';
import { useOfflinePDV } from '@/hooks/useOfflinePDV';
import { useFiscalBlock } from '@/hooks/useFiscalBlock';
import { logActivity } from '@/utils/activityLog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft, Barcode, Search, Plus, Minus, Trash2, Loader2, ShoppingCart,
  User, X, CreditCard, Banknote, Smartphone, FileText, Building2, BookOpen, Copy, Check,
  Lock, Unlock, DollarSign, Printer, Keyboard, Pause, Play, Clock, Gift, WifiOff,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { isMirandaEFarias, setJpOrigin } from '@/lib/saleOrigin';
import { isMirandaGroupStore } from '@/utils/mirandaBranding';
import type { Product, Customer, PaymentMethod, CardType } from '@/types/database';
import { usePriceTiers } from '@/hooks/usePriceTiers';
import { addMonths, format } from 'date-fns';
import { generatePixPayload, getPixQrCodeUrl } from '@/utils/pixUtils';
import { generateSalePDF, printSalePDF, printBlobDirectly } from '@/utils/generateSalePDF';
import { ensureIssuedNfceForSale, downloadFiscalDocumentFile } from '@/utils/fiscalDocuments';
import PinAuthModal from '@/components/PinAuthModal';
import { isModuleDisabled, isModuleEnabled, MODULE_BLOCKED_MESSAGE } from '@/utils/accountModules';
import PdvOperationsModal from '@/components/pdv/PdvOperationsModal';
import PdvReportModal from '@/components/pdv/PdvReportModal';
import OfflineIndicator from '@/components/pdv/OfflineIndicator';
import { ContingencyBadge } from '@/components/pdv/ContingencyBadge';

function humanizePrintError(message: string, type: 'receipt' | 'fiscal'): string {
  if (!message) return type === 'fiscal'
    ? 'Ocorreu um erro ao emitir ou imprimir a NFC-e. Tente novamente.'
    : 'Ocorreu um erro ao gerar o comprovante de compra. Tente novamente.';

  if (message.includes('Failed to read a named property') || message.includes('cross-origin') || message.includes('Blocked a frame with origin'))
    return 'O navegador bloqueou a impressão automática. Tente novamente. Se continuar, desative bloqueadores no navegador para este sistema.';
  if (message.includes('ERR_BLOCKED_BY_CLIENT'))
    return 'O navegador ou alguma extensão bloqueou a impressão. Desative o bloqueador e tente novamente.';
  if (message.includes('Sessão expirada') || message.includes('Unauthorized'))
    return 'Sua sessão expirou. Faça login novamente para continuar.';
  if (message.includes('Configurações fiscais'))
    return 'As configurações fiscais da loja não estão definidas. Vá em Configurações > Fiscal para configurar.';
  if (message.includes('company_id'))
    return 'A empresa fiscal não está configurada. Configure nas Configurações Fiscais da loja.';
  if (message.includes('Schema xml') || message.includes('validação'))
    return 'Erro de validação nos dados fiscais. Verifique os dados dos produtos (NCM, CFOP, etc).';
  if (message.includes('SEFAZ') || message.includes('processamento'))
    return 'A SEFAZ ainda está processando. Aguarde alguns segundos e tente novamente.';
  if (message.includes('carregar o comprovante') || message.includes('processar o documento para impressão'))
    return type === 'fiscal'
      ? 'Não foi possível preparar o cupom fiscal para impressão. Tente novamente.'
      : 'Não foi possível preparar o comprovante de compra para impressão. Tente novamente.';
  if (message.includes('abrir o comprovante para impressão') || message.includes('iniciar a impressão'))
    return type === 'fiscal'
      ? 'A impressão do cupom fiscal não pôde ser iniciada. Tente novamente.'
      : 'A impressão do comprovante de compra não pôde ser iniciada. Tente novamente.';
  if (message.includes('não disponível'))
    return type === 'fiscal'
      ? 'O cupom fiscal ainda não está disponível para impressão. Aguarde alguns segundos e tente novamente.'
      : 'O comprovante de compra ainda não está disponível para impressão. Tente novamente.';
  if (message.includes('Documento fiscal não'))
    return 'O documento fiscal não foi encontrado. Tente emitir novamente.';
  if (message.includes('denied') || message.includes('negada'))
    return 'A NFC-e foi negada pela SEFAZ. Verifique os dados fiscais e tente novamente.';

  return type === 'fiscal'
    ? 'Não foi possível emitir ou imprimir a NFC-e agora. Revise a configuração fiscal da loja e tente novamente.'
    : 'Não foi possível gerar ou imprimir o comprovante de compra. Confira os dados da venda e tente novamente.';
}

interface CartItem {
  product: Product;
  qty: number;
  unit_price: number;
  variant_id?: string;
  presentation_id?: string;
  presentation_name?: string;
  conversion_factor?: number;
}

interface PaymentEntry {
  id: string;
  method: PaymentMethod;
  amount: number;
  cardType?: CardType;
  cardBrand?: string;
  installments: number;
  cardFeePercent: number;
  financeiraRetention?: number;
  financeiraInstallments?: number;
  crediarioFirstDate?: string;
  storeCreditId?: string;
  storeCreditName?: string;
}

const cardBrands = ['Visa', 'MasterCard', 'Elo', 'Hipercard', 'American Express', 'Diners'];

export default function PDVRapido() {
  const navigate = useNavigate();
  const { user, currentAccount, currentStore, userRole } = useAuth();
  const { isOnline, createOfflineSale, searchOfflineProducts } = useOfflinePDV({
    accountId: currentAccount?.id,
    storeId: currentStore?.id,
    userId: user?.id,
    userEmail: user?.email || undefined,
  });
  const { toast } = useToast();
  const barcodeRef = useRef<HTMLInputElement>(null);

  const { query: searchQuery, setQuery: setSearchQuery, results: onlineSearchResults, searching: onlineSearching } = useProductSearch({
    accountId: currentAccount?.id,
    activeOnly: true,
    limit: 20,
    debounceMs: 150,
  });

  // Offline search state
  const [offlineSearchResults, setOfflineSearchResults] = useState<Product[]>([]);
  const [offlineSearching, setOfflineSearching] = useState(false);
  const offlineSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // When offline, run search against cached products
  useEffect(() => {
    if (isOnline) { setOfflineSearchResults([]); return; }
    if (offlineSearchTimerRef.current) clearTimeout(offlineSearchTimerRef.current);
    if (!searchQuery.trim()) { setOfflineSearchResults([]); setOfflineSearching(false); return; }
    setOfflineSearching(true);
    offlineSearchTimerRef.current = setTimeout(async () => {
      try {
        const results = await searchOfflineProducts(searchQuery);
        setOfflineSearchResults(results.map(p => ({
          ...p,
          cost_default: p.cost_default ?? 0,
          description: null,
          brand: null,
          weight: null,
          weight_unit: 'g',
          category: null,
          supplier_id: null,
          ncm: null,
          cest: null,
          cfop_default: null,
          origem_icms: '0',
          cst_icms: null,
          csosn: null,
          aliq_icms: 0,
          aliq_pis: 0,
          aliq_cofins: 0,
          aliq_ipi: 0,
          cst_pis: null,
          cst_cofins: null,
          cst_ipi: null,
          variant_options: null,
          promo_price: null,
          promo_starts_at: null,
          promo_ends_at: null,
          product_group: null,
          created_at: '',
        } as Product)));
      } catch { setOfflineSearchResults([]); }
      setOfflineSearching(false);
    }, 150);
    return () => { if (offlineSearchTimerRef.current) clearTimeout(offlineSearchTimerRef.current); };
  }, [searchQuery, isOnline, searchOfflineProducts]);

  const searchResults = isOnline ? onlineSearchResults : offlineSearchResults;
  const searching = isOnline ? onlineSearching : offlineSearching;

  const {
    query: customerQuery, setQuery: setCustomerQuery,
    results: filteredCustomers, searching: searchingCustomers,
    allCustomers: customers, refresh: refreshCustomers,
  } = useCustomerSearch({ accountId: currentAccount?.id });

  // Load store credit balances per customer + manual-name credits
  const [customerCredits, setCustomerCredits] = useState<Record<string, number>>({});
  const [manualCreditEntries, setManualCreditEntries] = useState<{ id: string; name: string; amount: number }[]>([]);
  useEffect(() => {
    if (!currentAccount?.id) return;
    const loadCredits = async () => {
      const { data } = await (supabase as any)
        .from('store_credits')
        .select('id, customer_id, customer_name_manual, remaining_amount')
        .eq('account_id', currentAccount.id)
        .eq('status', 'active')
        .gt('remaining_amount', 0);
      if (data) {
        const map: Record<string, number> = {};
        const manuals: { id: string; name: string; amount: number }[] = [];
        (data as any[]).forEach((c: any) => {
          if (c.customer_id) {
            map[c.customer_id] = (map[c.customer_id] || 0) + c.remaining_amount;
          } else if (c.customer_name_manual) {
            manuals.push({ id: c.id, name: c.customer_name_manual, amount: c.remaining_amount });
          }
        });
        setCustomerCredits(map);
        setManualCreditEntries(manuals);
      }
    };
    loadCredits();
  }, [currentAccount?.id]);

  // Persist cart in sessionStorage so it survives navigation
  const cartStorageKey = currentStore ? `pdv_cart_${currentStore.id}` : null;

  const loadPersistedCart = (): { cart: CartItem[]; customer: string | null; notes: string } => {
    if (!cartStorageKey) return { cart: [], customer: null, notes: '' };
    try {
      const raw = sessionStorage.getItem(cartStorageKey);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { cart: [], customer: null, notes: '' };
  };

  const [cart, setCart] = useState<CartItem[]>(() => loadPersistedCart().cart);
  const { blockEnabled: fiscalBlockEnabled, validateCart: validateFiscalCart } = useFiscalBlock(currentStore?.id);
  const cartProductIds = cart.map(i => i.product.id);
  const { getTierPrice } = usePriceTiers(cartProductIds);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(() => loadPersistedCart().customer);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [quickCustomerName, setQuickCustomerName] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [showDiscountInput, setShowDiscountInput] = useState(false);
  const [tempDiscount, setTempDiscount] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponApplied, setCouponApplied] = useState<{ code: string; discount: number; description?: string | null } | null>(null);
  const [couponValidating, setCouponValidating] = useState(false);
  const [assemblyFee, setAssemblyFee] = useState(0);
  const [showAssemblyInput, setShowAssemblyInput] = useState(false);
  const [tempAssembly, setTempAssembly] = useState('');
  const [paymentEntries, setPaymentEntries] = useState<PaymentEntry[]>([]);
  const [curMethod, setCurMethod] = useState<PaymentMethod>('cash');
  const [curAmount, setCurAmount] = useState(0);
  const [curCardType, setCurCardType] = useState<CardType>('debit');
  const [curCardBrand, setCurCardBrand] = useState('');
  const [curInstallments, setCurInstallments] = useState(1);
  const [curCardFeePercent, setCurCardFeePercent] = useState(0);
  const [pixCopied, setPixCopied] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [cashReceived, setCashReceived] = useState(0);
  const [cashChange, setCashChange] = useState(0);

  // Store credit state
  const [creditSearch, setCreditSearch] = useState('');
  const [creditSearching, setCreditSearching] = useState(false);
  const [availableCredits, setAvailableCredits] = useState<any[]>([]);
  const [selectedCredit, setSelectedCredit] = useState<any>(null);

  // Crediário state
  const [curCrediarioInstallments, setCurCrediarioInstallments] = useState(1);
  const [curCrediarioFirstDate, setCurCrediarioFirstDate] = useState('');
  const [customerUsedCredit, setCustomerUsedCredit] = useState(0);

  // Cash register state
  const registerContextKey = currentAccount?.id && currentStore?.id ? `${currentAccount.id}:${currentStore.id}` : null;
  const registerStorageKey = currentStore ? `pdv_cash_register_${currentStore.id}` : null;

  const loadPersistedRegister = () => {
    if (!registerStorageKey) return undefined;
    try {
      const raw = sessionStorage.getItem(registerStorageKey);
      return raw ? JSON.parse(raw) : undefined;
    } catch {
      return undefined;
    }
  };

  const [cashRegister, setCashRegister] = useState<any>(null);
  const [showOpenRegister, setShowOpenRegister] = useState(false);
  const [showCloseRegister, setShowCloseRegister] = useState(false);
  const [openingAmount, setOpeningAmount] = useState('');
  const [closingAmount, setClosingAmount] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [loadingRegister, setLoadingRegister] = useState(true);
  const [hasResolvedRegister, setHasResolvedRegister] = useState(false);

  // Barcode scanning - detect rapid input
  const [barcodeBuffer, setBarcodeBuffer] = useState('');
  const barcodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastResolvedRegisterKeyRef = useRef<string | null>(null);

  const selectedCustomerObj = customers.find(c => c.id === selectedCustomer);
  const pixKey = currentStore?.pix_key;
  const subtotal = cart.reduce((sum, item) => sum + item.qty * item.unit_price, 0);
  const total = Math.max(0, subtotal - discount + assemblyFee);
  const totalPaid = paymentEntries.reduce((s, e) => s + e.amount, 0);
  const remaining = Math.max(0, total - totalPaid);

  // Crediário computed values
  const canUseCrediario = selectedCustomerObj?.credit_authorized === true;
  const creditLimit = selectedCustomerObj?.credit_limit || 0;
  const creditAvailable = creditLimit - customerUsedCredit;

  // Load customer used credit
  const loadCustomerUsedCredit = useCallback(async (customerId: string) => {
    if (!currentAccount?.id) return;
    const { data } = await (supabase as any).rpc('get_customer_used_credit', { _customer_id: customerId, _account_id: currentAccount.id });
    setCustomerUsedCredit(Number(data) || 0);
  }, [currentAccount?.id]);

  useEffect(() => {
    if (selectedCustomer) loadCustomerUsedCredit(selectedCustomer);
    else setCustomerUsedCredit(0);
  }, [selectedCustomer, loadCustomerUsedCredit]);

  const fc = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  // Ecommerce order notifications
  const [ecommerceAlert, setEcommerceAlert] = useState<{ sale_number: number; total: number; customer: string } | null>(null);
  const [saleNotes, setSaleNotes] = useState(() => loadPersistedCart().notes);
  const [isJpOrigin, setIsJpOrigin] = useState(false);
  const showJpToggle = isMirandaEFarias(currentStore?.name);
  const buildNotesForSave = () => {
    const clean = saleNotes.trim();
    if (showJpToggle && isJpOrigin) return setJpOrigin(clean, true);
    return clean || null;
  };
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastSaleId, setLastSaleId] = useState<string | null>(null);
  const [printingReceipt, setPrintingReceipt] = useState(false);
  const [printingFiscal, setPrintingFiscal] = useState(false);

  // PIN authorization state
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinAction, setPinAction] = useState<{ type: string; payload?: any } | null>(null);
  const [editingPriceIdx, setEditingPriceIdx] = useState<number | null>(null);
  const [tempPrice, setTempPrice] = useState('');

  // Presentation picker state
  const [presentationPickerProduct, setPresentationPickerProduct] = useState<Product | null>(null);
  const [presentationOptions, setPresentationOptions] = useState<any[]>([]);
  const [loadingPresentations, setLoadingPresentations] = useState(false);

  // Held (parked) sales – persisted in DB
  const [heldSales, setHeldSales] = useState<{ id: string; cart: CartItem[]; customer: string | null; customerName: string; notes: string; heldAt: string }[]>([]);
  const [showHeldSalesModal, setShowHeldSalesModal] = useState(false);
  const [showOperations, setShowOperations] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const autoPrintReceipt = (currentStore as any)?.pdv_auto_print_receipt || false;
  const autoPrintFiscal = (currentStore as any)?.pdv_auto_print_fiscal || false;
  const receiptFormat = (currentStore as any)?.pdv_receipt_format || 'thermal';

  // Load held sales from DB
  const loadHeldSales = useCallback(async () => {
    if (!currentStore?.id || !user?.id) return;
    const { data } = await supabase
      .from('held_sales')
      .select('*')
      .eq('store_id', currentStore.id)
      .eq('seller_id', user.id)
      .order('created_at', { ascending: true });
    if (data) {
      setHeldSales(data.map((h: any) => ({
        id: h.id,
        cart: (h.cart_json as any) || [],
        customer: h.customer_id,
        customerName: h.customer_name || '',
        notes: h.notes || '',
        heldAt: h.created_at,
      })));
    }
  }, [currentStore?.id, user?.id]);

  useEffect(() => { loadHeldSales(); }, [loadHeldSales]);

  const holdCurrentSale = async () => {
    if (cart.length === 0) { toast({ variant: 'destructive', title: 'Carrinho vazio' }); return; }
    if (!currentAccount?.id || !currentStore?.id || !user?.id) return;
    const customerName = quickCustomerName.trim() || (selectedCustomer ? (customers.find(c => c.id === selectedCustomer)?.name || '') : '');
    const { error } = await (supabase as any).from('held_sales').insert({
      account_id: currentAccount.id,
      store_id: currentStore.id,
      seller_id: user.id,
      cart_json: cart as any,
      customer_id: selectedCustomer || null,
      customer_name: customerName,
      notes: saleNotes,
    });
    if (error) { toast({ variant: 'destructive', title: 'Erro ao guardar venda', description: error.message }); return; }
    await loadHeldSales();
    setCart([]); setSelectedCustomer(null); setQuickCustomerName(''); setSaleNotes(''); setIsJpOrigin(false); clearPersistedCart();
    toast({ title: 'Venda em espera', description: `${cart.reduce((s, i) => s + i.qty, 0)} itens guardados` });
    setTimeout(() => barcodeRef.current?.focus(), 100);
  };

  const resumeHeldSale = async (heldId: string) => {
    const held = heldSales.find(h => h.id === heldId);
    if (!held || !currentAccount?.id || !currentStore?.id || !user?.id) return;
    // If current cart has items, save it as a new held sale first
    if (cart.length > 0) {
      const swapName = quickCustomerName.trim() || (selectedCustomer ? (customers.find(c => c.id === selectedCustomer)?.name || '') : '');
      await (supabase as any).from('held_sales').insert({
        account_id: currentAccount.id,
        store_id: currentStore.id,
        seller_id: user.id,
        cart_json: cart as any,
        customer_id: selectedCustomer || null,
        customer_name: swapName,
        notes: saleNotes,
      });
    }
    // Delete the resumed held sale from DB
    await supabase.from('held_sales').delete().eq('id', heldId);
    await loadHeldSales();
    setCart(held.cart); setSelectedCustomer(held.customer); setSaleNotes(held.notes);
    if (!held.customer && held.customerName) setQuickCustomerName(held.customerName); else setQuickCustomerName('');
    setShowHeldSalesModal(false);
    toast({ title: 'Venda retomada' });
    setTimeout(() => barcodeRef.current?.focus(), 100);
  };

  const removeHeldSale = (heldId: string) => {
    requestPinAuth('remove_held_sale', heldId);
  };

  useEffect(() => {
    if (!cartStorageKey) return;
    if (cart.length === 0 && !selectedCustomer && !saleNotes) {
      sessionStorage.removeItem(cartStorageKey);
    } else {
      sessionStorage.setItem(cartStorageKey, JSON.stringify({ cart, customer: selectedCustomer, notes: saleNotes }));
    }
  }, [cart, selectedCustomer, saleNotes, cartStorageKey]);

  // Persist last known cash register state to avoid visible reloads
  useEffect(() => {
    if (!registerStorageKey || !hasResolvedRegister) return;
    sessionStorage.setItem(registerStorageKey, JSON.stringify(cashRegister));
  }, [cashRegister, registerStorageKey, hasResolvedRegister]);

  const clearPersistedCart = () => {
    if (cartStorageKey) sessionStorage.removeItem(cartStorageKey);
  };

  useEffect(() => {
    barcodeRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!registerContextKey) return;

    const persistedRegister = loadPersistedRegister();
    const hasCachedRegister = persistedRegister !== undefined;

    if (hasCachedRegister) {
      setCashRegister(persistedRegister);
      setLoadingRegister(false);
      setHasResolvedRegister(true);
      lastResolvedRegisterKeyRef.current = registerContextKey;
    } else {
      setCashRegister(null);
      setLoadingRegister(true);
      setHasResolvedRegister(false);
    }

    void loadCashRegister({ silent: hasCachedRegister });
  }, [registerContextKey]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // F-keys always work regardless of focus (critical for POS with barcode scanner focused)
      switch (e.key) {
        case 'F1': e.preventDefault(); barcodeRef.current?.focus(); break;
        case 'F2': e.preventDefault(); setSearchQuery(''); setShowSearchModal(true); break;
        case 'F3': e.preventDefault(); openPaymentModal(); break;
        case 'F4': e.preventDefault(); if (cart.length > 0) clearCart(); break;
        case 'F5': e.preventDefault(); break; // prevent browser refresh
        case 'F6': e.preventDefault(); setShowNotesModal(true); break;
        case 'F7': e.preventDefault(); holdCurrentSale(); break;
        case 'F8': e.preventDefault(); setShowCloseRegister(true); break;
        case 'F9': e.preventDefault(); setShowHeldSalesModal(true); break;
        case 'Escape':
          if (showPaymentModal) { e.preventDefault(); setShowPaymentModal(false); }
          else if (showSearchModal) { e.preventDefault(); setShowSearchModal(false); }
          else if (showNotesModal) { e.preventDefault(); setShowNotesModal(false); }
          break;
      }
    };
    window.addEventListener('keydown', handler, true); // capture phase for priority
    return () => window.removeEventListener('keydown', handler, true);
  }, [showPaymentModal, showSearchModal, showNotesModal, cart.length]);

  // Realtime subscription for ecommerce orders
  useEffect(() => {
    if (!currentStore) return;
    const channel = supabase
      .channel('ecommerce-orders')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'sales',
        filter: `store_id=eq.${currentStore.id}`,
      }, async (payload: any) => {
        const sale = payload.new;
        if (sale.source !== 'ecommerce') return;
        // Get customer name
        let customerName = 'Cliente online';
        if (sale.customer_id) {
          const { data: cust } = await supabase.from('customers').select('name').eq('id', sale.customer_id).maybeSingle();
          if (cust) customerName = cust.name;
        }
        setEcommerceAlert({ sale_number: sale.sale_number, total: sale.total, customer: customerName });
        toast({ title: '🛒 Novo pedido online!', description: `Pedido #${sale.sale_number} - ${customerName}` });
        // Notification stays until admin manually dismisses it
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentStore]);

  const loadCashRegister = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!currentStore || !currentAccount || !registerContextKey) return;
    if (!silent && lastResolvedRegisterKeyRef.current !== registerContextKey) {
      setLoadingRegister(true);
    }

    try {
      const { data, error } = await supabase
        .from('cash_registers')
        .select('*')
        .eq('store_id', currentStore.id)
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      setCashRegister(data ?? null);
      setHasResolvedRegister(true);
      lastResolvedRegisterKeyRef.current = registerContextKey;
    } catch (error) {
      console.error('Error loading cash register:', error);
    } finally {
      setLoadingRegister(false);
    }
  };

  const openCashRegister = async () => {
    if (!currentStore || !currentAccount || !user) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.from('cash_registers').insert({
        store_id: currentStore.id,
        account_id: currentAccount.id,
        opened_by: user.id,
        opening_amount: Number(openingAmount) || 0,
      }).select().single();
      if (error) throw error;
      setCashRegister(data);
      setShowOpenRegister(false);
      setOpeningAmount('');
      toast({ title: 'Caixa aberto!' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally { setSaving(false); }
  };

  const closeCashRegister = async () => {
    if (!cashRegister || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('cash_registers').update({
        status: 'closed',
        closed_by: user.id,
        closed_at: new Date().toISOString(),
        closing_amount: Number(closingAmount) || 0,
        notes: closingNotes || null,
      }).eq('id', cashRegister.id);
      if (error) throw error;
      setCashRegister(null);
      setShowCloseRegister(false);
      setClosingAmount('');
      setClosingNotes('');
      toast({ title: 'Caixa fechado!' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally { setSaving(false); }
  };

  // Handle barcode/SKU input - when user types or scans
  const handleBarcodeSubmit = useCallback(async (code: string) => {
    if (!code.trim() || !currentAccount) return;
    const term = code.trim();

    // OFFLINE PATH: search cached products
    if (!isOnline) {
      try {
        const cached = await searchOfflineProducts(term);
        if (cached.length > 0) {
          const p = cached[0];
          addToCart({
            ...p,
            cost_default: p.cost_default ?? 0,
            description: null, brand: null, weight: null, weight_unit: 'g',
            category: null, supplier_id: null, ncm: null, cest: null,
            cfop_default: null, origem_icms: '0', cst_icms: null, csosn: null,
            aliq_icms: 0, aliq_pis: 0, aliq_cofins: 0, aliq_ipi: 0,
            cst_pis: null, cst_cofins: null, cst_ipi: null, variant_options: null,
            promo_price: null, promo_starts_at: null, promo_ends_at: null,
            product_group: null, created_at: '',
          } as Product);
          setBarcodeBuffer('');
        } else if (cached.length === 0) {
          setSearchQuery(term);
          setShowSearchModal(true);
        }
      } catch {
        toast({ variant: 'destructive', title: 'Erro na busca offline' });
      }
      return;
    }

    // 1. Check presentation GTINs first (fractioning)
    const { data: presMatch } = await supabase
      .from('product_presentations')
      .select('*, products!inner(*)')
      .eq('is_active', true)
      .eq('is_sale', true)
      .eq('gtin', term)
      .limit(1);

    if (presMatch && presMatch.length > 0) {
      const pres = presMatch[0] as any;
      const product = pres.products as Product;
      const baseQty = Number(pres.conversion_factor) || 1;
      const price = pres.price != null ? Number(pres.price) : product.price_default * baseQty;
      addToCart({
        ...product,
        name: `${product.name} (${pres.name})`,
        price_default: price,
      } as Product, undefined, {
        presentation_id: pres.id,
        presentation_name: pres.name,
        conversion_factor: baseQty,
      });
      setBarcodeBuffer('');
      return;
    }

    // 2. Search by exact SKU or GTIN
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('account_id', currentAccount.id)
      .eq('is_active', true)
      .or(`sku.eq.${term},gtin.eq.${term}`)
      .limit(1);

    if (data && data.length > 0) {
      smartAddToCart(data[0] as Product);
      setBarcodeBuffer('');
      return;
    }

    // 3. Check variant GTINs/SKUs
    const { data: variantMatch } = await supabase
      .from('product_variants')
      .select('*, products!inner(*)')
      .eq('is_active', true)
      .or(`sku.eq.${term},gtin.eq.${term}`)
      .limit(1);

    if (variantMatch && variantMatch.length > 0) {
      const v = variantMatch[0] as any;
      const product = v.products as Product;
      const attrLabel = Object.values(v.attributes || {}).filter(Boolean).join(' / ');
      addToCart({
        ...product,
        id: product.id,
        name: `${product.name} (${attrLabel})`,
        price_default: v.price,
        cost_default: v.cost,
        sku: v.sku || product.sku,
        gtin: v.gtin || product.gtin,
      } as Product, v.id);
      setBarcodeBuffer('');
      return;
    }

    // 4. If not found by exact match, try ilike
    const likeTerm = term.includes('%') ? term : `%${term}%`;
    const { data: fuzzy } = await supabase
      .from('products')
      .select('*')
      .eq('account_id', currentAccount.id)
      .eq('is_active', true)
      .or(`name.ilike.${likeTerm},sku.ilike.${likeTerm},gtin.ilike.${likeTerm}`)
      .limit(1);

    if (fuzzy && fuzzy.length === 1) {
      smartAddToCart(fuzzy[0] as Product);
      setBarcodeBuffer('');
    } else {
      toast({ variant: 'destructive', title: 'Produto não encontrado', description: `Código: ${term}` });
    }
  }, [currentAccount, isOnline, searchOfflineProducts]);

  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleBarcodeSubmit(barcodeBuffer);
    }
  };

  const addToCart = (product: Product, variantId?: string, presInfo?: { presentation_id: string; presentation_name: string; conversion_factor: number }) => {
    setCart(prev => {
      const key = presInfo?.presentation_id || variantId || product.id;
      const existing = prev.find(i => (i.presentation_id || i.variant_id || i.product.id) === key);
      if (existing) {
        const newQty = existing.qty + 1;
        // Apply tier price only for non-variant/non-presentation items
        const tier = !variantId && !presInfo ? getTierPrice(product.id, newQty) : null;
        return prev.map(i => (i.presentation_id || i.variant_id || i.product.id) === key
          ? { ...i, qty: newQty, unit_price: tier ? tier.price : i.unit_price }
          : i
        );
      }
      return [...prev, {
        product,
        qty: 1,
        unit_price: product.price_default,
        variant_id: variantId,
        presentation_id: presInfo?.presentation_id,
        presentation_name: presInfo?.presentation_name,
        conversion_factor: presInfo?.conversion_factor,
      }];
    });
  };

  /**
   * Smart add: checks if product has sale presentations before adding.
   * If it does, shows a picker dialog. Otherwise adds directly.
   */
  const smartAddToCart = async (product: Product) => {
    if (!isOnline) {
      // Offline: add base unit directly (no presentation lookup)
      addToCart(product);
      return;
    }
    setLoadingPresentations(true);
    const { data: presentations } = await supabase
      .from('product_presentations')
      .select('*')
      .eq('product_id', product.id)
      .eq('is_active', true)
      .eq('is_sale', true)
      .order('conversion_factor', { ascending: true });

    if (presentations && presentations.length > 0) {
      setPresentationPickerProduct(product);
      setPresentationOptions(presentations);
      setLoadingPresentations(false);
    } else {
      setLoadingPresentations(false);
      addToCart(product);
    }
  };

  const handlePickPresentation = (product: Product, pres: any | null) => {
    if (!pres) {
      // Base unit selected
      addToCart(product);
    } else {
      const baseQty = Number(pres.conversion_factor) || 1;
      const price = pres.price != null ? Number(pres.price) : product.price_default * baseQty;
      addToCart({
        ...product,
        name: `${product.name} (${pres.name})`,
        price_default: price,
      } as Product, undefined, {
        presentation_id: pres.id,
        presentation_name: pres.name,
        conversion_factor: baseQty,
      });
    }
    setPresentationPickerProduct(null);
    setPresentationOptions([]);
  };

  const updateQty = (productId: string, delta: number) => {
    if (delta < 0) {
      const item = cart.find(i => i.product.id === productId);
      if (item && item.qty + delta <= 0) {
        requestPinAuth('remove_item', productId);
        return;
      }
      // Any decrease requires PIN
      requestPinAuth('decrease_qty', productId);
      return;
    }
    setCart(prev => prev.map(i => {
      if (i.product.id !== productId) return i;
      const newQty = i.qty + delta;
      const tier = !i.variant_id && !i.presentation_id ? getTierPrice(productId, newQty) : null;
      return { ...i, qty: newQty, unit_price: tier ? tier.price : i.product.price_default };
    }));
  };

  const requestPinAuth = (type: string, payload?: any) => {
    setPinAction({ type, payload });
    setPinModalOpen(true);
  };

  const handlePinAuthorized = () => {
    if (!pinAction) return;
    switch (pinAction.type) {
      case 'remove_item':
        setCart(prev => prev.filter(i => i.product.id !== pinAction.payload));
        break;
      case 'decrease_qty':
        setCart(prev => prev.map(i => {
          if (i.product.id !== pinAction.payload) return i;
          const newQty = Math.max(1, i.qty - 1);
          const tier = !i.variant_id && !i.presentation_id ? getTierPrice(i.product.id, newQty) : null;
          return { ...i, qty: newQty, unit_price: tier ? tier.price : i.product.price_default };
        }));
        break;
      case 'set_qty':
        setCart(prev => prev.map(i => {
          if (i.product.id !== pinAction.payload.productId) return i;
          const newQty = pinAction.payload.qty;
          const tier = !i.variant_id && !i.presentation_id ? getTierPrice(i.product.id, newQty) : null;
          return { ...i, qty: newQty, unit_price: tier ? tier.price : i.product.price_default };
        }));
        break;
      case 'clear_cart':
        setCart([]); setSelectedCustomer(null); setQuickCustomerName(''); setPaymentEntries([]); setSaleNotes(''); setIsJpOrigin(false); setDiscount(0); setAssemblyFee(0); setCouponApplied(null); setCouponCode(''); clearPersistedCart();
        break;
      case 'edit_price':
        setEditingPriceIdx(pinAction.payload);
        break;
      case 'apply_discount':
        setShowDiscountInput(true);
        break;
      case 'remove_held_sale':
        supabase.from('held_sales').delete().eq('id', pinAction.payload).then(() => loadHeldSales());
        break;
    }
    setPinAction(null);
  };

  const removeFromCart = (productId: string) => requestPinAuth('remove_item', productId);
  const clearCart = () => requestPinAuth('clear_cart');

  // Lojas Miranda: vendedores podem alterar preço sem PIN.
  const sellerCanEditPriceHere = isMirandaGroupStore(currentStore?.name);

  const handlePriceClick = (idx: number) => {
    setTempPrice(String(cart[idx].unit_price));
    if (sellerCanEditPriceHere) {
      setEditingPriceIdx(idx);
      return;
    }
    requestPinAuth('edit_price', idx);
  };

  const confirmPriceEdit = () => {
    if (editingPriceIdx === null) return;
    const newPrice = Number(tempPrice);
    if (isNaN(newPrice) || newPrice < 0) return;
    setCart(prev => prev.map((item, i) => i === editingPriceIdx ? { ...item, unit_price: newPrice } : item));
    setEditingPriceIdx(null);
    setTempPrice('');
  };

  const openPaymentModal = () => {
    if (cart.length === 0) { toast({ variant: 'destructive', title: 'Carrinho vazio' }); return; }
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
    setCurAmount(total);
    setCurMethod('cash');
    setCashReceived(0);
    setCashChange(0);
    setSelectedCredit(null);
    setAvailableCredits([]);
    setCreditSearch('');
    setShowPaymentModal(true);
  };

  const searchStoreCredits = async (q: string) => {
    if (!currentAccount || !currentStore || !q.trim()) {
      setAvailableCredits([]);
      return;
    }
    setCreditSearching(true);
    try {
      const term = q.trim().toLowerCase();
      // Search by manual name
      const { data: manualResults } = await (supabase as any)
        .from('store_credits')
        .select('*, customers(name)')
        .eq('account_id', currentAccount.id)
        .eq('store_id', currentStore.id)
        .eq('status', 'active')
        .gt('remaining_amount', 0)
        .ilike('customer_name_manual', `%${term}%`);

      // Search by registered customer name
      const { data: customerResults } = await (supabase as any)
        .from('store_credits')
        .select('*, customers!inner(name)')
        .eq('account_id', currentAccount.id)
        .eq('store_id', currentStore.id)
        .eq('status', 'active')
        .gt('remaining_amount', 0)
        .ilike('customers.name', `%${term}%`);

      // Search by credit ID (short prefix)
      let idResults: any[] = [];
      if (term.length >= 4) {
        const { data: byId } = await (supabase as any)
          .from('store_credits')
          .select('*, customers(name)')
          .eq('account_id', currentAccount.id)
          .eq('store_id', currentStore.id)
          .eq('status', 'active')
          .gt('remaining_amount', 0)
          .ilike('id', `${term}%`);
        idResults = byId || [];
      }

      // Merge and deduplicate
      const allResults = [...(manualResults || []), ...(customerResults || []), ...idResults];
      const seen = new Set<string>();
      const unique = allResults.filter((c: any) => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });
      setAvailableCredits(unique);
    } catch {
      setAvailableCredits([]);
    } finally {
      setCreditSearching(false);
    }
  };

  const addPaymentEntry = () => {
    if (curMethod === 'store_credit') {
      if (!selectedCredit) { toast({ variant: 'destructive', title: 'Selecione um crédito' }); return; }
      const creditAmount = Math.min(selectedCredit.remaining_amount, remaining);
      if (creditAmount <= 0) return;
      const entry: PaymentEntry = {
        id: crypto.randomUUID(),
        method: 'store_credit',
        amount: creditAmount,
        installments: 1,
        cardFeePercent: 0,
        storeCreditId: selectedCredit.id,
        storeCreditName: selectedCredit.customers?.name || selectedCredit.customer_name_manual || 'Crédito',
      };
      setPaymentEntries(prev => [...prev, entry]);
      const newRemaining = remaining - creditAmount;
      setCurAmount(Math.max(0, Math.round(newRemaining * 100) / 100));
      setSelectedCredit(null);
      setAvailableCredits([]);
      setCreditSearch('');
      return;
    }
    if (curMethod === 'cash') {
      // For cash: use cashReceived to calculate change
      const received = cashReceived > 0 ? cashReceived : curAmount;
      const actualAmount = Math.min(curAmount, remaining);
      if (actualAmount <= 0) { toast({ variant: 'destructive', title: 'Informe o valor' }); return; }
      const change = Math.max(0, Math.round((received - actualAmount) * 100) / 100);
      const entry: PaymentEntry = {
        id: crypto.randomUUID(),
        method: 'cash',
        amount: actualAmount,
        installments: 1,
        cardFeePercent: 0,
      };
      setPaymentEntries(prev => [...prev, entry]);
      setCashChange(change);
      const newRemaining = remaining - actualAmount;
      setCurAmount(Math.max(0, Math.round(newRemaining * 100) / 100));
      setCashReceived(0);
      return;
    }
    if (curMethod === 'crediario') {
      if (!canUseCrediario) { toast({ variant: 'destructive', title: 'Cliente sem crediário autorizado' }); return; }
      if (!curCrediarioFirstDate) { toast({ variant: 'destructive', title: 'Informe a data do 1º pagamento' }); return; }
      if (curAmount <= 0) { toast({ variant: 'destructive', title: 'Informe o valor' }); return; }
      if (curAmount > creditAvailable) { toast({ variant: 'destructive', title: `Limite insuficiente. Disponível: ${fc(creditAvailable)}` }); return; }
      const entry: PaymentEntry = {
        id: crypto.randomUUID(),
        method: 'crediario',
        amount: curAmount,
        installments: curCrediarioInstallments,
        cardFeePercent: 0,
        crediarioFirstDate: curCrediarioFirstDate,
      };
      setPaymentEntries(prev => [...prev, entry]);
      const newRemaining = remaining - curAmount;
      setCurAmount(Math.max(0, Math.round(newRemaining * 100) / 100));
      setCurCrediarioInstallments(1);
      setCurCrediarioFirstDate('');
      return;
    }
    if (curAmount <= 0) { toast({ variant: 'destructive', title: 'Informe o valor' }); return; }
    const hideCardDetailsPdv = isModuleDisabled(currentAccount?.id, 'hide_card_details_pdv');
    if (curMethod === 'card' && !curCardBrand && !hideCardDetailsPdv) { toast({ variant: 'destructive', title: 'Selecione a bandeira' }); return; }
    const entry: PaymentEntry = {
      id: crypto.randomUUID(),
      method: curMethod,
      amount: curAmount,
      cardType: curMethod === 'card' ? curCardType : undefined,
      cardBrand: curMethod === 'card' ? curCardBrand : undefined,
      installments: curMethod === 'card' && curCardType === 'credit' ? curInstallments : 1,
      cardFeePercent: curMethod === 'card' ? curCardFeePercent : 0,
    };
    setPaymentEntries(prev => [...prev, entry]);
    const newRemaining = remaining - curAmount;
    setCurAmount(Math.max(0, Math.round(newRemaining * 100) / 100));
    setCurCardBrand('');
    setCurInstallments(1);
    setCurCardFeePercent(0);
    setCashChange(0);
  };

  const removePaymentEntry = (id: string) => setPaymentEntries(prev => prev.filter(e => e.id !== id));

  const copyPixKey = async () => {
    if (!pixKey) return;
    const payload = generatePixPayload({ pixKey, merchantName: currentStore?.name || 'Loja', amount: curAmount > 0 ? curAmount : undefined });
    await navigator.clipboard.writeText(payload);
    setPixCopied(true);
    setTimeout(() => setPixCopied(false), 2000);
  };

  const finalizeSale = async () => {
    if (cart.length === 0 || paymentEntries.length === 0) return;

    // ✋ Bloqueia se houver pagamento em CARTÃO sem taxa preenchida ou com taxa = 0
    const cardWithoutFee = paymentEntries.find(e => e.method === 'card' && (e.cardFeePercent === undefined || e.cardFeePercent === null || Number.isNaN(e.cardFeePercent as any) || Number(e.cardFeePercent) <= 0));
    if (cardWithoutFee) {
      toast({ variant: 'destructive', title: 'Taxa do cartão obrigatória', description: 'Informe a taxa (%) do cartão antes de finalizar. A taxa não pode ser 0.' });
      return;
    }

    const totalPaidNow = paymentEntries.reduce((s, e) => s + e.amount, 0);
    if (Math.abs(totalPaidNow - total) > 0.01) { toast({ variant: 'destructive', title: 'Valor não confere' }); return; }
    if (!currentAccount || !currentStore || !user) return;

    // === OFFLINE MODE ===
    if (!isOnline) {
      setSaving(true);
      try {
        const offlineItems = cart.map(item => {
          const baseQty = item.conversion_factor ? item.qty * item.conversion_factor : item.qty;
          return {
            product_id: item.product.id,
            product_name: item.product.name,
            sku: item.product.sku || null,
            qty: item.qty,
            unit_price: item.unit_price,
            unit_cost: item.product.cost_default,
            total_line: Math.round(item.qty * item.unit_price * 100) / 100,
            variant_id: item.variant_id || null,
            presentation_id: item.presentation_id || null,
            presentation_name: item.presentation_name || null,
            conversion_factor: item.conversion_factor || null,
            sold_qty: item.conversion_factor ? item.qty : null,
            base_qty: item.conversion_factor ? baseQty : null,
          };
        });
        const offlinePayments = paymentEntries.map(e => ({
          method: e.method,
          amount: e.amount,
          card_type: e.cardType || null,
          card_brand: e.cardBrand || null,
          installments: e.installments,
          card_fee_percent: e.cardFeePercent,
        }));

        const customerName = quickCustomerName.trim() || (selectedCustomer ? (customers.find(c => c.id === selectedCustomer)?.name || null) : null);

        await createOfflineSale({
          customerId: selectedCustomer,
          customerName,
          discount,
          deliveryFee: 0,
          assemblyFee,
          subtotal,
          total,
          notes: buildNotesForSave(),
          items: offlineItems,
          payments: offlinePayments,
        });

        toast({
          title: '✅ Venda salva offline!',
          description: 'Será sincronizada quando a conexão voltar.',
        });

        clearPersistedCart();
        setCart([]); setSelectedCustomer(null); setQuickCustomerName(''); setPaymentEntries([]); setSaleNotes(''); setIsJpOrigin(false); setDiscount(0); setAssemblyFee(0); setCouponApplied(null); setCouponCode('');
        setShowPaymentModal(false);
        setBarcodeBuffer('');
        setTimeout(() => barcodeRef.current?.focus(), 100);
      } catch (e: any) {
        toast({ variant: 'destructive', title: 'Erro ao salvar offline', description: e.message });
      } finally { setSaving(false); }
      return;
    }
    // === END OFFLINE MODE ===

    setSaving(true);
    try {
      // Quick register customer if name typed but no customer selected
      let finalCustomerId = selectedCustomer;
      if (!finalCustomerId && quickCustomerName.trim()) {
        const { data: newCustomer, error: custErr } = await supabase.from('customers').insert({
          account_id: currentAccount.id,
          name: quickCustomerName.trim(),
        }).select('id').single();
        if (custErr) throw custErr;
        finalCustomerId = newCustomer.id;
        // Refresh customer list so the new customer appears for future searches
        refreshCustomers();
      }

      const { data: sale, error } = await (supabase as any).from('sales').insert({
        account_id: currentAccount.id, store_id: currentStore.id, seller_id: user.id,
        customer_id: finalCustomerId || null, status: 'open', discount, delivery_fee: 0, assembly_fee: assemblyFee, subtotal, total, notes: buildNotesForSave(),
      }).select().single();
      if (error) throw error;

      const items = cart.map(item => {
        const baseQty = item.conversion_factor ? item.qty * item.conversion_factor : item.qty;
        if (item.conversion_factor) {
          // Presentation sale: total_line is authoritative (what customer pays)
          const customerTotal = Math.round(item.qty * item.unit_price * 100) / 100;
          // Use 4 decimal places for unit price to minimize rounding error
          const unitPricePerBase = Math.round((customerTotal / baseQty) * 10000) / 10000;
          // Recalculate total from rounded unit price
          const recalcTotal = Math.round(unitPricePerBase * baseQty * 100) / 100;
          // If there's a centavo difference, adjust total_line to match unit_price × qty (SEFAZ rule)
          const finalTotal = recalcTotal;
          return {
            sale_id: sale.id, product_id: item.product.id, qty: baseQty,
            unit_price: unitPricePerBase, unit_cost: item.product.cost_default, total_line: finalTotal,
            variant_id: item.variant_id || null,
            presentation_id: item.presentation_id || null,
            presentation_name: item.presentation_name || null,
            sold_qty: item.qty,
            base_qty: baseQty,
          };
        }
        return {
          sale_id: sale.id, product_id: item.product.id, qty: baseQty,
          unit_price: item.unit_price, unit_cost: item.product.cost_default,
          total_line: Math.round(item.qty * item.unit_price * 100) / 100,
          variant_id: item.variant_id || null,
          presentation_id: null, presentation_name: null, sold_qty: null, base_qty: null,
        };
      });
      await (supabase as any).from('sale_items').insert(items);

      // Skip crediário entries — they are represented by parcels in accounts_receivable
      // and only generate payment rows when each installment is actually received.
      for (const entry of paymentEntries) {
        if (entry.method === 'crediario') continue;
        const feeValue = entry.cardFeePercent > 0 ? Math.round(entry.amount * entry.cardFeePercent / 100 * 100) / 100 : 0;
        await supabase.from('payments').insert({
          sale_id: sale.id,
          method: entry.method as any,
          card_type: entry.method === 'card' ? (entry.cardType || null) : null,
          brand: entry.method === 'card' ? (entry.cardBrand || null) : null,
          installments: entry.installments,
          card_fee_percent: entry.cardFeePercent || 0,
          card_fee_value: feeValue,
          paid_value: entry.amount,
        });
      }

      // Consume store credits
      for (const entry of paymentEntries.filter(e => e.method === 'store_credit' && e.storeCreditId)) {
        const { data: creditData } = await (supabase as any)
          .from('store_credits')
          .select('remaining_amount')
          .eq('id', entry.storeCreditId)
          .single();
        if (creditData) {
          const newRemaining = Math.max(0, Math.round((creditData.remaining_amount - entry.amount) * 100) / 100);
          await (supabase as any)
            .from('store_credits')
            .update({
              remaining_amount: newRemaining,
              status: newRemaining <= 0 ? 'used' : 'active',
              used_at: newRemaining <= 0 ? new Date().toISOString() : null,
              used_in_sale_id: sale.id,
            })
            .eq('id', entry.storeCreditId);
        }
      }

      // Generate crediário receivables
      const crediarioEntries = paymentEntries.filter(e => e.method === 'crediario');
      for (const entry of crediarioEntries) {
        if (!finalCustomerId || !entry.crediarioFirstDate) continue;
        const numInstallments = entry.installments || 1;
        const parcelValue = Math.round((entry.amount / numInstallments) * 100) / 100;
        const parcels = [];
        for (let i = 0; i < numInstallments; i++) {
          const dueDate = addMonths(new Date(entry.crediarioFirstDate), i);
          parcels.push({
            account_id: currentAccount.id,
            store_id: currentStore.id,
            sale_id: sale.id,
            customer_id: finalCustomerId,
            description: `Crediário - Parcela ${i + 1}/${numInstallments}`,
            category: 'crediário',
            amount: i === numInstallments - 1 ? Math.round((entry.amount - parcelValue * (numInstallments - 1)) * 100) / 100 : parcelValue,
            due_date: format(dueDate, 'yyyy-MM-dd'),
            status: 'open',
            installment_number: i + 1,
            total_installments: numInstallments,
          });
        }
        await supabase.from('accounts_receivable').insert(parcels);
      }

      const finalStatus = crediarioEntries.length > 0 ? 'crediario' : 'paid';
      await supabase.from('sales').update({ status: finalStatus, updated_at: new Date().toISOString() }).eq('id', sale.id);

      await logActivity({
        accountId: currentAccount.id, userId: user.id, userName: user.email,
        action: 'finalize', entityType: 'sale', entityId: sale.id,
        details: { total, payments: paymentEntries.map(e => ({ method: e.method, amount: e.amount })) },
      });

      // Birthday coupon redemption removed (single-tenant cleanup)
      setLastSaleId(sale.id);

      // Auto-print receipt if configured
      if (autoPrintReceipt) {
        try {
          const { data: fullSale } = await supabase
            .from('sales')
            .select('*, customers(*), stores(*), sale_items(*, products(*)), payments(*), deliveries(*)')
            .eq('id', sale.id)
            .single();
          if (fullSale) {
            const pdfType = receiptFormat === 'thermal' ? 'cupom' : 'pedido';
            await printSalePDF({ sale: fullSale as any, type: pdfType as any });
          } else {
            throw new Error('Não foi possível carregar os dados do comprovante desta venda.');
          }
        } catch (printErr) {
          console.error('Auto-print receipt error:', printErr);
          toast({ variant: 'destructive', title: 'Erro ao imprimir comprovante', description: humanizePrintError(printErr instanceof Error ? printErr.message : '', 'receipt') });
        }
      }

      // Auto-emit + print fiscal if configured
      if (autoPrintFiscal) {
        try {
          toast({ title: 'Emitindo NFC-e automaticamente...' });
          const fiscalDoc = await ensureIssuedNfceForSale(sale.id);
          const { blob, contentType } = await downloadFiscalDocumentFile(fiscalDoc.id, 'pdf');
          await printBlobDirectly(blob, `nfce-${fiscalDoc.nfe_number || fiscalDoc.id.substring(0, 8)}.pdf`, contentType);
          toast({ title: 'NFC-e emitida e impressa automaticamente!' });
        } catch (fiscalErr: any) {
          console.error('Auto-fiscal error:', fiscalErr);
          toast({ variant: 'destructive', title: 'Erro na emissão fiscal automática', description: humanizePrintError(fiscalErr.message, 'fiscal') });
        }
      }

      clearPersistedCart();
      setCart([]); setSelectedCustomer(null); setQuickCustomerName(''); setPaymentEntries([]); setSaleNotes(''); setIsJpOrigin(false); setDiscount(0); setAssemblyFee(0); setCouponApplied(null); setCouponCode('');
      setShowPaymentModal(false);
      setShowSuccessModal(true);
      setBarcodeBuffer('');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally { setSaving(false); }
  };

  const handlePrintSale = async (type: 'receipt' | 'fiscal') => {
    if (!lastSaleId) return;
    const setLoading = type === 'receipt' ? setPrintingReceipt : setPrintingFiscal;
    setLoading(true);
    try {
      if (type === 'fiscal') {
        // 1. Emit NFC-e if needed + wait for SEFAZ authorization
        toast({ title: 'Emitindo NFC-e...', description: 'Aguarde a autorização da SEFAZ.' });
        const fiscalDoc = await ensureIssuedNfceForSale(lastSaleId);

        // 2. Download the real DANFE from Focus NFe
        toast({ title: 'Baixando DANFE...', description: 'Preparando impressão do cupom fiscal.' });
        const { blob, contentType } = await downloadFiscalDocumentFile(fiscalDoc.id, 'pdf');

        // 3. Print directly via hidden frame (no popup)
        await printBlobDirectly(blob, `nfce-${fiscalDoc.nfe_number || fiscalDoc.id.substring(0, 8)}.pdf`, contentType);

        toast({ title: 'Cupom fiscal impresso!', description: `NFC-e ${fiscalDoc.nfe_number ? `nº ${fiscalDoc.nfe_number}` : ''} autorizada e impressa.` });
      } else {
        // Receipt (comprovante de compra não fiscal)
        const { data: fullSale } = await supabase
          .from('sales')
          .select('*, customers(*), stores(*), sale_items(*, products(*)), payments(*), deliveries(*)')
          .eq('id', lastSaleId)
          .single();
        if (fullSale) {
          const pdfType = receiptFormat === 'thermal' ? 'cupom' : 'pedido';
          await printSalePDF({ sale: fullSale as any, type: pdfType as any });
          toast({ title: 'Comprovante de compra impresso' });
        } else {
          throw new Error('Não foi possível carregar os dados do comprovante desta venda.');
        }
      }
    } catch (err: any) {
      const friendlyMessage = humanizePrintError(err.message, type);
      toast({ variant: 'destructive', title: type === 'fiscal' ? 'Erro na emissão fiscal' : 'Erro ao imprimir comprovante', description: friendlyMessage });
    } finally { setLoading(false); }
  };

  const closeSuccessModal = () => {
    setShowSuccessModal(false);
    setLastSaleId(null);
    setTimeout(() => barcodeRef.current?.focus(), 100);
  };

  const getPaymentLabel = (method: PaymentMethod, entry?: PaymentEntry) => {
    if (method === 'pix') return 'Pix';
    if (method === 'cash') return 'Dinheiro';
    if (method === 'card') return `Cartão ${entry?.cardType === 'credit' ? 'Crédito' : 'Débito'}${entry?.cardBrand ? ` (${entry.cardBrand})` : ''}`;
    if (method === 'crediario') return 'Crediário';
    if (method === 'financeira') return 'Financeira';
    if (method === 'store_credit') return `Crédito${entry?.storeCreditName ? ` (${entry.storeCreditName})` : ''}`;
    return method;
  };

  if (loadingRegister) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!cashRegister) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <div className="flex items-center gap-3 border-b px-4 py-2 bg-card">
          <Button variant="ghost" size="icon" onClick={() => navigate('/app/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <ShoppingCart className="h-5 w-5 text-primary" />
          <h1 className="font-bold text-lg">PDV Venda Rápida</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-sm">
            <Lock className="mx-auto h-16 w-16 text-muted-foreground/30" />
            <h2 className="text-xl font-bold">Caixa Fechado</h2>
            <p className="text-sm text-muted-foreground">Abra o caixa para iniciar as vendas</p>
            <div className="space-y-2">
              <Label className="text-sm">Valor de abertura (R$)</Label>
              <Input type="number" value={openingAmount} onChange={e => setOpeningAmount(e.target.value)} placeholder="0,00" className="text-center text-lg" />
            </div>
            <Button className="w-full h-12 text-base" onClick={openCashRegister} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Unlock className="mr-2 h-5 w-5" />}
              Abrir Caixa
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Ecommerce order alert */}
      {ecommerceAlert && (
        <div className="bg-emerald-500 text-white px-4 py-3 flex items-center gap-3 animate-in slide-in-from-top">
          <ShoppingCart className="h-5 w-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-bold text-sm">🛒 Novo Pedido Online #{ecommerceAlert.sale_number}</p>
            <p className="text-xs opacity-90">{ecommerceAlert.customer} • {fc(ecommerceAlert.total)}</p>
          </div>
          <button onClick={() => setEcommerceAlert(null)} className="p-1 hover:bg-white/20 rounded"><X className="h-4 w-4" /></button>
        </div>
      )}
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b px-4 py-2 bg-card flex-shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate('/app/dashboard')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <ShoppingCart className="h-5 w-5 text-primary" />
        <h1 className="font-bold text-lg">PDV</h1>
        <Badge variant="outline" className="text-xs">{currentStore?.name}</Badge>
        <Badge className="bg-green-500 text-white text-xs">Caixa Aberto</Badge>
        {heldSales.length > 0 && (
          <Button variant="outline" size="sm" className="text-xs relative" onClick={() => setShowHeldSalesModal(true)}>
            <Clock className="mr-1 h-3 w-3" /> Espera
            <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-orange-500 text-white">{heldSales.length}</Badge>
          </Button>
        )}
        <OfflineIndicator storeId={currentStore?.id} />
        <ContingencyBadge storeId={currentStore?.id} />
        <div className="flex-1" />
        <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowReport(true)}>
          <FileText className="mr-1 h-3 w-3" /> Relatório
        </Button>
        <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowOperations(true)}>
          <Banknote className="mr-1 h-3 w-3" /> Operações
        </Button>
        <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowCloseRegister(true)}>
          <Lock className="mr-1 h-3 w-3" /> Fechar Caixa
        </Button>
        <span className="text-sm text-muted-foreground hidden sm:inline">{user?.email}</span>
      </div>

      {/* Barcode input bar */}
      <div className="flex items-center gap-2 border-b px-4 py-2 bg-muted/30 flex-shrink-0">
        <Barcode className="h-5 w-5 text-muted-foreground" />
        <Input
          ref={barcodeRef}
          placeholder="Bipe o código de barras ou digite o SKU..."
          value={barcodeBuffer}
          onChange={(e) => setBarcodeBuffer(e.target.value)}
          onKeyDown={handleBarcodeKeyDown}
          className="flex-1 text-base h-10"
          autoComplete="off"
        />
        <Button variant="outline" onClick={() => handleBarcodeSubmit(barcodeBuffer)}>
          <Search className="mr-2 h-4 w-4" /> Buscar
        </Button>
        <Button variant="outline" onClick={() => { setSearchQuery(''); setShowSearchModal(true); }}>
          <Search className="mr-2 h-4 w-4" /> Catálogo
        </Button>
      </div>

      {/* Shortcuts bar */}
      <div className="flex items-center gap-1 border-b px-4 py-1 bg-card flex-shrink-0 overflow-x-auto">
        <Keyboard className="h-3.5 w-3.5 text-muted-foreground mr-1 flex-shrink-0" />
        {[
          { key: 'F1', label: 'Código', action: () => barcodeRef.current?.focus() },
          { key: 'F2', label: 'Catálogo', action: () => { setSearchQuery(''); setShowSearchModal(true); } },
          { key: 'F3', label: 'Pagamento', action: () => openPaymentModal() },
          { key: 'F4', label: 'Limpar', action: () => clearCart() },
          { key: 'F6', label: 'Obs.', action: () => setShowNotesModal(true) },
          { key: 'F7', label: 'Aguardar', action: () => holdCurrentSale() },
          { key: 'F8', label: 'Fechar Cx', action: () => setShowCloseRegister(true) },
          ...(heldSales.length > 0 ? [{ key: 'F9', label: `Espera (${heldSales.length})`, action: () => setShowHeldSalesModal(true) }] : []),
        ].map(s => (
          <button
            key={s.key}
            onClick={s.action}
            className="flex items-center gap-1 px-2 py-0.5 text-[10px] rounded border border-border bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition whitespace-nowrap flex-shrink-0"
          >
            <kbd className="font-mono font-bold text-[10px] text-foreground">{s.key}</kbd>
            <span>{s.label}</span>
          </button>
        ))}
        {autoPrintReceipt && (
          <span className="flex items-center gap-1 ml-auto px-2 py-0.5 text-[10px] rounded bg-primary/10 text-primary whitespace-nowrap">
            <Printer className="h-3 w-3" /> Auto-print {receiptFormat === 'thermal' ? 'Térmico' : 'A4'}
          </span>
        )}
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Cart area - takes most space */}
        <div className="flex-1 flex flex-col min-h-0">
          {cart.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <ShoppingCart className="mx-auto h-16 w-16 mb-3 opacity-30" />
                <p className="text-lg">Carrinho vazio</p>
                <p className="text-sm">Bipe um código de barras ou busque um produto</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                  <tr className="border-b">
                    <th className="text-left py-2 px-4 font-medium text-muted-foreground w-10">#</th>
                    <th className="text-left py-2 px-4 font-medium text-muted-foreground">Produto</th>
                    <th className="text-left py-2 px-4 font-medium text-muted-foreground w-24">SKU</th>
                    <th className="text-center py-2 px-4 font-medium text-muted-foreground w-32">Qtd</th>
                    <th className="text-right py-2 px-4 font-medium text-muted-foreground w-28">Unit.</th>
                    <th className="text-right py-2 px-4 font-medium text-muted-foreground w-28">Total</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item, idx) => (
                    <tr key={item.product.id} className="border-b hover:bg-muted/30">
                      <td className="py-2 px-4 text-muted-foreground">{idx + 1}</td>
                      <td className="py-2 px-4 font-medium">{item.product.name}</td>
                      <td className="py-2 px-4 text-muted-foreground text-xs">{item.product.sku || '—'}</td>
                      <td className="py-2 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQty(item.product.id, -1)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Input
                            type="number"
                            value={item.qty}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              if (isNaN(val) || val < 0) return;
                              if (val === 0) { removeFromCart(item.product.id); return; }
                              if (val < item.qty) {
                                requestPinAuth('set_qty', { productId: item.product.id, qty: val });
                              } else {
                                setCart(prev => prev.map(i => {
                                  if (i.product.id !== item.product.id) return i;
                                  const tier = !i.variant_id && !i.presentation_id ? getTierPrice(item.product.id, val) : null;
                                  return { ...i, qty: val, unit_price: tier ? tier.price : i.product.price_default };
                                }));
                              }
                            }}
                            className="w-16 h-7 text-center text-sm font-medium p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            min={1}
                            step={1}
                          />
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQty(item.product.id, 1)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                      <td className="py-2 px-4 text-right">
                        <button onClick={() => handlePriceClick(idx)} className="hover:underline hover:text-primary cursor-pointer" title="Clique para alterar (requer PIN)">
                          {fc(item.unit_price)}
                        </button>
                      </td>
                      <td className="py-2 px-4 text-right font-medium">{fc(item.qty * item.unit_price)}</td>
                      <td className="py-2 px-4">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeFromCart(item.product.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right sidebar - Summary */}
        <div className="w-72 border-l flex flex-col bg-card flex-shrink-0">
          {/* Customer */}
          <div className="p-3 border-b space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Cliente (opcional)</p>
            {selectedCustomerObj ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="truncate flex-1 text-xs">{selectedCustomerObj.name}</span>
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setSelectedCustomer(null)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                {(customerCredits[selectedCustomerObj.id] || 0) > 0 ? (
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-accent text-xs">
                    <Gift className="h-3 w-3 text-primary" />
                    <span className="text-primary font-semibold">Crédito: {fc(customerCredits[selectedCustomerObj.id])}</span>
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground px-2">Sem crédito disponível</p>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                {/* Search existing customer */}
                <div className="relative">
                  <Input
                    placeholder="🔍 Buscar cliente cadastrado..."
                    value={customerQuery}
                    onChange={(e) => { setCustomerQuery(e.target.value); setShowCustomerDropdown(true); }}
                    onFocus={() => { if (customerQuery.trim()) setShowCustomerDropdown(true); }}
                    className="h-8 text-xs"
                  />
                  {showCustomerDropdown && customerQuery.trim() && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md border bg-popover shadow-lg max-h-48 overflow-auto">
                      {searchingCustomers ? (
                        <div className="flex items-center justify-center py-3"><Loader2 className="h-4 w-4 animate-spin" /></div>
                      ) : (
                        <>
                          {/* Registered customers */}
                          {filteredCustomers.map(c => (
                            <div key={c.id} className="px-3 py-2 hover:bg-accent cursor-pointer text-xs border-b last:border-0"
                              onClick={() => { setSelectedCustomer(c.id); setCustomerQuery(''); setQuickCustomerName(''); setShowCustomerDropdown(false); }}>
                              <div className="flex items-center justify-between">
                                <p className="font-medium">{c.name}</p>
                                {(customerCredits[c.id] || 0) > 0 && (
                                  <Badge variant="secondary" className="text-[10px] h-4 px-1">
                                    <Gift className="h-2.5 w-2.5 mr-0.5" />{fc(customerCredits[c.id])}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-muted-foreground">{c.document || c.phone || ''}</p>
                            </div>
                          ))}
                          {/* Manual credit entries (no registered customer) */}
                          {manualCreditEntries
                            .filter(m => m.name.toLowerCase().includes(customerQuery.trim().toLowerCase()))
                            .map(m => (
                              <div key={`mc-${m.id}`} className="px-3 py-2 hover:bg-accent cursor-pointer text-xs border-b last:border-0 opacity-80"
                                onClick={() => {
                                  // Can't select as customer_id — just show info
                                  toast({ title: `${m.name} tem crédito de ${fc(m.amount)}`, description: 'Use "Crédito de Loja" como forma de pagamento para aplicar.' });
                                  setShowCustomerDropdown(false);
                                }}>
                                <div className="flex items-center justify-between">
                                  <p className="font-medium">{m.name}</p>
                                  <Badge className="text-[10px] h-4 px-1 bg-primary/10 text-primary border-primary/20">
                                    <Gift className="h-2.5 w-2.5 mr-0.5" />{fc(m.amount)}
                                  </Badge>
                                </div>
                                <p className="text-muted-foreground">Crédito sem cadastro</p>
                              </div>
                            ))
                          }
                          {filteredCustomers.length === 0 && manualCreditEntries.filter(m => m.name.toLowerCase().includes(customerQuery.trim().toLowerCase())).length === 0 && (
                            <p className="text-center text-xs text-muted-foreground py-3">Nenhum encontrado</p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
                {/* Quick register name */}
                <Input
                  placeholder="✏️ Ou digite nome do novo cliente..."
                  value={quickCustomerName}
                  onChange={(e) => setQuickCustomerName(e.target.value)}
                  className="h-8 text-xs"
                />
                {quickCustomerName.trim() && (
                  <p className="text-[10px] text-muted-foreground">Será cadastrado automaticamente ao finalizar</p>
                )}
              </div>
            )}
          </div>

          {/* Totals */}
          <div className="flex-1" />
          <div className="p-3 border-t space-y-1">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Itens:</span><span>{cart.reduce((s, i) => s + i.qty, 0)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal:</span><span>{fc(subtotal)}</span></div>
            {discount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Desconto:</span>
                <span className="flex items-center gap-1">
                  −{fc(discount)}
                  <button onClick={() => { setDiscount(0); }} className="text-destructive hover:text-destructive/80 ml-1"><X className="h-3 w-3" /></button>
                </span>
              </div>
            )}
            {assemblyFee > 0 && (
              <div className="flex justify-between text-sm text-purple-600">
                <span>Montagem:</span>
                <span className="flex items-center gap-1">
                  +{fc(assemblyFee)}
                  <button onClick={() => { setAssemblyFee(0); }} className="text-destructive hover:text-destructive/80 ml-1"><X className="h-3 w-3" /></button>
                </span>
              </div>
            )}
            {couponApplied && (
              <div className="flex justify-between text-sm text-primary">
                <span>Cupom {couponApplied.code}:</span>
                <span className="flex items-center gap-1">−{fc(couponApplied.discount)}<button onClick={() => { setCouponApplied(null); setCouponCode(''); setDiscount(0); }} className="text-destructive hover:text-destructive/80 ml-1"><X className="h-3 w-3" /></button></span>
              </div>
            )}
            <div className="flex items-center gap-1 pt-1">
              <Button variant="outline" size="sm" className="h-7 text-xs flex-1" onClick={() => { setTempDiscount(discount > 0 ? String(discount) : ''); requestPinAuth('apply_discount'); }} disabled={cart.length === 0}>
                <DollarSign className="mr-1 h-3 w-3" /> Desconto
              </Button>
              {isModuleEnabled(currentAccount, 'assemblies') && (
                <Button variant="outline" size="sm" className="h-7 text-xs flex-1" onClick={() => { setTempAssembly(assemblyFee > 0 ? String(assemblyFee) : ''); setShowAssemblyInput(true); }} disabled={cart.length === 0}>
                  <Plus className="mr-1 h-3 w-3" /> Montagem
                </Button>
              )}
            </div>
            {!couponApplied && (
              <div className="flex gap-1 pt-1">
                <Input value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} placeholder="Cupom" className="h-7 text-xs uppercase" />
                <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => {
                  toast({ variant: 'destructive', title: 'Cupons indisponíveis', description: 'Funcionalidade desativada.' });
                }} disabled={couponValidating || cart.length === 0}>
                  Aplicar
                </Button>
              </div>
            )}
            <div className="flex justify-between text-2xl font-bold pt-2 border-t"><span>Total:</span><span>{fc(total)}</span></div>
          </div>

          {/* Actions */}
          <div className="p-3 border-t space-y-2">
            {isJpOrigin && (
              <div className="text-xs font-semibold bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-300 rounded px-2 py-1">
                🔄 Venda marcada como JP MÓVEIS
              </div>
            )}
            {saleNotes && (
              <div className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1 truncate" title={saleNotes}>
                📝 {saleNotes}
              </div>
            )}
            <Button className="w-full h-12 text-base" onClick={openPaymentModal} disabled={saving || cart.length === 0}>
              <CreditCard className="mr-2 h-5 w-5" /> Pagamento <kbd className="ml-2 text-[10px] opacity-60 font-mono">F3</kbd>
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 text-muted-foreground" onClick={holdCurrentSale} disabled={cart.length === 0}>
                <Pause className="mr-1 h-4 w-4" /> Aguardar <kbd className="ml-1 text-[10px] opacity-60 font-mono">F7</kbd>
              </Button>
              {heldSales.length > 0 && (
                <Button variant="outline" size="sm" className="relative" onClick={() => setShowHeldSalesModal(true)}>
                  <Play className="h-4 w-4" />
                  <Badge className="absolute -top-2 -right-2 h-4 w-4 p-0 flex items-center justify-center text-[9px] bg-orange-500 text-white">{heldSales.length}</Badge>
                </Button>
              )}
            </div>
            <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={clearCart} disabled={cart.length === 0}>
              <X className="mr-1 h-4 w-4" /> Limpar <kbd className="ml-1 text-[10px] opacity-60 font-mono">F4</kbd>
            </Button>
          </div>
        </div>
      </div>

      {/* Search modal */}
      <Dialog open={showSearchModal} onOpenChange={setShowSearchModal}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Buscar Produto</DialogTitle>
            <DialogDescription>Use % para busca parcial (ex: %armario%)</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Nome, SKU ou código..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
          <div className="max-h-60 overflow-auto space-y-1">
            {searching ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : searchResults.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">
                {searchQuery.trim() ? 'Nenhum produto encontrado' : 'Digite para buscar'}
              </p>
            ) : (
              searchResults.map(p => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border p-2 hover:bg-accent cursor-pointer"
                  onClick={() => { smartAddToCart(p); setShowSearchModal(false); setTimeout(() => barcodeRef.current?.focus(), 100); }}>
                  <div>
                    <p className="font-medium text-sm">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.sku || '—'} • {fc(p.price_default)}</p>
                  </div>
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pagamento</DialogTitle>
            <DialogDescription>Total: {fc(total)} {paymentEntries.length > 0 && `| Restante: ${fc(remaining)}`}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Resumo da compra */}
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Resumo da Compra</p>
              <div className="max-h-36 overflow-auto space-y-1">
                {cart.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs gap-2">
                    <span className="truncate flex-1">{item.qty}x {item.product.name}{item.presentation_name ? ` (${item.presentation_name})` : ''}</span>
                    <span className="font-medium whitespace-nowrap">{fc(item.qty * item.unit_price)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t pt-1 space-y-0.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Itens: {cart.reduce((s, i) => s + i.qty, 0)}</span>
                  <span className="text-muted-foreground">Subtotal: {fc(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-xs text-green-600">
                    <span>Desconto</span>
                    <span>−{fc(discount)}</span>
                  </div>
                )}
                {assemblyFee > 0 && (
                  <div className="flex justify-between text-xs text-purple-600">
                    <span>Montagem</span>
                    <span>+{fc(assemblyFee)}</span>
                  </div>
                )}
                {selectedCustomerObj && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span className="truncate">{selectedCustomerObj.name}</span>
                  </div>
                )}
                {saleNotes && (
                  <div className="text-xs text-muted-foreground truncate" title={saleNotes}>📝 {saleNotes}</div>
                )}
              </div>
              <div className="flex justify-between text-base font-bold border-t pt-1">
                <span>Total</span>
                <span>{fc(total)}</span>
              </div>
            </div>

            {paymentEntries.length > 0 && (
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Pagamentos Adicionados</p>
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
                  <span>Total pago</span><span>{fc(totalPaid)}</span>
                </div>
              </div>
            )}

            {cashChange > 0 && remaining <= 0.01 && (
              <div className="rounded-lg border-2 border-green-500 bg-green-50 dark:bg-green-950/30 p-4 text-center">
                <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">💰 Troco para o cliente</p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">{fc(cashChange)}</p>
              </div>
            )}

            {remaining > 0.01 && (
              <>
                <div className="space-y-2">
                  <Label>Forma de Pagamento</Label>
                  <div className="grid grid-cols-5 gap-2">
                    {([['pix', Smartphone, 'Pix'], ['cash', Banknote, 'Dinheiro'], ['card', CreditCard, 'Cartão'], ['crediario', BookOpen, 'Crediário'], ['store_credit', Gift, 'Crédito']] as const).map(([method, Icon, label]) => {
                      const blocked = method === 'crediario' && isModuleDisabled(currentAccount, 'crediario');
                      return (
                        <Button key={method} variant={curMethod === method ? 'default' : 'outline'} className="flex flex-col gap-1 h-auto py-2 relative" onClick={() => { setCurMethod(method as PaymentMethod); setSelectedCredit(null); setAvailableCredits([]); setCreditSearch(''); }} size="sm" disabled={blocked} title={blocked ? MODULE_BLOCKED_MESSAGE : undefined}>
                          <Icon className="h-4 w-4" /><span className="text-[10px]">{label}</span>
                          {blocked && <span className="absolute top-0.5 right-0.5 text-[8px]">🔒</span>}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Valor</Label>
                  <Input type="number" value={curAmount} onChange={e => setCurAmount(Number(e.target.value))} min={0.01} step={0.01} />
                  <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setCurAmount(Math.round(remaining * 100) / 100)}>
                    Usar valor restante ({fc(remaining)})
                  </Button>
                </div>

                {curMethod === 'cash' && (
                  <div className="space-y-2">
                    <Label>Valor Recebido do Cliente</Label>
                    <Input
                      type="number"
                      value={cashReceived || ''}
                      onChange={e => setCashReceived(Number(e.target.value))}
                      min={0}
                      step={0.01}
                      placeholder={fc(curAmount)}
                    />
                    {cashReceived > 0 && cashReceived >= curAmount && (
                      <div className="rounded-lg border-2 border-green-500 bg-green-50 dark:bg-green-950/30 p-3 text-center">
                        <p className="text-xs text-muted-foreground uppercase font-semibold">Troco</p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {fc(Math.round((cashReceived - Math.min(curAmount, remaining)) * 100) / 100)}
                        </p>
                      </div>
                    )}
                    {cashReceived > 0 && cashReceived < curAmount && (
                      <p className="text-xs text-destructive font-medium">
                        Valor recebido insuficiente. Faltam {fc(Math.round((curAmount - cashReceived) * 100) / 100)}
                      </p>
                    )}
                  </div>
                )}

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
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={copyPixKey}>
                              {pixCopied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                            </Button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {curMethod === 'card' && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant={curCardType === 'debit' ? 'default' : 'outline'} size="sm" onClick={() => { setCurCardType('debit'); setCurInstallments(1); }}>Débito</Button>
                      <Button variant={curCardType === 'credit' ? 'default' : 'outline'} size="sm" onClick={() => setCurCardType('credit')}>Crédito</Button>
                    </div>
                    {!isModuleDisabled(currentAccount?.id, 'hide_card_details_pdv') && (
                      <Select value={curCardBrand} onValueChange={setCurCardBrand}>
                        <SelectTrigger><SelectValue placeholder="Bandeira" /></SelectTrigger>
                        <SelectContent>{cardBrands.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                      </Select>
                    )}
                    {curCardType === 'credit' && (
                      <Select value={String(curInstallments)} onValueChange={v => setCurInstallments(Number(v))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{Array.from({ length: 12 }, (_, i) => i + 1).map(n => <SelectItem key={n} value={String(n)}>{n}x de {fc(curAmount / n)}</SelectItem>)}</SelectContent>
                      </Select>
                    )}
                    {!isModuleDisabled(currentAccount?.id, 'hide_card_details_pdv') && (
                      <div className="space-y-1">
                        <Label className="text-xs">Taxa (%)</Label>
                        <Input type="number" value={curCardFeePercent} onChange={e => setCurCardFeePercent(Number(e.target.value))} min={0} max={100} step={0.01} className="h-8" />
                      </div>
                    )}
                  </>
                )}

                {curMethod === 'crediario' && (
                  <div className="space-y-2">
                    {!selectedCustomerObj ? (
                      <p className="text-xs text-destructive font-medium">⚠️ Selecione um cliente com crediário autorizado antes de usar esta forma de pagamento.</p>
                    ) : !canUseCrediario ? (
                      <p className="text-xs text-destructive font-medium">⚠️ Cliente não possui crediário autorizado.</p>
                    ) : (
                      <>
                        <div className="rounded-lg border p-2 text-xs space-y-0.5">
                          <div className="flex justify-between"><span className="text-muted-foreground">Limite:</span><span className="font-medium">{fc(creditLimit)}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Usado:</span><span className="font-medium">{fc(customerUsedCredit)}</span></div>
                          <div className="flex justify-between font-bold"><span>Disponível:</span><span className={creditAvailable > 0 ? 'text-green-600' : 'text-destructive'}>{fc(creditAvailable)}</span></div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Parcelas</Label>
                          <Select value={String(curCrediarioInstallments)} onValueChange={v => setCurCrediarioInstallments(Number(v))}>
                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>{Array.from({ length: 24 }, (_, i) => i + 1).map(n => <SelectItem key={n} value={String(n)}>{n}x de {fc(curAmount / n)}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Data do 1º pagamento</Label>
                          <Input type="date" value={curCrediarioFirstDate} onChange={e => setCurCrediarioFirstDate(e.target.value)} className="h-8" />
                        </div>
                      </>
                    )}
                  </div>
                )}

                {curMethod === 'store_credit' && (
                  <div className="space-y-2">
                    <Label className="text-xs">Buscar crédito por nome do cliente ou ID</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Nome do cliente ou ID do crédito..."
                        value={creditSearch}
                        onChange={e => { setCreditSearch(e.target.value); if (e.target.value.length >= 2) searchStoreCredits(e.target.value); }}
                        className="text-sm"
                      />
                      {creditSearching && <Loader2 className="h-4 w-4 animate-spin mt-2 text-muted-foreground" />}
                    </div>
                    {availableCredits.length > 0 && !selectedCredit && (
                      <div className="max-h-32 overflow-auto space-y-1">
                        {availableCredits.map((c: any) => (
                          <button
                            key={c.id}
                            onClick={() => { setSelectedCredit(c); setCurAmount(Math.min(c.remaining_amount, remaining)); }}
                            className="w-full text-left rounded-lg border p-2 hover:bg-muted/50 transition text-sm"
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-medium">{c.customers?.name || c.customer_name_manual || 'Sem nome'}</span>
                              <span className="font-bold text-green-600 dark:text-green-400">{fc(c.remaining_amount)}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground">ID: {c.id.slice(0, 8)} — {c.reason} — {new Date(c.created_at).toLocaleDateString('pt-BR')}</p>
                          </button>
                        ))}
                      </div>
                    )}
                    {creditSearch.length >= 2 && !creditSearching && availableCredits.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-2">Nenhum crédito ativo encontrado</p>
                    )}
                    {selectedCredit && (
                      <div className="rounded-lg border-2 border-green-400 bg-green-50 dark:bg-green-950/30 p-3">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium text-sm">{selectedCredit.customers?.name || selectedCredit.customer_name_manual}</p>
                            <p className="text-[10px] text-muted-foreground">ID: {selectedCredit.id.slice(0, 8)} — {selectedCredit.reason}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-green-600 dark:text-green-400">{fc(selectedCredit.remaining_amount)}</p>
                            <button onClick={() => setSelectedCredit(null)} className="text-[10px] text-destructive hover:underline">Trocar</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <Button variant="secondary" className="w-full" onClick={addPaymentEntry} size="sm">
                  <Plus className="mr-1 h-4 w-4" /> Adicionar Pagamento
                </Button>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentModal(false)}>Cancelar</Button>
            <Button onClick={finalizeSale} disabled={paymentEntries.length === 0 || remaining > 0.01 || saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              ✓ Finalizar Venda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Register Dialog */}
      <Dialog open={showCloseRegister} onOpenChange={setShowCloseRegister}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Fechar Caixa</DialogTitle>
            <DialogDescription>Abertura: {fc(cashRegister?.opening_amount || 0)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-sm">Valor em caixa (R$)</Label>
              <Input type="number" value={closingAmount} onChange={e => setClosingAmount(e.target.value)} placeholder="0,00" className="text-lg" />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Observações</Label>
              <Textarea value={closingNotes} onChange={e => setClosingNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloseRegister(false)}>Cancelar</Button>
            <Button onClick={closeCashRegister} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Lock className="mr-1 h-4 w-4" /> Fechar Caixa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notes Modal */}
      <Dialog open={showNotesModal} onOpenChange={setShowNotesModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Observações da Venda</DialogTitle>
            <DialogDescription>Será impresso no comprovante</DialogDescription>
          </DialogHeader>
          <Textarea
            value={saleNotes}
            onChange={e => setSaleNotes(e.target.value)}
            placeholder="Ex: Entregar depois das 14h, Embalar para presente..."
            rows={3}
            autoFocus
          />
          {showJpToggle && (
            <div className="flex items-start justify-between gap-2 rounded-md border border-orange-300 bg-orange-50 dark:bg-orange-950/30 px-3 py-2 mt-2">
              <div className="flex-1">
                <Label htmlFor="jp-origin-toggle-rapido" className="text-xs font-semibold text-orange-700 dark:text-orange-300 cursor-pointer">
                  🔄 Venda da JP Móveis (faturada aqui)
                </Label>
                <p className="text-[10px] text-orange-600/80 dark:text-orange-400/80 leading-tight mt-0.5">
                  Marca temporária para identificar vendas da JP enquanto a NF está suspensa.
                </p>
              </div>
              <Switch id="jp-origin-toggle-rapido" checked={isJpOrigin} onCheckedChange={setIsJpOrigin} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNotesModal(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Modal with Print Options */}
      <Dialog open={showSuccessModal} onOpenChange={(open) => { if (!open) closeSuccessModal(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Check className="h-5 w-5 text-green-500" /> Venda Finalizada!
            </DialogTitle>
            <DialogDescription>Escolha o que deseja imprimir ou feche para continuar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Button
              className="w-full justify-start gap-3 h-12"
              variant="outline"
              onClick={() => handlePrintSale('receipt')}
              disabled={printingReceipt}
            >
              {printingReceipt ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              <div className="text-left">
                <p className="text-sm font-medium">Cupom do Pedido</p>
                <p className="text-xs text-muted-foreground">Comprovante não fiscal ({receiptFormat === 'thermal' ? '80mm' : 'A4'})</p>
              </div>
            </Button>
            <Button
              className="w-full justify-start gap-3 h-12"
              variant="outline"
              onClick={() => handlePrintSale('fiscal')}
              disabled={printingFiscal}
            >
              {printingFiscal ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              <div className="text-left">
                <p className="text-sm font-medium">Emitir e Imprimir NFC-e</p>
                <p className="text-xs text-muted-foreground">Emite na SEFAZ e imprime o DANFE real</p>
              </div>
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={closeSuccessModal} className="w-full">Nova Venda</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Held Sales Modal */}
      <Dialog open={showHeldSalesModal} onOpenChange={setShowHeldSalesModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" /> Vendas em Espera ({heldSales.length})
            </DialogTitle>
            <DialogDescription>Selecione uma venda para retomar de onde parou.</DialogDescription>
          </DialogHeader>
          {heldSales.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">Nenhuma venda em espera</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-auto">
              {heldSales.map(held => {
                const heldTotal = held.cart.reduce((s, i) => s + i.qty * i.unit_price, 0);
                const heldItems = held.cart.reduce((s, i) => s + i.qty, 0);
                const displayName = held.customerName || (held.customer ? customers.find(c => c.id === held.customer)?.name : null) || '';
                const heldTime = new Date(held.heldAt);
                return (
                  <div key={held.id} className="flex items-center gap-2 rounded-lg border p-2 hover:bg-accent/50 transition">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => resumeHeldSale(held.id)}>
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="font-medium">{heldItems} {heldItems === 1 ? 'item' : 'itens'}</span>
                        <span className="font-bold">{fc(heldTotal)}</span>
                        <span className="text-muted-foreground">• {heldTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      {displayName && <div className="text-[11px] font-semibold text-primary truncate">{displayName}</div>}
                    </div>
                    <Button size="sm" className="h-7 text-xs shrink-0" onClick={() => resumeHeldSale(held.id)}>
                      <Play className="mr-1 h-3 w-3" /> Retomar
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-destructive" onClick={() => removeHeldSale(held.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {cashRegister && (
        <PdvOperationsModal
          open={showOperations}
          onOpenChange={setShowOperations}
          cashRegisterId={cashRegister.id}
        />
      )}
      {cashRegister && currentStore && currentAccount && user && (
        <PdvReportModal
          open={showReport}
          onOpenChange={setShowReport}
          storeId={currentStore.id}
          storeName={currentStore.name}
          accountId={currentAccount.id}
          userId={user.id}
          userRole={userRole || 'seller'}
          cashRegister={cashRegister}
        />
      )}
      <PinAuthModal
        open={pinModalOpen}
        onOpenChange={setPinModalOpen}
        title={
          pinAction?.type === 'remove_item' ? 'Remover Item' :
          pinAction?.type === 'clear_cart' ? 'Limpar Carrinho' :
          pinAction?.type === 'edit_price' ? 'Alterar Preço' :
          pinAction?.type === 'apply_discount' ? 'Aplicar Desconto' :
          pinAction?.type === 'remove_held_sale' ? 'Excluir Venda em Espera' : 'Autorização'
        }
        description={
          pinAction?.type === 'remove_item' ? 'Autorize a remoção do item do carrinho.' :
          pinAction?.type === 'clear_cart' ? 'Autorize a limpeza completa do carrinho.' :
          pinAction?.type === 'edit_price' ? 'Autorize a alteração de preço deste produto.' :
          pinAction?.type === 'apply_discount' ? 'Autorize a aplicação de desconto nesta venda.' :
          pinAction?.type === 'remove_held_sale' ? 'Autorize a exclusão desta venda em espera.' : ''
        }
        onAuthorized={handlePinAuthorized}
      />

      {/* Price Edit Dialog */}
      <Dialog open={editingPriceIdx !== null} onOpenChange={(open) => { if (!open) { setEditingPriceIdx(null); setTempPrice(''); } }}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" /> Alterar Preço
            </DialogTitle>
            <DialogDescription>
              {editingPriceIdx !== null && cart[editingPriceIdx] ? cart[editingPriceIdx].product.name : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Novo preço (R$)</Label>
            <Input
              type="number"
              value={tempPrice}
              onChange={e => setTempPrice(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') confirmPriceEdit(); }}
              min={0}
              step={0.01}
              autoFocus
              className="text-lg text-center"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditingPriceIdx(null); setTempPrice(''); }}>Cancelar</Button>
            <Button onClick={confirmPriceEdit}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discount Input Dialog */}
      <Dialog open={showDiscountInput} onOpenChange={(open) => { if (!open) setShowDiscountInput(false); }}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" /> Aplicar Desconto
            </DialogTitle>
            <DialogDescription>Subtotal: {fc(subtotal)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Valor do desconto (R$)</Label>
            <Input
              type="number"
              value={tempDiscount}
              onChange={e => setTempDiscount(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { const v = Number(tempDiscount); if (!isNaN(v) && v >= 0 && v <= subtotal) { setDiscount(v); setShowDiscountInput(false); setTempDiscount(''); } } }}
              min={0}
              max={subtotal}
              step={0.01}
              autoFocus
              className="text-lg text-center"
            />
            {Number(tempDiscount) > subtotal && <p className="text-xs text-destructive">Desconto não pode ser maior que o subtotal</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDiscountInput(false); setTempDiscount(''); }}>Cancelar</Button>
            <Button onClick={() => { const v = Number(tempDiscount); if (!isNaN(v) && v >= 0 && v <= subtotal) { setDiscount(v); setShowDiscountInput(false); setTempDiscount(''); } }} disabled={isNaN(Number(tempDiscount)) || Number(tempDiscount) < 0 || Number(tempDiscount) > subtotal}>Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assembly Fee Dialog */}
      <Dialog open={showAssemblyInput} onOpenChange={(open) => { if (!open) setShowAssemblyInput(false); }}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="h-5 w-5" /> Taxa de Montagem</DialogTitle>
            <DialogDescription>Será somada ao total da venda.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Valor da montagem (R$)</Label>
            <Input
              type="number"
              value={tempAssembly}
              onChange={e => setTempAssembly(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { const v = Number(tempAssembly); if (!isNaN(v) && v >= 0) { setAssemblyFee(v); setShowAssemblyInput(false); setTempAssembly(''); } } }}
              min={0}
              step={0.01}
              autoFocus
              className="text-lg text-center"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAssemblyInput(false); setTempAssembly(''); }}>Cancelar</Button>
            <Button onClick={() => { const v = Number(tempAssembly); if (!isNaN(v) && v >= 0) { setAssemblyFee(v); setShowAssemblyInput(false); setTempAssembly(''); } }} disabled={isNaN(Number(tempAssembly)) || Number(tempAssembly) < 0}>Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!presentationPickerProduct} onOpenChange={(open) => { if (!open) { setPresentationPickerProduct(null); setPresentationOptions([]); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Selecionar Apresentação</DialogTitle>
            <DialogDescription>{presentationPickerProduct?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {/* Base unit option */}
            <button
              className="w-full text-left rounded-lg border p-3 hover:bg-accent transition"
              onClick={() => presentationPickerProduct && handlePickPresentation(presentationPickerProduct, null)}
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-sm">Unidade ({presentationPickerProduct?.unit || 'UN'})</p>
                  <p className="text-xs text-muted-foreground">1 {presentationPickerProduct?.unit || 'UN'}</p>
                </div>
                <span className="font-bold text-sm">{fc(presentationPickerProduct?.price_default || 0)}</span>
              </div>
            </button>
            {/* Presentation options */}
            {presentationOptions.map(pres => {
              const presPrice = pres.price != null ? Number(pres.price) : (presentationPickerProduct?.price_default || 0) * Number(pres.conversion_factor);
              return (
                <button
                  key={pres.id}
                  className="w-full text-left rounded-lg border p-3 hover:bg-accent transition"
                  onClick={() => presentationPickerProduct && handlePickPresentation(presentationPickerProduct, pres)}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-sm">{pres.name}</p>
                      <p className="text-xs text-muted-foreground">= {pres.conversion_factor} {presentationPickerProduct?.unit || 'UN'}</p>
                    </div>
                    <span className="font-bold text-sm">{fc(presPrice)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
