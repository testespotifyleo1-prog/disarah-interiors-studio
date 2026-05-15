import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Search, ShoppingBag, Loader2, Store, X, ArrowLeft, ChevronLeft, ChevronRight, Phone, ShoppingCart, Plus, Minus, Trash2, CheckCircle2, MapPin, Package, User, Menu, Star, Heart, Grid3X3, ClipboardList, Mail, ChevronDown, Zap, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { ConectaMixLogo } from '@/components/brand/ConectaMixLogo';
import { MercadoPagoStorefrontCheckout } from '@/components/payment/MercadoPagoStorefrontCheckout';

interface CategoryItem { id: string; name: string; icon_url?: string; }
interface HeaderMenuItem { name: string; icon?: string; category?: string; children?: { name: string; category: string }[]; }
interface StoreInfo {
  id?: string;
  account_id?: string;
  live_shipping?: { melhor_envio?: boolean; uber_direct?: boolean };
  name: string; banner_text: string; description: string; whatsapp_number: string;
  primary_color: string; logo_url: string | null; banner_image_url: string | null;
  hero_subtitle: string | null; show_prices: boolean; show_whatsapp_button: boolean;
  categories: CategoryItem[]; inline_banners: InlineBanner[];
  header_menu: HeaderMenuItem[];
  footer_cnpj: string | null; footer_address: string | null;
  footer_phone: string | null; footer_email: string | null;
  policy_privacy: string | null; policy_terms: string | null;
  policy_purchase: string | null; policy_exchange: string | null;
  policy_shipping: string | null; about_us: string | null;
  delivery_options: DeliveryOption[];
  payment_methods: PaymentMethodOption[];
  menu_theme?: 'party' | 'furniture';
  mercado_pago?: { public_key: string; enabled_methods: string[]; environment?: string; credit_fee_percent?: number; debit_fee_percent?: number } | null;
}
interface FeeBreakdownItem { label: string; amount: number; }
interface DeliveryOption { id: string; name: string; description: string; price: number; is_active: boolean; provider?: 'static' | 'melhor_envio' | 'uber_direct'; quote_id?: string; delivery_minutes?: number; pickup_duration?: number; dropoff_eta?: string; pickup_eta?: string; expires?: string; fee_breakdown?: FeeBreakdownItem[]; }
interface PaymentMethodOption { id: string; name: string; icon: string; is_active: boolean; }
interface InlineBanner { id: string; image_url: string; title: string; link_url?: string; }
interface CatalogVariant {
  id: string;
  sku: string | null;
  gtin: string | null;
  price: number;
  attributes: Record<string, string>;
  images: string[];
  qty_available: number;
}
interface CatalogProduct {
  id: string; name: string; price_default: number; sku: string | null; unit: string;
  qty_available: number; image_url: string | null; description: string | null;
  brand: string | null; category: string | null;
  promo_price: number | null; promo_starts_at: string | null; promo_ends_at: string | null;
  gallery?: string[];
  variants?: CatalogVariant[];
  price_min?: number | null;
  price_max?: number | null;
}
interface CartItem { product: CatalogProduct; qty: number; variant?: CatalogVariant | null; }
type CheckoutStep = 'cart' | 'address' | 'confirm' | 'success';
type PageView = 'store' | 'checkout' | 'product' | 'myorders' | 'catalog' | 'policy' | 'favorites';
const productsSectionRef = { current: null as HTMLDivElement | null };

function useFavorites(slug: string | undefined) {
  const key = `favorites_${slug || 'default'}`;
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

  const toggleFavorite = useCallback((productId: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId); else next.add(productId);
      localStorage.setItem(key, JSON.stringify([...next]));
      return next;
    });
  }, [key]);

  const isFavorite = useCallback((productId: string) => favorites.has(productId), [favorites]);

  return { favorites, toggleFavorite, isFavorite, count: favorites.size };
}

export default function Storefront() {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [featured, setFeatured] = useState<CatalogProduct[]>([]);
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  useEffect(() => { setSelectedImageIdx(0); setSelectedVariantId(null); }, [selectedProduct?.id]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [heroSlide, setHeroSlide] = useState(0);
  const heroInterval = useRef<ReturnType<typeof setInterval>>();
  const catScrollRef = useRef<HTMLDivElement>(null);
  const [pageView, setPageView] = useState<PageView>('store');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>('cart');
  const [placing, setPlacing] = useState(false);
  const [orderResult, setOrderResult] = useState<{ order_number: number; total: number } | null>(null);
  const [pendingSale, setPendingSale] = useState<{ sale_id: string; order_number: number; total: number } | null>(null);

  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custDoc, setCustDoc] = useState('');
  const [custNotes, setCustNotes] = useState('');
  const [payPref, setPayPref] = useState('pix');
  const [deliveryType, setDeliveryType] = useState('delivery');

  const [addrStreet, setAddrStreet] = useState('');
  const [addrNumber, setAddrNumber] = useState('');
  const [addrComplement, setAddrComplement] = useState('');
  const [addrNeighborhood, setAddrNeighborhood] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrState, setAddrState] = useState('');
  const [addrZip, setAddrZip] = useState('');

  const [orderPhone, setOrderPhone] = useState('');
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [policyPage, setPolicyPage] = useState<string>('');
  const [couponCode, setCouponCode] = useState('');
  const [couponValidating, setCouponValidating] = useState(false);
  const [couponApplied, setCouponApplied] = useState<{ code: string; discount: number; description?: string } | null>(null);

  const { toggleFavorite, isFavorite, count: favCount } = useFavorites(slug);

  const [catalogCategory, setCatalogCategory] = useState<string>('all');
  const [catalogSort, setCatalogSort] = useState<string>('name');
  const [catalogPage, setCatalogPage] = useState(0);
  const CATALOG_PAGE_SIZE = 24;

  useEffect(() => { if (slug) loadCatalog(); }, [slug]);

  const loadCatalog = async () => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const baseUrl = `https://${projectId}.supabase.co/functions/v1/get-store-catalog`;
    const params = new URLSearchParams(window.location.search);
    const produtoId = params.get('produto');

    // Fast path: open the product page instantly using a single-product query,
    // then load the full catalog in the background.
    if (produtoId) {
      setLoading(true);
      try {
        const res = await fetch(`${baseUrl}?slug=${encodeURIComponent(slug!)}&product_id=${encodeURIComponent(produtoId)}`, { headers: { 'Content-Type': 'application/json' } });
        if (res.ok) {
          const data = await res.json();
          if (data.product) {
            setStore(prev => ({ ...(prev || {} as StoreInfo), ...data.store } as StoreInfo));
            setProducts([data.product]);
            setSelectedProduct(data.product);
            setPageView('product');
            window.scrollTo({ top: 0 });
            setLoading(false);
            // Background: load full catalog so navigation/related work
            fetch(`${baseUrl}?slug=${encodeURIComponent(slug!)}`, { headers: { 'Content-Type': 'application/json' } })
              .then(r => r.ok ? r.json() : null)
              .then(full => {
                if (!full) return;
                setStore(full.store);
                setProducts(full.products || []);
                setFeatured(full.featured || []);
                // Refresh selected product with the complete record (gallery/variants)
                const fresh = (full.products || []).find((p: CatalogProduct) => p.id === produtoId);
                if (fresh) setSelectedProduct(fresh);
              })
              .catch(() => {});
            return;
          }
        }
      } catch { /* fall through to normal load */ }
    }

    setLoading(true);
    try {
      const res = await fetch(`${baseUrl}?slug=${encodeURIComponent(slug!)}`, { headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) { setError('Loja não encontrada'); setLoading(false); return; }
      const data = await res.json();
      setStore(data.store); setProducts(data.products || []); setFeatured(data.featured || []);
      // If ?produto exists but fast path failed, still try to open it
      if (produtoId) {
        const p = (data.products || []).find((x: CatalogProduct) => x.id === produtoId);
        if (p) { setSelectedProduct(p); setPageView('product'); window.scrollTo({ top: 0 }); }
      }
    } catch { setError('Erro ao carregar loja'); }
    finally { setLoading(false); }
  };

  const fc = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const productCategories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach(p => { if (p.category) cats.add(p.category); });
    return Array.from(cats).sort();
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter(p => {
      if (activeCategory !== 'all' && p.category !== activeCategory) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !(p.sku || '').toLowerCase().includes(q) && !(p.brand || '').toLowerCase().includes(q) && !(p.category || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [products, search, activeCategory]);

  const promoProducts = useMemo(() => {
    const now = new Date();
    return products.filter(p => {
      if (!p.promo_price || !p.promo_ends_at) return false;
      const start = p.promo_starts_at ? new Date(p.promo_starts_at) : new Date(0);
      const end = new Date(p.promo_ends_at);
      return now >= start && now < end;
    });
  }, [products]);

  const [countdownNow, setCountdownNow] = useState(Date.now());
  useEffect(() => {
    if (promoProducts.length === 0) return;
    const timer = setInterval(() => setCountdownNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [promoProducts.length]);

  const primaryColor = store?.primary_color || '#e91e8c';
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const getEffectivePrice = (p: CatalogProduct, variant?: CatalogVariant | null) => {
    if (variant) return variant.price;
    if (p.promo_price && p.promo_ends_at) {
      const now = new Date();
      const start = p.promo_starts_at ? new Date(p.promo_starts_at) : new Date(0);
      const end = new Date(p.promo_ends_at);
      if (now >= start && now < end) return p.promo_price;
    }
    return p.price_default;
  };
  const staticDeliveryOptions = useMemo(() => (store?.delivery_options || []).filter((d: DeliveryOption) => d.is_active).map(d => ({ ...d, provider: 'static' as const })), [store]);
  const [liveQuotes, setLiveQuotes] = useState<DeliveryOption[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [quoteRefreshTick, setQuoteRefreshTick] = useState(0);
  const [quoteJustRefreshed, setQuoteJustRefreshed] = useState(false);
  const activeDeliveryOptions = useMemo(() => [...staticDeliveryOptions, ...liveQuotes], [staticDeliveryOptions, liveQuotes]);
  const activePaymentMethods = useMemo(() => (store?.payment_methods || []).filter((p: PaymentMethodOption) => p.is_active), [store]);
  const selectedDeliveryOption = activeDeliveryOptions.find((d: DeliveryOption) => d.id === deliveryType);
  const deliveryFee = selectedDeliveryOption?.price || 0;
  const cartSubtotal = cart.reduce((s, i) => s + i.qty * getEffectivePrice(i.product, i.variant), 0);
  const couponDiscount = couponApplied?.discount || 0;
  const cartTotal = Math.max(0, cartSubtotal - couponDiscount + deliveryFee);

  // Fetch live shipping quotes (Melhor Envio + Uber Direct) when CEP is valid
  useEffect(() => {
    const cep = (addrZip || '').replace(/\D/g, '');
    const inCheckout = checkoutStep === 'address' || checkoutStep === 'confirm';
    if (!inCheckout || cep.length !== 8 || !store?.account_id || !store.live_shipping) {
      setLiveQuotes([]); return;
    }
    if (!store.live_shipping.melhor_envio && !store.live_shipping.uber_direct) {
      setLiveQuotes([]); return;
    }
    let cancelled = false;
    setLoadingQuotes(true);
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const headers = { 'Content-Type': 'application/json' };
    const calls: Promise<DeliveryOption[]>[] = [];
    if (store.live_shipping.melhor_envio) {
      calls.push(
        fetch(`https://${projectId}.supabase.co/functions/v1/melhor-envio-quote`, {
          method: 'POST', headers,
          body: JSON.stringify({ accountId: store.account_id, destination_zipcode: cep, items: [] }),
        }).then(r => r.json()).then(d => (d?.options || []).map((o: any) => ({
          id: `me_${o.id}`,
          name: o.name,
          description: o.delivery_days ? `Entrega em até ${o.delivery_days} dia(s) úteis` : 'Frete via Melhor Envio',
          price: Number(o.price) || 0,
          is_active: true,
          provider: 'melhor_envio' as const,
          quote_id: String(o.id),
        }))).catch(() => [])
      );
    }
    if (store.live_shipping.uber_direct) {
      calls.push(
        fetch(`https://${projectId}.supabase.co/functions/v1/uber-direct-quote`, {
          method: 'POST', headers,
          body: JSON.stringify({
            accountId: store.account_id,
            dropoff_address: { street_address: [addrStreet, addrNumber].filter(Boolean).join(', '), city: addrCity, state: addrState, zip_code: cep, country: 'BR' },
            dropoff_phone: custPhone,
            manifest_total_value: cartSubtotal,
          }),
        }).then(r => r.json()).then(d => (d?.options || []).map((o: any) => ({
          id: `uber_${o.id}`,
          name: o.name || 'Uber Direct',
          description: o.delivery_minutes ? `Entrega expressa em ~${Math.round(o.delivery_minutes / 60)} min` : 'Entrega expressa',
          price: Number(o.price) || 0,
          is_active: true,
          provider: 'uber_direct' as const,
          quote_id: String(o.id),
          delivery_minutes: o.delivery_minutes,
          pickup_duration: o.pickup_duration,
          dropoff_eta: o.dropoff_eta,
          pickup_eta: o.pickup_eta,
          expires: o.expires,
          fee_breakdown: o.fee_breakdown,
        }))).catch(() => [])
      );
    }
    Promise.all(calls).then(results => {
      if (cancelled) return;
      const flat = results.flat();
      setLiveQuotes(flat);
      setLoadingQuotes(false);
      // Preserve user selection across refreshes (quote IDs change on each Uber call)
      setDeliveryType(prev => {
        if (flat.some(o => o.id === prev)) return prev;
        if (prev?.startsWith('uber_')) {
          const newUber = flat.find(o => o.provider === 'uber_direct');
          if (newUber) return newUber.id;
        }
        if (prev?.startsWith('me_')) {
          const newMe = flat.find(o => o.provider === 'melhor_envio');
          if (newMe) return newMe.id;
        }
        return prev;
      });
      if (quoteRefreshTick > 0) {
        setQuoteJustRefreshed(true);
        setTimeout(() => setQuoteJustRefreshed(false), 2500);
      }
    });
    return () => { cancelled = true; };
  }, [checkoutStep, addrZip, addrStreet, addrNumber, addrCity, addrState, custPhone, store?.account_id, store?.live_shipping?.melhor_envio, store?.live_shipping?.uber_direct, cartSubtotal, quoteRefreshTick]);

  // Auto-refresh Uber Direct quote ~30s before it expires (Uber expires quotes in ~5 min)
  useEffect(() => {
    const uberOpt = liveQuotes.find(o => o.provider === 'uber_direct' && o.expires);
    if (!uberOpt?.expires) return;
    const expiresAt = new Date(uberOpt.expires).getTime();
    const refreshAt = expiresAt - 30_000; // 30s before expiry
    const delay = Math.max(5_000, refreshAt - Date.now());
    const t = setTimeout(() => setQuoteRefreshTick(n => n + 1), delay);
    return () => clearTimeout(t);
  }, [liveQuotes]);


  const cartKey = (productId: string, variantId?: string | null) => `${productId}|${variantId || ''}`;

  const addToCart = useCallback((product: CatalogProduct, variant?: CatalogVariant | null) => {
    const available = variant ? variant.qty_available : product.qty_available;
    if (available <= 0) { toast.error('Produto sem estoque'); return; }
    setCart(prev => {
      const key = cartKey(product.id, variant?.id);
      const existing = prev.find(i => cartKey(i.product.id, i.variant?.id) === key);
      if (existing) {
        if (existing.qty >= available) { toast.error(`Estoque máximo: ${available}`); return prev; }
        return prev.map(i => cartKey(i.product.id, i.variant?.id) === key ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { product, qty: 1, variant: variant || null }];
    });
    toast.success('Adicionado ao carrinho');
  }, []);

  const updateCartQty = (productId: string, variantId: string | null | undefined, delta: number) => {
    setCart(prev => prev.map(i => {
      if (cartKey(i.product.id, i.variant?.id) !== cartKey(productId, variantId)) return i;
      const available = i.variant ? i.variant.qty_available : i.product.qty_available;
      const newQty = i.qty + delta;
      if (newQty <= 0) return i;
      if (newQty > available) { toast.error(`Estoque máximo: ${available}`); return i; }
      return { ...i, qty: newQty };
    }));
  };

  const removeFromCart = (productId: string, variantId?: string | null) =>
    setCart(prev => prev.filter(i => cartKey(i.product.id, i.variant?.id) !== cartKey(productId, variantId)));

  const openWhatsApp = (productName?: string) => {
    if (!store?.whatsapp_number) return;
    const msg = productName ? `Olá! Tenho interesse no produto: ${productName}` : 'Olá! Gostaria de saber mais sobre os produtos.';
    window.open(`https://wa.me/${store.whatsapp_number}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const mpEnabled = !!store?.mercado_pago?.public_key;
  const mpMethods = store?.mercado_pago?.enabled_methods || [];
  const mpCanHandleSelected = mpEnabled && (
    (payPref === 'pix' && mpMethods.includes('pix')) ||
    (payPref === 'card' && (mpMethods.includes('credit_card') || mpMethods.includes('debit_card')))
  );

  const placeOrder = async () => {
    if (!custName || !custPhone) { toast.error('Preencha nome e telefone'); return; }
    if (deliveryType !== 'pickup' && (!addrStreet || !addrCity)) { toast.error('Preencha o endereço'); return; }
    setPlacing(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/place-ecommerce-order`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug, customer_name: custName, customer_phone: custPhone, customer_document: custDoc || null,
          address: { street: addrStreet, number: addrNumber, complement: addrComplement, neighborhood: addrNeighborhood, city: addrCity, state: addrState, zip: addrZip },
          items: cart.map(i => ({ product_id: i.product.id, variant_id: i.variant?.id || null, qty: i.qty })),
          notes: custNotes || null, payment_preference: payPref,
          delivery_type: deliveryType, delivery_fee: deliveryFee,
          shipping_provider: selectedDeliveryOption?.provider || 'static',
          shipping_quote_id: selectedDeliveryOption?.quote_id || null,
          shipping_method_name: selectedDeliveryOption?.name || null,
          coupon_code: couponApplied?.code || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Erro ao realizar pedido'); if (data.details) data.details.forEach((d: string) => toast.error(d)); return; }

      // Se MP estiver habilitado para o método escolhido, abrimos o checkout MP (mantém em 'confirm')
      if (mpCanHandleSelected) {
        setPendingSale({ sale_id: data.sale_id, order_number: data.order_number, total: data.total });
      } else {
        // Fluxo legado (PIX manual / dinheiro / cartão sem MP): finaliza direto
        setOrderResult({ order_number: data.order_number, total: data.total });
        setCheckoutStep('success');
        setCart([]);
        setCouponApplied(null); setCouponCode('');
      }
    } catch { toast.error('Erro de conexão'); }
    finally { setPlacing(false); }
  };

  const applyCoupon = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) { toast.error('Informe o código do cupom'); return; }
    if (!custPhone.trim()) { toast.error('Informe seu telefone antes de aplicar o cupom (ele é pessoal).'); return; }
    setCouponValidating(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/validate-coupon`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, code, phone: custPhone, subtotal: cartSubtotal }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Cupom inválido'); return; }
      const c = data.coupon;
      setCouponApplied({ code: c.code, discount: Number(c.discount_amount), description: c.description });
      toast.success(`Cupom aplicado: -${fc(Number(c.discount_amount))}`);
    } catch { toast.error('Erro ao validar cupom'); }
    finally { setCouponValidating(false); }
  };

  const clearCoupon = () => { setCouponApplied(null); setCouponCode(''); };

  const onMpApproved = useCallback(() => {
    if (!pendingSale) return;
    toast.success('Pagamento aprovado!');
    setOrderResult({ order_number: pendingSale.order_number, total: pendingSale.total });
    setPendingSale(null);
    setCheckoutStep('success');
    setCart([]);
    setCouponApplied(null); setCouponCode('');
  }, [pendingSale]);

  const lookupOrders = async () => {
    if (!orderPhone.trim()) { toast.error('Informe seu telefone'); return; }
    setLoadingOrders(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/get-store-catalog?slug=${encodeURIComponent(slug!)}&lookup_phone=${encodeURIComponent(orderPhone.trim())}`);
      if (res.ok) { const data = await res.json(); setMyOrders(data.orders || []); }
    } catch { toast.error('Erro ao buscar pedidos'); }
    finally { setLoadingOrders(false); }
  };

  const getHeroSlides = () => {
    const slides: { image: string; title: string; link?: string }[] = [];
    if (store?.banner_image_url) slides.push({ image: store.banner_image_url, title: store.banner_text || '' });
    (store?.inline_banners || []).forEach(b => {
      if (b.image_url) slides.push({ image: b.image_url, title: b.title, link: b.link_url });
    });
    return slides;
  };

  const getProductSections = () => {
    // Diversify: group by category/type prefix, round-robin pick
    const withPhoto = filtered.filter(p => p.image_url);
    const withoutPhoto = filtered.filter(p => !p.image_url);
    
    // Group by category or first word of name
    const groups = new Map<string, CatalogProduct[]>();
    for (const p of withPhoto) {
      const key = p.category || p.name.split(' ')[0].toUpperCase();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }
    
    // Round-robin to interleave different types
    const interleaved: CatalogProduct[] = [];
    const groupArrays = Array.from(groups.values());
    const indices = groupArrays.map(() => 0);
    let anyLeft = true;
    while (anyLeft) {
      anyLeft = false;
      for (let g = 0; g < groupArrays.length; g++) {
        if (indices[g] < groupArrays[g].length) {
          interleaved.push(groupArrays[g][indices[g]]);
          indices[g]++;
          anyLeft = true;
        }
      }
    }
    
    const all = [...interleaved, ...withoutPhoto];
    return { section1: all.slice(0, 8), section2: all.slice(8, 16) };
  };

  const catalogProducts = useMemo(() => {
    let list = products.filter(p => {
      if (catalogCategory !== 'all' && p.category !== catalogCategory) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !(p.sku || '').toLowerCase().includes(q) && !(p.brand || '').toLowerCase().includes(q) && !(p.category || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
    if (catalogSort === 'price_asc') list.sort((a, b) => a.price_default - b.price_default);
    else if (catalogSort === 'price_desc') list.sort((a, b) => b.price_default - a.price_default);
    else if (catalogSort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    else {
      // Default: products with photos first
      list.sort((a, b) => (b.image_url ? 1 : 0) - (a.image_url ? 1 : 0));
    }
    return list;
  }, [products, catalogCategory, catalogSort, search]);

  const catalogTotalPages = Math.ceil(catalogProducts.length / CATALOG_PAGE_SIZE);
  const catalogPageProducts = catalogProducts.slice(catalogPage * CATALOG_PAGE_SIZE, (catalogPage + 1) * CATALOG_PAGE_SIZE);

  const scrollToProducts = () => {
    setTimeout(() => {
      productsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const navigateToCategory = (cat: string) => {
    setCatalogCategory(cat);
    setCatalogPage(0);
    setPageView('catalog');
    setSearch('');
    window.scrollTo({ top: 0 });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center"><Loader2 className="h-10 w-10 animate-spin mx-auto mb-4" style={{ color: primaryColor }} /><p className="text-gray-500 text-sm">Carregando loja...</p></div>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center px-6"><Store className="mx-auto h-20 w-20 text-gray-200 mb-6" /><h1 className="text-3xl font-bold text-gray-700 mb-2">Loja não encontrada</h1><p className="text-gray-400">Verifique o endereço e tente novamente.</p></div>
      </div>
    );
  }

  const heroSlides = getHeroSlides();
  const { section1, section2 } = getProductSections();
  const inlineBanners = store.inline_banners || [];
  const storeCategories: CategoryItem[] = (store.categories as any) || [];
  const allCats: CategoryItem[] = productCategories.map(catName => {
    const stored = storeCategories.find(c => c.name === catName);
    return stored || { id: catName, name: catName };
  });

  // ===================== POLICY PAGE =====================
  if (pageView === 'policy' && policyPage) {
    const policyTitles: Record<string, string> = {
      privacy: 'Política de Privacidade',
      terms: 'Termos de Uso',
      purchase: 'Política de Compra',
      exchange: 'Política de Troca e Devolução',
      shipping: 'Política de Envio',
      about: 'Sobre Nós',
    };
    const policyContentMap: Record<string, string | null> = {
      privacy: store.policy_privacy,
      terms: store.policy_terms,
      purchase: store.policy_purchase,
      exchange: store.policy_exchange,
      shipping: store.policy_shipping,
      about: store.about_us,
    };
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="sticky top-0 z-50 shadow-md" style={{ backgroundColor: primaryColor }}>
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
            <button onClick={() => setPageView('store')} className="p-2 text-white hover:bg-white/10 rounded-lg transition"><ArrowLeft className="h-5 w-5" /></button>
            <h1 className="text-white font-bold text-sm sm:text-base flex-1">{policyTitles[policyPage] || ''}</h1>
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="bg-white rounded-2xl border p-6 sm:p-8">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6">{policyTitles[policyPage]}</h2>
            <div className="prose prose-sm max-w-none text-gray-600 whitespace-pre-wrap leading-relaxed">
              {policyContentMap[policyPage] || 'Conteúdo ainda não configurado.'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===================== MY ORDERS =====================
  if (pageView === 'myorders') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="sticky top-0 z-50 bg-white border-b shadow-sm">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
            <button onClick={() => setPageView('store')} className="p-2 rounded-full hover:bg-gray-100"><ArrowLeft className="h-5 w-5 text-gray-700" /></button>
            <h1 className="font-bold text-gray-800 flex-1">Meus Pedidos</h1>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          <div className="bg-white rounded-2xl border p-4 space-y-3">
            <p className="text-sm text-gray-600">Informe seu telefone para consultar seus pedidos:</p>
            <div className="flex gap-2">
              <input placeholder="(00) 00000-0000" value={orderPhone} onChange={e => setOrderPhone(e.target.value)} className="flex-1 border rounded-xl px-4 py-3 text-sm" />
              <button onClick={lookupOrders} disabled={loadingOrders} className="px-6 rounded-xl text-white font-semibold text-sm" style={{ backgroundColor: primaryColor }}>
                {loadingOrders ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buscar'}
              </button>
            </div>
          </div>
          {myOrders.length > 0 ? myOrders.map((order: any) => (
            <div key={order.id} className="bg-white rounded-2xl border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-800">Pedido #{order.order_number}</span>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${order.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : order.status === 'canceled' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-700'}`}>
                  {order.status === 'paid' ? 'Confirmado' : order.status === 'canceled' ? 'Cancelado' : 'Pendente'}
                </span>
              </div>
              <p className="text-xs text-gray-500">{new Date(order.created_at).toLocaleDateString('pt-BR')}</p>
              <p className="text-lg font-extrabold" style={{ color: primaryColor }}>{fc(order.total)}</p>
              {order.tracking_token && (
                <a
                  href={`/rastreio/${order.tracking_token}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-white font-semibold text-sm shadow-sm hover:opacity-90 transition"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Truck className="h-4 w-4" /> Acompanhar pedido
                </a>
              )}
            </div>
          )) : orderPhone && !loadingOrders && (
            <div className="text-center py-12"><Package className="mx-auto h-14 w-14 text-gray-200 mb-3" /><p className="text-gray-500">Nenhum pedido encontrado</p></div>
          )}
        </div>
      </div>
    );
  }

  // ===================== FAVORITES =====================
  if (pageView === 'favorites') {
    const favoriteProducts = products.filter(p => isFavorite(p.id));
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="sticky top-0 z-50 shadow-md" style={{ backgroundColor: primaryColor }}>
          <div className="max-w-7xl mx-auto px-3 py-2 flex items-center gap-2">
            <button onClick={() => setPageView('store')} className="p-2 text-white hover:bg-white/10 rounded-lg transition"><ArrowLeft className="h-5 w-5" /></button>
            <div className="flex-1 flex items-center justify-center gap-2">
              <Heart className="h-5 w-5 text-white fill-white" />
              <h1 className="text-white font-bold text-lg">Meus Favoritos</h1>
            </div>
            <button onClick={() => setPageView('checkout')} className="relative p-2 text-white hover:bg-white/10 rounded-lg transition">
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[20px] h-5 rounded-full text-[10px] font-bold flex items-center justify-center px-1" style={{ backgroundColor: 'white', color: primaryColor }}>{cartCount}</span>}
            </button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 py-6">
          {favoriteProducts.length === 0 ? (
            <div className="text-center py-16">
              <Heart className="mx-auto h-16 w-16 text-gray-200 mb-4" />
              <p className="text-gray-500 font-semibold text-lg mb-2">Nenhum favorito ainda</p>
              <p className="text-gray-400 text-sm mb-6">Toque no coração nos produtos para salvar seus favoritos</p>
              <button onClick={() => setPageView('store')} className="text-white font-semibold rounded-xl px-6 py-3 transition hover:opacity-90" style={{ backgroundColor: primaryColor }}>Explorar produtos</button>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-4">{favoriteProducts.length} produto{favoriteProducts.length !== 1 ? 's' : ''} favorito{favoriteProducts.length !== 1 ? 's' : ''}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 lg:gap-5">
                {favoriteProducts.map(p => (
                  <ProductCard key={p.id} product={p} primaryColor={primaryColor} showPrices={store.show_prices} fc={fc}
                    onClick={() => { setSelectedProduct(p); setPageView('product'); }}
                    onAddToCart={() => addToCart(p)}
                    isFavorite={true}
                    onToggleFavorite={() => toggleFavorite(p.id)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
        {cartCount > 0 && (
          <button onClick={() => setPageView('checkout')} className="fixed bottom-4 right-4 flex items-center gap-2 text-white font-bold rounded-full px-5 py-3.5 shadow-2xl z-50 hover:scale-105 transition-all" style={{ backgroundColor: primaryColor }}>
            <ShoppingCart className="h-5 w-5" /> {cartCount} {cartCount === 1 ? 'item' : 'itens'} <span className="ml-1 bg-white/20 rounded-full px-2.5 py-0.5 text-sm">{fc(cartTotal)}</span>
          </button>
        )}
      </div>
    );
  }

  // ===================== CATALOG (VER TODOS) =====================
  if (pageView === 'catalog') {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="sticky top-0 z-50 shadow-md" style={{ backgroundColor: primaryColor }}>
          <div className="max-w-7xl mx-auto px-3 py-2 flex items-center gap-2">
            <button onClick={() => setPageView('store')} className="p-2 text-white hover:bg-white/10 rounded-lg transition"><ArrowLeft className="h-5 w-5" /></button>
            <div className="flex-1 flex items-center justify-center gap-2">
              {store.logo_url?.includes('conecta-mix') ? <ConectaMixLogo size="sm" /> : store.logo_url ? <img src={store.logo_url} alt={store.name} className="h-8 object-contain" /> : <h1 className="text-white font-bold text-lg">{store.name}</h1>}
            </div>
            <button onClick={() => setPageView('checkout')} className="relative p-2 text-white hover:bg-white/10 rounded-lg transition">
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[20px] h-5 rounded-full text-[10px] font-bold flex items-center justify-center px-1" style={{ backgroundColor: 'white', color: primaryColor }}>{cartCount}</span>}
            </button>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="bg-white border-b px-4 py-3 space-y-3">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
              <input type="text" placeholder="Buscar produtos..." value={search} onChange={e => { setSearch(e.target.value); setCatalogPage(0); }} className="flex-1 bg-transparent border-0 outline-none text-sm px-4 py-3 text-gray-700 placeholder:text-gray-400" />
              {search ? <button onClick={() => setSearch('')} className="pr-3"><X className="h-4 w-4 text-gray-400" /></button> : <div className="pr-3"><Search className="h-4 w-4 text-gray-400" /></div>}
            </div>
          </div>
          <div className="max-w-7xl mx-auto flex flex-wrap gap-2 items-center">
            <button onClick={() => { setCatalogCategory('all'); setCatalogPage(0); }} className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${catalogCategory === 'all' ? 'text-white' : 'text-gray-600 border-gray-300 bg-white'}`} style={catalogCategory === 'all' ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}>
              Todos
            </button>
            {productCategories.map(cat => (
              <button key={cat} onClick={() => { setCatalogCategory(cat); setCatalogPage(0); }} className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${catalogCategory === cat ? 'text-white' : 'text-gray-600 border-gray-300 bg-white'}`} style={catalogCategory === cat ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}>
                {cat}
              </button>
            ))}
            <select value={catalogSort} onChange={e => { setCatalogSort(e.target.value); setCatalogPage(0); }} className="ml-auto text-xs border rounded-lg px-2 py-1.5 bg-white text-gray-600">
              <option value="name">A-Z</option>
              <option value="price_asc">Menor preço</option>
              <option value="price_desc">Maior preço</option>
            </select>
          </div>
        </div>

        {/* Product grid */}
        <div className="max-w-7xl mx-auto px-4 py-6">
          <p className="text-xs text-gray-500 mb-4">{catalogProducts.length} produto{catalogProducts.length !== 1 ? 's' : ''} encontrado{catalogProducts.length !== 1 ? 's' : ''}</p>
          {catalogPageProducts.length === 0 ? (
            <div className="text-center py-16"><ShoppingBag className="mx-auto h-14 w-14 text-gray-200 mb-3" /><p className="text-gray-500 font-medium">Nenhum produto encontrado</p></div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 lg:gap-5">
              {catalogPageProducts.map(p => <ProductCard key={p.id} product={p} primaryColor={primaryColor} showPrices={store.show_prices} fc={fc} onClick={() => { setSelectedProduct(p); setPageView('product'); }} onAddToCart={() => addToCart(p)} isFavorite={isFavorite(p.id)} onToggleFavorite={() => toggleFavorite(p.id)} />)}
            </div>
          )}

          {catalogTotalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button disabled={catalogPage === 0} onClick={() => setCatalogPage(p => p - 1)} className="px-4 py-2 rounded-lg border text-sm font-semibold disabled:opacity-40 hover:bg-gray-100 transition">← Anterior</button>
              <span className="text-sm text-gray-500">Página {catalogPage + 1} de {catalogTotalPages}</span>
              <button disabled={catalogPage >= catalogTotalPages - 1} onClick={() => setCatalogPage(p => p + 1)} className="px-4 py-2 rounded-lg border text-sm font-semibold disabled:opacity-40 hover:bg-gray-100 transition">Próxima →</button>
            </div>
          )}
        </div>

        {cartCount > 0 && (
          <button onClick={() => setPageView('checkout')} className="fixed bottom-4 right-4 flex items-center gap-2 text-white font-bold rounded-full px-5 py-3.5 shadow-2xl z-50 hover:scale-105 transition-all" style={{ backgroundColor: primaryColor }}>
            <ShoppingCart className="h-5 w-5" /> {cartCount} {cartCount === 1 ? 'item' : 'itens'} <span className="ml-1 bg-white/20 rounded-full px-2.5 py-0.5 text-sm">{fc(cartTotal)}</span>
          </button>
        )}
      </div>
    );
  }

  if (pageView === 'checkout') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="sticky top-0 z-50 bg-white border-b shadow-sm">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
            <button onClick={() => {
              if (checkoutStep === 'cart') setPageView('store');
              else if (checkoutStep === 'address') setCheckoutStep('cart');
              else if (checkoutStep === 'confirm') setCheckoutStep('address');
              else { setPageView('store'); setCheckoutStep('cart'); setOrderResult(null); }
            }} className="p-2 rounded-full hover:bg-gray-100"><ArrowLeft className="h-5 w-5 text-gray-700" /></button>
            <h1 className="font-bold text-gray-800 flex-1">
              {checkoutStep === 'cart' && 'Meu Carrinho'}
              {checkoutStep === 'address' && 'Seus Dados'}
              {checkoutStep === 'confirm' && 'Confirmar Pedido'}
              {checkoutStep === 'success' && 'Pedido Realizado!'}
            </h1>
          </div>
          {checkoutStep !== 'success' && (
            <div className="max-w-2xl mx-auto px-4 pb-3 flex gap-1">
              {['cart', 'address', 'confirm'].map((step, i) => (
                <div key={step} className="flex-1 h-1.5 rounded-full transition-colors" style={{ backgroundColor: i <= ['cart', 'address', 'confirm'].indexOf(checkoutStep) ? primaryColor : '#e5e7eb' }} />
              ))}
            </div>
          )}
        </div>
        <div className="max-w-2xl mx-auto px-4 py-6">
          {checkoutStep === 'success' && orderResult && (
            <div className="text-center py-12 space-y-4">
              <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center bg-emerald-50"><CheckCircle2 className="h-10 w-10 text-emerald-600" /></div>
              <h2 className="text-2xl font-bold text-gray-900">Pedido #{orderResult.order_number}</h2>
              <p className="text-gray-600">Seu pedido foi recebido com sucesso!</p>
              <p className="text-3xl font-extrabold" style={{ color: primaryColor }}>{fc(orderResult.total)}</p>
              <p className="text-sm text-gray-500">Entraremos em contato pelo WhatsApp para confirmar.</p>
              {store.show_whatsapp_button && store.whatsapp_number && (
                <button onClick={() => openWhatsApp(`Pedido #${orderResult.order_number}`)} className="inline-flex items-center gap-2 text-white font-semibold rounded-xl px-6 py-3" style={{ backgroundColor: '#25D366' }}><WhatsAppIcon /> Falar no WhatsApp</button>
              )}
              <div><button onClick={() => { setPageView('store'); setCheckoutStep('cart'); setOrderResult(null); }} className="mt-4 text-sm font-semibold underline" style={{ color: primaryColor }}>Voltar à loja</button></div>
            </div>
          )}
          {checkoutStep === 'cart' && (
            <div className="space-y-4">
              {cart.length === 0 ? (
                <div className="text-center py-16"><ShoppingCart className="mx-auto h-16 w-16 text-gray-200 mb-3" /><p className="text-gray-500 font-medium">Seu carrinho está vazio</p><button onClick={() => setPageView('store')} className="mt-4 text-sm font-semibold" style={{ color: primaryColor }}>Continuar comprando</button></div>
              ) : (
                <>
                  {cart.map(item => {
                    const unit = getEffectivePrice(item.product, item.variant);
                    const variantLabel = item.variant ? Object.values(item.variant.attributes || {}).filter(Boolean).join(' / ') : '';
                    const thumb = item.variant?.images?.[0] || item.product.image_url;
                    const itemKey = `${item.product.id}|${item.variant?.id || ''}`;
                    return (
                      <div key={itemKey} className="bg-white rounded-2xl border p-4 flex gap-3">
                        <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                          {thumb ? <img src={thumb} alt="" className="w-full h-full object-cover" /> : <ShoppingBag className="w-8 h-8 text-gray-300 m-auto mt-6" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-gray-800 line-clamp-2">{item.product.name}</h3>
                          {variantLabel && <p className="text-[11px] text-gray-500 mt-0.5">{variantLabel}</p>}
                          <p className="text-base font-bold mt-1" style={{ color: primaryColor }}>{fc(unit)}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <button onClick={() => updateCartQty(item.product.id, item.variant?.id, -1)} className="w-8 h-8 rounded-full border flex items-center justify-center hover:bg-gray-50"><Minus className="h-3 w-3" /></button>
                            <span className="font-semibold text-sm w-8 text-center">{item.qty}</span>
                            <button onClick={() => updateCartQty(item.product.id, item.variant?.id, 1)} className="w-8 h-8 rounded-full border flex items-center justify-center hover:bg-gray-50"><Plus className="h-3 w-3" /></button>
                            <button onClick={() => removeFromCart(item.product.id, item.variant?.id)} className="ml-auto p-2 text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </div>
                        <div className="text-right"><p className="text-sm font-bold text-gray-800">{fc(unit * item.qty)}</p></div>
                      </div>
                    );
                  })}
                  <div className="bg-white rounded-2xl border p-4 space-y-2">
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Subtotal</span><span className="font-semibold">{fc(cartSubtotal)}</span></div>
                    {deliveryFee > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">Entrega ({selectedDeliveryOption?.name})</span><span className="font-semibold">{fc(deliveryFee)}</span></div>}
                    <div className="flex justify-between text-lg font-bold"><span>Total</span><span style={{ color: primaryColor }}>{fc(cartTotal)}</span></div>
                  </div>
                  <button onClick={() => setCheckoutStep('address')} className="w-full h-14 rounded-2xl text-white font-bold text-base" style={{ backgroundColor: primaryColor }}>Continuar</button>
                </>
              )}
            </div>
          )}
          {checkoutStep === 'address' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border p-4 space-y-3">
                <h3 className="font-bold text-gray-800 flex items-center gap-2"><User className="h-4 w-4" /> Informações pessoais</h3>
                <input placeholder="Nome completo *" value={custName} onChange={e => setCustName(e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm" />
                <input placeholder="Telefone / WhatsApp *" value={custPhone} onChange={e => setCustPhone(e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm" />
                <input placeholder="CPF / CNPJ (opcional)" value={custDoc} onChange={e => setCustDoc(e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm" />
              </div>
              {/* Delivery Options */}
              {(activeDeliveryOptions.length > 0 || loadingQuotes) && (
                <div className="bg-white rounded-2xl border p-4 space-y-3">
                  <h3 className="font-bold text-gray-800 flex items-center gap-2"><Package className="h-4 w-4" /> Forma de entrega {loadingQuotes && <Loader2 className="h-3 w-3 animate-spin text-gray-400" />}</h3>
                  {(store?.live_shipping?.melhor_envio || store?.live_shipping?.uber_direct) && (addrZip || '').replace(/\D/g,'').length !== 8 && (
                    <p className="text-[11px] text-gray-500">Informe o CEP abaixo para calcular fretes em tempo real.</p>
                  )}
                  <div className="space-y-2">
                    {activeDeliveryOptions.map((opt: DeliveryOption) => (
                      <button
                        key={opt.id}
                        onClick={() => setDeliveryType(opt.id)}
                        className={`w-full flex items-center justify-between border-2 rounded-xl p-3 transition ${deliveryType === opt.id ? 'text-white' : 'text-gray-600 bg-white'}`}
                        style={deliveryType === opt.id ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
                      >
                        <div className="text-left">
                          <p className="text-sm font-semibold">{opt.name}</p>
                          {opt.description && <p className={`text-xs ${deliveryType === opt.id ? 'text-white/80' : 'text-gray-400'}`}>{opt.description}</p>}
                        </div>
                        <span className="text-sm font-bold">{opt.price > 0 ? fc(opt.price) : 'Grátis'}</span>
                      </button>
                    ))}
                  </div>
                  {selectedDeliveryOption?.provider === 'uber_direct' && (
                    <div className="rounded-xl border bg-gradient-to-br from-gray-50 to-white p-3 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                        <Zap className="h-3.5 w-3.5" /> Detalhes da entrega Uber Direct
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {selectedDeliveryOption.pickup_duration != null && (
                          <div className="rounded-lg bg-white border px-2.5 py-2">
                            <p className="text-[10px] uppercase text-gray-400">Coleta</p>
                            <p className="font-semibold text-gray-800">~{Math.max(1, Math.round(Number(selectedDeliveryOption.pickup_duration)))} min</p>
                          </div>
                        )}
                        {selectedDeliveryOption.delivery_minutes != null && (
                          <div className="rounded-lg bg-white border px-2.5 py-2">
                            <p className="text-[10px] uppercase text-gray-400">Tempo total</p>
                            <p className="font-semibold text-gray-800">~{Math.max(1, Math.round(Number(selectedDeliveryOption.delivery_minutes)))} min</p>
                          </div>
                        )}
                        {selectedDeliveryOption.dropoff_eta && (
                          <div className="rounded-lg bg-white border px-2.5 py-2 col-span-2">
                            <p className="text-[10px] uppercase text-gray-400">Previsão de chegada</p>
                            <p className="font-semibold text-gray-800">{new Date(selectedDeliveryOption.dropoff_eta).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</p>
                          </div>
                        )}
                      </div>
                      <div className="border-t pt-2">
                        <p className="text-[10px] uppercase text-gray-400 mb-1">Composição da taxa de entrega</p>
                        {(selectedDeliveryOption.fee_breakdown && selectedDeliveryOption.fee_breakdown.length > 0
                          ? selectedDeliveryOption.fee_breakdown
                          : [{ label: 'Taxa de coleta e entrega', amount: selectedDeliveryOption.price }]
                        ).map((b, i) => (
                          <div key={i} className="flex justify-between text-xs py-0.5">
                            <span className="text-gray-600">{b.label}</span>
                            <span className="font-medium text-gray-800">{fc(b.amount)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between text-xs pt-1 mt-1 border-t font-bold">
                          <span className="text-gray-800">Total da entrega</span>
                          <span style={{ color: primaryColor }}>{fc(selectedDeliveryOption.price)}</span>
                        </div>
                      </div>
                      {selectedDeliveryOption.expires && (
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] text-gray-400 italic">Cotação válida até {new Date(selectedDeliveryOption.expires).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · renovada automaticamente</p>
                          {(loadingQuotes && quoteRefreshTick > 0) && <span className="text-[10px] text-gray-500 flex items-center gap-1"><Loader2 className="h-2.5 w-2.5 animate-spin" /> atualizando…</span>}
                          {quoteJustRefreshed && <span className="text-[10px] text-emerald-600 font-semibold">✓ atualizada</span>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {/* Address - only show if delivery type requires it */}
              {deliveryType !== 'pickup' && (
                <div className="bg-white rounded-2xl border p-4 space-y-3">
                  <h3 className="font-bold text-gray-800 flex items-center gap-2"><MapPin className="h-4 w-4" /> Endereço de entrega</h3>
                  <input placeholder="CEP" value={addrZip} onChange={e => setAddrZip(e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm" />
                  <input placeholder="Rua / Avenida *" value={addrStreet} onChange={e => setAddrStreet(e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm" />
                  <div className="grid grid-cols-3 gap-2">
                    <input placeholder="Nº" value={addrNumber} onChange={e => setAddrNumber(e.target.value)} className="border rounded-xl px-4 py-3 text-sm" />
                    <input placeholder="Complemento" value={addrComplement} onChange={e => setAddrComplement(e.target.value)} className="col-span-2 border rounded-xl px-4 py-3 text-sm" />
                  </div>
                  <input placeholder="Bairro" value={addrNeighborhood} onChange={e => setAddrNeighborhood(e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm" />
                  <div className="grid grid-cols-3 gap-2">
                    <input placeholder="Cidade *" value={addrCity} onChange={e => setAddrCity(e.target.value)} className="col-span-2 border rounded-xl px-4 py-3 text-sm" />
                    <input placeholder="UF" value={addrState} onChange={e => setAddrState(e.target.value)} maxLength={2} className="border rounded-xl px-4 py-3 text-sm uppercase" />
                  </div>
                </div>
              )}
              {/* Coupon */}
              <div className="bg-white rounded-2xl border p-4 space-y-2">
                <h3 className="font-bold text-gray-800 text-sm">Cupom de desconto</h3>
                {couponApplied ? (
                  <div className="flex items-center justify-between rounded-xl border-2 border-dashed px-3 py-2" style={{ borderColor: primaryColor }}>
                    <div>
                      <p className="font-bold text-sm" style={{ color: primaryColor }}>{couponApplied.code}</p>
                      <p className="text-xs text-gray-600">-{fc(couponApplied.discount)} {couponApplied.description ? `· ${couponApplied.description}` : ''}</p>
                    </div>
                    <button onClick={clearCoupon} className="text-xs text-gray-500 hover:text-red-600 underline">Remover</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      placeholder="Digite seu cupom"
                      value={couponCode}
                      onChange={e => setCouponCode(e.target.value.toUpperCase())}
                      className="flex-1 border rounded-xl px-4 py-3 text-sm uppercase"
                    />
                    <button onClick={applyCoupon} disabled={couponValidating} className="px-4 rounded-xl text-white font-semibold text-sm disabled:opacity-60" style={{ backgroundColor: primaryColor }}>
                      {couponValidating ? '...' : 'Aplicar'}
                    </button>
                  </div>
                )}
                <p className="text-[11px] text-gray-500">Cupom é pessoal e válido apenas para o cliente vinculado (uso único).</p>
              </div>
              {/* Payment Methods */}
              <div className="bg-white rounded-2xl border p-4 space-y-3">
                <h3 className="font-bold text-gray-800">Forma de pagamento</h3>
                <div className={`grid gap-2 ${activePaymentMethods.length <= 3 ? `grid-cols-${activePaymentMethods.length}` : 'grid-cols-2'}`}>
                  {(activePaymentMethods.length > 0 ? activePaymentMethods : [{ id: 'pix', name: 'PIX', icon: 'pix', is_active: true }, { id: 'card', name: 'Cartão', icon: 'card', is_active: true }, { id: 'cash', name: 'Dinheiro', icon: 'cash', is_active: true }]).map((o: PaymentMethodOption) => (
                    <button key={o.id} onClick={() => setPayPref(o.id)} className={`border-2 rounded-xl py-3 text-sm font-semibold transition flex items-center justify-center gap-2 ${payPref === o.id ? 'text-white' : 'text-gray-600 bg-white'}`} style={payPref === o.id ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}>
                      <PaymentIcon method={o.id || o.icon} active={payPref === o.id} color={primaryColor} /> {o.name}
                    </button>
                  ))}
                </div>
                <textarea placeholder="Observações (opcional)" value={custNotes} onChange={e => setCustNotes(e.target.value)} rows={2} className="w-full border rounded-xl px-4 py-3 text-sm resize-none" />
              </div>
              <button onClick={() => {
                if (!custName || !custPhone) { toast.error('Preencha nome e telefone'); return; }
                if (deliveryType !== 'pickup' && (!addrStreet || !addrCity)) { toast.error('Preencha o endereço'); return; }
                setCheckoutStep('confirm');
              }} className="w-full h-14 rounded-2xl text-white font-bold text-base" style={{ backgroundColor: primaryColor }}>Revisar Pedido</button>
            </div>
          )}
          {checkoutStep === 'confirm' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border p-4 space-y-2">
                <h3 className="font-bold text-gray-800 mb-2">Resumo do pedido</h3>
                {cart.map(item => {
                  const variantLabel = item.variant ? Object.values(item.variant.attributes || {}).filter(Boolean).join(' / ') : '';
                  return (
                    <div key={`${item.product.id}|${item.variant?.id || ''}`} className="flex justify-between text-sm py-2 border-b last:border-0">
                      <span className="text-gray-700">{item.qty}x {item.product.name}{variantLabel ? ` (${variantLabel})` : ''}</span>
                      <span className="font-semibold">{fc(getEffectivePrice(item.product, item.variant) * item.qty)}</span>
                    </div>
                  );
                })}
                <div className="flex justify-between text-sm pt-2"><span className="text-gray-500">Subtotal</span><span className="font-semibold">{fc(cartSubtotal)}</span></div>
                {couponApplied && <div className="flex justify-between text-sm text-green-600"><span>Cupom {couponApplied.code}</span><span className="font-semibold">-{fc(couponApplied.discount)}</span></div>}
                {deliveryFee > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">Entrega</span><span className="font-semibold">{fc(deliveryFee)}</span></div>}
                <div className="flex justify-between text-lg font-bold pt-1"><span>Total</span><span style={{ color: primaryColor }}>{fc(cartTotal)}</span></div>
              </div>
              <div className="bg-white rounded-2xl border p-4 space-y-1 text-sm">
                <h3 className="font-bold text-gray-800 mb-2">{selectedDeliveryOption?.name || 'Entrega'}</h3>
                <p className="text-gray-700">{custName} • {custPhone}</p>
                {deliveryType !== 'pickup' && (
                  <>
                    <p className="text-gray-500">{addrStreet}, {addrNumber} {addrComplement ? `- ${addrComplement}` : ''}</p>
                    <p className="text-gray-500">{addrNeighborhood} - {addrCity}/{addrState} {addrZip}</p>
                  </>
                )}
              </div>
              <div className="bg-white rounded-2xl border p-4 text-sm">
                <p className="text-gray-500">Pagamento: <span className="font-semibold text-gray-800">{activePaymentMethods.find((m: PaymentMethodOption) => m.id === payPref)?.name || payPref}</span></p>
              </div>

              {pendingSale && store?.mercado_pago ? (
                <MercadoPagoStorefrontCheckout
                  mp={store.mercado_pago}
                  storeId={store.id || ''}
                  saleId={pendingSale.sale_id}
                  amount={pendingSale.total}
                  payerEmail={`pedido${pendingSale.order_number}@typoserp.com.br`}
                  payerDocument={custDoc}
                  primaryColor={primaryColor}
                  onApproved={onMpApproved}
                />
              ) : (
                <button onClick={placeOrder} disabled={placing} className="w-full h-14 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 disabled:opacity-60" style={{ backgroundColor: primaryColor }}>
                  {placing ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                  {placing ? 'Finalizando...' : (mpCanHandleSelected ? 'Continuar para pagamento' : 'Finalizar Pedido')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ===================== PRODUCT DETAIL =====================
  if (pageView === 'product' && selectedProduct) {
    const variants = selectedProduct.variants || [];
    const hasVariants = variants.length > 0;
    const activeVariant = hasVariants
      ? (variants.find(v => v.id === selectedVariantId) || null)
      : null;

    const isPromo = !activeVariant && selectedProduct.promo_price && selectedProduct.promo_ends_at && new Date() < new Date(selectedProduct.promo_ends_at) && (!selectedProduct.promo_starts_at || new Date() >= new Date(selectedProduct.promo_starts_at));
    const basePrice = isPromo ? selectedProduct.promo_price! : selectedProduct.price_default;
    const effectivePrice = activeVariant ? activeVariant.price : basePrice;

    // Build gallery: each entry tagged with optional variantId
    const galleryEntries: { url: string; variantId: string | null }[] = [];
    const seen = new Set<string>();
    if (selectedProduct.image_url && !seen.has(selectedProduct.image_url)) {
      galleryEntries.push({ url: selectedProduct.image_url, variantId: null });
      seen.add(selectedProduct.image_url);
    }
    for (const url of selectedProduct.gallery || []) {
      if (url && !seen.has(url)) { galleryEntries.push({ url, variantId: null }); seen.add(url); }
    }
    for (const v of variants) {
      for (const url of v.images || []) {
        if (url && !seen.has(url)) { galleryEntries.push({ url, variantId: v.id }); seen.add(url); }
      }
    }
    const safeIdx = Math.min(selectedImageIdx, Math.max(0, galleryEntries.length - 1));
    const currentEntry = galleryEntries[safeIdx];
    const currentImage = currentEntry?.url;

    const availableQty = activeVariant ? activeVariant.qty_available : selectedProduct.qty_available;
    const inStock = availableQty > 0;

    // Variant attribute groups (ex: { Cor: ['Vermelho','Azul'], Tamanho: ['P','M'] })
    const attrGroups: Record<string, { value: string; variant: CatalogVariant }[]> = {};
    if (hasVariants) {
      for (const v of variants) {
        for (const [name, value] of Object.entries(v.attributes || {})) {
          if (!value) continue;
          if (!attrGroups[name]) attrGroups[name] = [];
          if (!attrGroups[name].some(x => x.value === value)) {
            attrGroups[name].push({ value: String(value), variant: v });
          }
        }
      }
    }

    const selectVariant = (v: CatalogVariant) => {
      setSelectedVariantId(v.id);
      const firstImgIdx = galleryEntries.findIndex(e => e.variantId === v.id);
      if (firstImgIdx >= 0) setSelectedImageIdx(firstImgIdx);
    };

    const onChangeImage = (newIdx: number) => {
      setSelectedImageIdx(newIdx);
      const entry = galleryEntries[newIdx];
      if (entry?.variantId && entry.variantId !== selectedVariantId) {
        setSelectedVariantId(entry.variantId);
      }
    };

    // Price display: show range if variants have different prices
    const priceMin = selectedProduct.price_min ?? null;
    const priceMax = selectedProduct.price_max ?? null;
    const showRange = hasVariants && !activeVariant && priceMin !== null && priceMax !== null && priceMin !== priceMax;

    return (
      <div className="min-h-screen bg-white">
        <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
            <button onClick={() => { setSelectedProduct(null); setSelectedImageIdx(0); setPageView('store'); }} className="p-2 rounded-full hover:bg-gray-100"><ArrowLeft className="h-5 w-5 text-gray-700" /></button>
            {store.logo_url && <img src={store.logo_url} alt="" className="max-h-8 max-w-[120px] object-contain" />}
            <span className="font-semibold text-gray-800 truncate flex-1">{store.name}</span>
            <button onClick={() => setPageView('checkout')} className="relative p-2">
              <ShoppingCart className="h-5 w-5 text-gray-700" />
              {cartCount > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center" style={{ backgroundColor: primaryColor }}>{cartCount}</span>}
            </button>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-10">
            <div className="space-y-3">
              <div className="aspect-square rounded-3xl overflow-hidden bg-gray-50 border relative group">
                {currentImage ? (
                  <ZoomableImage src={currentImage} alt={selectedProduct.name} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="h-20 w-20 text-gray-200" /></div>
                )}
                {galleryEntries.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => onChangeImage((safeIdx - 1 + galleryEntries.length) % galleryEntries.length)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/90 backdrop-blur shadow-md flex items-center justify-center hover:bg-white transition opacity-0 group-hover:opacity-100 z-20"
                      aria-label="Imagem anterior"
                    >
                      <ArrowLeft className="h-4 w-4 text-gray-700" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeImage((safeIdx + 1) % galleryEntries.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/90 backdrop-blur shadow-md flex items-center justify-center hover:bg-white transition opacity-0 group-hover:opacity-100 z-20"
                      aria-label="Próxima imagem"
                    >
                      <ArrowLeft className="h-4 w-4 text-gray-700 rotate-180" />
                    </button>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-20 pointer-events-none">
                      {galleryEntries.map((_, i) => (
                        <span
                          key={i}
                          className={`h-1.5 rounded-full transition-all ${i === safeIdx ? 'w-6 bg-white' : 'w-1.5 bg-white/60'}`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
              {galleryEntries.length > 1 && (
                <div className="grid grid-cols-5 gap-2">
                  {galleryEntries.map((entry, i) => (
                    <button
                      key={entry.url + i}
                      type="button"
                      onClick={() => onChangeImage(i)}
                      className={`aspect-square rounded-xl overflow-hidden border-2 transition-all ${i === safeIdx ? 'opacity-100' : 'opacity-60 hover:opacity-100 border-transparent'}`}
                      style={i === safeIdx ? { borderColor: primaryColor } : undefined}
                      aria-label={`Imagem ${i + 1}`}
                    >
                      <img src={entry.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-4">
              {selectedProduct.brand && <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full bg-gray-100 text-gray-600">{selectedProduct.brand}</span>}
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{selectedProduct.name}</h1>
              {selectedProduct.category && <span className="text-xs text-gray-500">{selectedProduct.category}</span>}
              {store.show_prices && (
                <div className="space-y-1">
                  {isPromo && <span className="text-base text-gray-400 line-through">{fc(selectedProduct.price_default)}</span>}
                  {showRange ? (
                    <p className="text-3xl font-extrabold" style={{ color: primaryColor }}>
                      {fc(priceMin!)} <span className="text-gray-400 font-bold">–</span> {fc(priceMax!)}
                    </p>
                  ) : (
                    <p className="text-3xl font-extrabold" style={{ color: isPromo ? '#dc2626' : primaryColor }}>{fc(effectivePrice)}</p>
                  )}
                  {hasVariants && !activeVariant && !showRange && (
                    <span className="text-xs text-gray-500">Selecione uma opção</span>
                  )}
                  {hasVariants && !activeVariant && showRange && (
                    <span className="text-xs text-gray-500">Preço varia conforme a opção</span>
                  )}
                </div>
              )}

              {/* Variant selectors */}
              {hasVariants && Object.keys(attrGroups).length > 0 && (
                <div className="space-y-3 pt-1">
                  {Object.entries(attrGroups).map(([attrName, options]) => {
                    const activeValue = activeVariant?.attributes?.[attrName];
                    return (
                      <div key={attrName}>
                        <div className="text-xs font-semibold text-gray-700 mb-1.5">
                          {attrName}{activeValue && <span className="text-gray-500 font-normal">: {activeValue}</span>}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {options.map(opt => {
                            const active = activeValue === opt.value;
                            const out = opt.variant.qty_available <= 0;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => selectVariant(opt.variant)}
                                disabled={out}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${active ? 'text-white' : 'bg-white text-gray-700 hover:border-gray-400'} ${out ? 'opacity-40 line-through cursor-not-allowed' : ''}`}
                                style={active ? { backgroundColor: primaryColor, borderColor: primaryColor } : { borderColor: '#e5e7eb' }}
                              >
                                {opt.value}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {selectedProduct.description && <p className="text-sm text-gray-600 leading-relaxed">{selectedProduct.description}</p>}
              <div className="flex items-center gap-3 text-sm">
                <span className={`inline-flex items-center gap-1.5 font-semibold ${inStock ? 'text-emerald-600' : 'text-red-500'}`}>
                  <div className={`w-2 h-2 rounded-full ${inStock ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  {inStock ? `Em estoque${activeVariant ? ` (${availableQty})` : ''}` : 'Indisponível'}
                </span>
                {(activeVariant?.sku || selectedProduct.sku) && <span className="text-gray-400">SKU: {activeVariant?.sku || selectedProduct.sku}</span>}
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    if (hasVariants && !activeVariant) { toast.error('Selecione uma variação'); return; }
                    addToCart(selectedProduct, activeVariant);
                  }}
                  disabled={!inStock}
                  className="flex-1 h-14 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 disabled:opacity-40 transition hover:opacity-90"
                  style={{ backgroundColor: primaryColor }}
                >
                  <ShoppingCart className="h-5 w-5" /> Adicionar ao carrinho
                </button>
                <button
                  onClick={() => toggleFavorite(selectedProduct.id)}
                  className={`h-14 px-5 rounded-2xl border-2 flex items-center justify-center transition-all ${isFavorite(selectedProduct.id) ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200 hover:border-red-200 hover:bg-red-50'}`}
                >
                  <Heart className={`h-6 w-6 transition-all ${isFavorite(selectedProduct.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
                </button>
                {store.show_whatsapp_button && store.whatsapp_number && (
                  <button onClick={() => openWhatsApp(selectedProduct.name)} className="h-14 px-5 rounded-2xl text-white flex items-center justify-center" style={{ backgroundColor: '#25D366' }}>
                    <WhatsAppIcon size={22} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Related Products */}
          {(() => {
            const related = products.filter(p =>
              p.id !== selectedProduct.id &&
              p.qty_available > 0 &&
              (p.category === selectedProduct.category || p.brand === selectedProduct.brand)
            ).slice(0, 8);
            if (related.length === 0) return null;
            return (
              <div className="mt-10 lg:mt-14 border-t pt-8">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-5">Produtos Relacionados</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 lg:gap-5">
                  {related.map(p => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      primaryColor={primaryColor}
                      showPrices={store.show_prices}
                      fc={fc}
                      onClick={() => { setSelectedProduct(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      onAddToCart={() => addToCart(p)}
                      isFavorite={isFavorite(p.id)}
                      onToggleFavorite={() => toggleFavorite(p.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    );
  }

  // ===================== MAIN STOREFRONT =====================
  return (
    <div className="min-h-screen bg-white">
      {/* ===== SIDEBAR DRAWER (mobile only — on desktop categories are in navbar) ===== */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-[100]">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[80%] max-w-[320px] bg-white shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
            <div className="flex items-center gap-3 px-4 py-4 border-b" style={{ backgroundColor: `${primaryColor}08` }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${primaryColor}20` }}>
                <User className="h-5 w-5" style={{ color: primaryColor }} />
              </div>
              <span className="font-bold text-gray-800 flex-1">Minha conta</span>
              <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-full hover:bg-gray-100"><X className="h-5 w-5 text-gray-500" /></button>
            </div>
            <div className="px-4 py-3 border-b">
              <div className="flex items-center bg-gray-100 rounded-xl overflow-hidden">
                <input
                  type="text" placeholder="Digite o que está procurando"
                  value={search} onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && search) setSidebarOpen(false); }}
                  className="flex-1 bg-transparent border-0 outline-none text-sm px-4 py-3 text-gray-700 placeholder:text-gray-400"
                />
                <button onClick={() => { if (search) setSidebarOpen(false); }} className="pr-3"><Search className="h-4 w-4 text-gray-400" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {/* Header menu items with icons */}
              {(() => {
                const mobileMenu = store.header_menu?.length > 0 ? store.header_menu : getDefaultMenu(store.menu_theme);
                return mobileMenu.map((item, idx) => (
                  <MobileSidebarMenuItem key={idx} item={item} primaryColor={primaryColor} onNavigate={(cat) => { navigateToCategory(cat); setSidebarOpen(false); }} />
                ));
              })()}
              <button onClick={() => { setCatalogCategory('all'); setCatalogPage(0); setPageView('catalog'); setSidebarOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 hover:bg-gray-50 transition text-left">
                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${primaryColor}15` }}><Store className="h-4 w-4" style={{ color: primaryColor }} /></div>
                <span className="font-semibold text-sm flex-1" style={{ color: primaryColor }}>Ver Todos os Produtos</span>
                <ChevronRight className="h-4 w-4 text-gray-300" />
              </button>
              <button onClick={() => { setPageView('myorders'); setSidebarOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 hover:bg-gray-50 transition text-left">
                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-gray-100"><Package className="h-4 w-4 text-gray-500" /></div>
                <span className="font-semibold text-sm text-gray-700 flex-1">Meus Pedidos</span>
                <ChevronRight className="h-4 w-4 text-gray-300" />
              </button>
              <button onClick={() => { setPageView('favorites'); setSidebarOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 hover:bg-gray-50 transition text-left">
                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-red-50"><Heart className="h-4 w-4 text-red-500" /></div>
                <span className="font-semibold text-sm text-gray-700 flex-1">Meus Favoritos</span>
                {favCount > 0 && <span className="min-w-[22px] h-[22px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">{favCount}</span>}
                <ChevronRight className="h-4 w-4 text-gray-300" />
              </button>
            </div>
          </div>
        </div>
      )}



      {/* ===== HEADER ===== */}
      <header className="sticky top-0 z-50 shadow-lg" style={{ backgroundColor: primaryColor }}>
        {/* Desktop top utility bar */}
        <div className="hidden lg:block text-white text-[11px] tracking-wide border-b border-white/15" style={{ backgroundColor: adjustColor(primaryColor, -25) }}>
          <div className="max-w-7xl mx-auto px-6 py-1.5 flex items-center justify-between">
            <div className="flex items-center gap-5">
              {store.footer_phone && (
                <span className="flex items-center gap-1.5 opacity-90"><Phone className="h-3 w-3" /> {store.footer_phone}</span>
              )}
              {store.footer_email && (
                <span className="flex items-center gap-1.5 opacity-90"><Mail className="h-3 w-3" /> {store.footer_email}</span>
              )}
            </div>
            <div className="flex items-center gap-5">
              <button onClick={() => setPageView('myorders')} className="flex items-center gap-1.5 opacity-90 hover:opacity-100 transition font-medium">
                <ClipboardList className="h-3 w-3" /> Meus Pedidos
              </button>
              {store.show_whatsapp_button && store.whatsapp_number && (
                <button onClick={() => openWhatsApp()} className="flex items-center gap-1.5 opacity-90 hover:opacity-100 transition font-medium">
                  <WhatsAppIcon size={12} /> WhatsApp
                </button>
              )}
            </div>
          </div>
        </div>
        {/* Main header row */}
        <div className="max-w-7xl mx-auto px-3 lg:px-6 py-2 lg:py-4 flex items-center gap-3 lg:gap-6">
          {/* Mobile hamburger */}
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 text-white hover:bg-white/10 rounded-lg transition">
            <Menu className="h-6 w-6" />
          </button>

          {/* Logo */}
          <div className="flex-1 lg:flex-none flex items-center justify-center lg:justify-start">
            {store.logo_url?.includes('conecta-mix') ? (
              <ConectaMixLogo size="hero" className="lg:mr-3" />
            ) : store.logo_url ? (
              <img src={store.logo_url} alt={store.name} className="h-20 sm:h-24 lg:h-28 max-w-[260px] sm:max-w-[320px] lg:max-w-[400px] object-contain drop-shadow-lg" />
            ) : (
              <h1 className="text-white font-bold text-lg lg:text-2xl tracking-tight">{store.name}</h1>
            )}
          </div>

          {/* Desktop search bar */}
          <div className="hidden lg:flex flex-1 min-w-0 max-w-[44rem]">
            <div className="flex items-center bg-white rounded-xl overflow-hidden w-full shadow-sm border border-white/30">
              <input
                type="text" placeholder="Digite o que está procurando"
                value={search} onChange={e => setSearch(e.target.value)}
                className="flex-1 bg-transparent border-0 outline-none text-sm px-5 py-3.5 text-gray-700 placeholder:text-gray-400"
              />
              {search ? (
                <button onClick={() => setSearch('')} className="px-3 hover:bg-gray-50 h-full transition"><X className="h-4 w-4 text-gray-400" /></button>
              ) : (
                <button className="px-6 py-3.5 text-white flex items-center justify-center transition hover:opacity-90 rounded-r-xl" style={{ backgroundColor: adjustColor(primaryColor, -15) }}>
                  <Search className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>

          {/* Desktop nav icons */}
          <div className="hidden lg:flex items-center gap-2 ml-auto">
            <button onClick={() => { setCatalogCategory('all'); setCatalogPage(0); setPageView('catalog'); }} className="flex flex-col items-center justify-center gap-1 text-white/85 hover:text-white w-16 py-1.5 rounded-xl transition hover:bg-white/10">
              <Grid3X3 className="h-6 w-6" />
              <span className="text-[10px] font-semibold leading-none">Produtos</span>
            </button>
            <button onClick={() => setPageView('myorders')} className="flex flex-col items-center justify-center gap-1 text-white/85 hover:text-white w-16 py-1.5 rounded-xl transition hover:bg-white/10">
              <ClipboardList className="h-6 w-6" />
              <span className="text-[10px] font-semibold leading-none">Pedidos</span>
            </button>
            <button onClick={() => setPageView('favorites')} className="relative flex flex-col items-center justify-center gap-1 text-white/85 hover:text-white w-16 py-1.5 rounded-xl transition hover:bg-white/10">
              <Heart className="h-6 w-6" />
              <span className="text-[10px] font-semibold leading-none">Favoritos</span>
              {favCount > 0 && <span className="absolute -top-0.5 right-1 min-w-[18px] h-[18px] rounded-full text-[9px] font-bold flex items-center justify-center px-1 bg-red-500 text-white">{favCount}</span>}
            </button>
          </div>

          {/* Cart button */}
          <button onClick={() => setPageView('checkout')} className="relative flex flex-col items-center justify-center gap-1 p-2 lg:px-3 lg:py-1.5 text-white rounded-xl transition hover:bg-white/10 lg:ml-1 lg:bg-white/10 lg:border lg:border-white/20">
            <ShoppingCart className="h-6 w-6 lg:h-7 lg:w-7" />
            <span className="hidden lg:block text-[10px] font-semibold leading-none">Carrinho</span>
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] rounded-full text-[11px] font-bold flex items-center justify-center px-1 shadow-md" style={{ backgroundColor: '#ff5722', color: 'white' }}>{cartCount}</span>
            )}
          </button>
        </div>

        {/* Desktop category navbar - large icon tiles */}
        {!search && (() => {
          const menuItems = store.header_menu?.length > 0 ? store.header_menu : getDefaultMenu(store.menu_theme);
          return (
          <div className="hidden lg:block border-t border-white/20" style={{ backgroundColor: adjustColor(primaryColor, -5) }}>
            <div className="max-w-7xl mx-auto">
              <div className="flex items-stretch justify-center">
                {menuItems.map((item, idx) => (
                  <div key={idx} className="relative group flex-1 min-w-0">
                    <button
                      onClick={() => {
                        const cat = item.category || item.name;
                        navigateToCategory(cat);
                      }}
                      className="w-full flex flex-col items-center justify-center gap-1.5 py-3 px-2 text-white/90 hover:text-white hover:bg-white/15 transition-all border-r border-white/10 last:border-r-0"
                    >
                      <MenuIcon iconKey={item.icon} />
                      <span className="text-[11px] font-semibold leading-tight text-center line-clamp-2 max-w-[90px]">{item.name}</span>
                    </button>
                    {item.children && item.children.length > 0 && (
                      <div className="absolute left-0 top-full hidden group-hover:block z-50">
                        <div className="bg-white rounded-b-xl shadow-2xl border border-t-0 py-4 px-5 min-w-[240px] max-w-[480px]">
                          <h3 className="text-sm font-bold mb-3 px-1" style={{ color: primaryColor }}>{item.name}</h3>
                          <div className={`grid gap-x-6 gap-y-0.5 ${item.children.length > 6 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                            {item.children.map((child, ci) => (
                              <button
                                key={ci}
                                onClick={() => { navigateToCategory(child.category); }}
                                className="w-full text-left px-1 py-1.5 text-sm text-gray-600 hover:text-gray-900 transition"
                                onMouseEnter={e => (e.currentTarget.style.color = primaryColor)}
                                onMouseLeave={e => (e.currentTarget.style.color = '')}
                              >
                                {child.name}
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={() => { navigateToCategory(item.category || item.name); }}
                            className="mt-3 text-sm font-semibold flex items-center gap-1 px-1"
                            style={{ color: primaryColor }}
                          >
                            Ver todos →
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          );
        })()}
      </header>

      {/* ===== MOBILE SEARCH BAR ===== */}
      <div className="lg:hidden bg-white px-4 py-2.5 border-b">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
            <input
              type="text" placeholder="Digite o que está procurando"
              value={search} onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent border-0 outline-none text-sm px-4 py-3 text-gray-700 placeholder:text-gray-400"
            />
            {search ? (
              <button onClick={() => setSearch('')} className="pr-3"><X className="h-4 w-4 text-gray-400" /></button>
            ) : (
              <div className="pr-3"><Search className="h-4 w-4 text-gray-400" /></div>
            )}
          </div>
        </div>
      </div>

      {/* ===== HERO SLIDER ===== */}
      {heroSlides.length > 0 && !search && (
        <div className="relative w-full overflow-hidden">
          <div className="flex transition-transform duration-700 ease-out" style={{ transform: `translateX(-${heroSlide * 100}%)` }}>
            {heroSlides.map((slide, i) => (
              <div
                key={i}
                className="w-full flex-shrink-0 relative cursor-pointer"
                onClick={() => slide.link && window.open(slide.link, '_blank')}
              >
                <img src={slide.image} alt={slide.title} className="w-full object-cover" style={{ height: 'clamp(220px, 40vw, 480px)' }} />
                {slide.title && (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end">
                    <div className="px-6 pb-6 lg:pb-10 lg:px-12 max-w-3xl">
                      <p className="text-white font-bold text-xl sm:text-2xl lg:text-4xl drop-shadow-lg">{slide.title}</p>
                      {i === 0 && store.hero_subtitle && <p className="text-white/80 text-sm lg:text-base mt-1 lg:mt-2">{store.hero_subtitle}</p>}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          {heroSlides.length > 1 && (
            <>
              <button onClick={() => setHeroSlide(prev => (prev - 1 + heroSlides.length) % heroSlides.length)} className="absolute left-2 lg:left-6 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-1.5 lg:p-2.5 shadow hover:bg-white transition"><ChevronLeft className="h-5 w-5 lg:h-6 lg:w-6 text-gray-700" /></button>
              <button onClick={() => setHeroSlide(prev => (prev + 1) % heroSlides.length)} className="absolute right-2 lg:right-6 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-1.5 lg:p-2.5 shadow hover:bg-white transition"><ChevronRight className="h-5 w-5 lg:h-6 lg:w-6 text-gray-700" /></button>
              <div className="absolute bottom-3 lg:bottom-5 left-1/2 -translate-x-1/2 flex gap-2">
                {heroSlides.map((_, i) => <button key={i} onClick={() => setHeroSlide(i)} className={`w-2.5 h-2.5 lg:w-3 lg:h-3 rounded-full transition-all ${i === heroSlide ? 'bg-white w-6 lg:w-8' : 'bg-white/50'}`} />)}
              </div>
            </>
          )}
        </div>
      )}

      {/* ===== PROMO COUNTDOWN SECTION ===== */}
      {!search && promoProducts.length > 0 && (
        <div className="bg-gradient-to-r from-red-600 via-orange-500 to-yellow-500 py-5 lg:py-8 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)' }} />
          <div className="max-w-7xl mx-auto px-4 lg:px-6 relative z-10">
            <div className="flex items-center gap-2 mb-4 lg:mb-6">
              <span className="text-2xl">🔥</span>
              <h2 className="text-white font-extrabold text-lg sm:text-xl lg:text-2xl uppercase tracking-wide">Super Ofertas</h2>
              <span className="text-2xl">🔥</span>
            </div>
            <div className="flex gap-3 lg:gap-4 overflow-x-auto scrollbar-hide pb-2">
              {promoProducts.slice(0, 8).map(p => {
                const endTime = new Date(p.promo_ends_at!).getTime();
                const diff = Math.max(0, endTime - countdownNow);
                const days = Math.floor(diff / 86400000);
                const hours = Math.floor((diff % 86400000) / 3600000);
                const minutes = Math.floor((diff % 3600000) / 60000);
                const seconds = Math.floor((diff % 60000) / 1000);
                const discount = Math.round(((p.price_default - (p.promo_price || 0)) / p.price_default) * 100);

                return (
                  <div key={`promo-${p.id}`} className="flex-shrink-0 w-[180px] lg:w-[220px] bg-white rounded-2xl overflow-hidden shadow-xl border-2 border-yellow-400 relative cursor-pointer group" onClick={() => { setSelectedProduct(p); setPageView('product'); }}>
                    <div className="absolute top-2 right-2 z-10 bg-red-600 text-white text-[10px] lg:text-xs font-extrabold px-2 py-1 rounded-full shadow-lg">
                      -{discount}%
                    </div>
                    <div className="aspect-square bg-gray-50 overflow-hidden relative">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100"><ShoppingBag className="h-8 w-8 text-gray-200" /></div>
                      )}
                    </div>
                    <div className="p-3 space-y-1">
                      <h3 className="text-xs lg:text-sm font-semibold text-gray-800 line-clamp-2 leading-tight">{p.name}</h3>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs text-gray-400 line-through">{fc(p.price_default)}</span>
                        <span className="text-base lg:text-lg font-extrabold text-red-600">{fc(p.promo_price!)}</span>
                      </div>
                      <div className="flex gap-1 mt-1.5">
                        {days > 0 && <div className="bg-gray-900 text-white text-[9px] font-bold px-1.5 py-1 rounded text-center"><div className="text-sm leading-none">{days}</div>d</div>}
                        <div className="bg-gray-900 text-white text-[9px] font-bold px-1.5 py-1 rounded text-center"><div className="text-sm leading-none">{String(hours).padStart(2, '0')}</div>h</div>
                        <div className="bg-gray-900 text-white text-[9px] font-bold px-1.5 py-1 rounded text-center"><div className="text-sm leading-none">{String(minutes).padStart(2, '0')}</div>m</div>
                        <div className="bg-gray-900 text-white text-[9px] font-bold px-1.5 py-1 rounded text-center animate-pulse"><div className="text-sm leading-none">{String(seconds).padStart(2, '0')}</div>s</div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); addToCart(p); }} className="w-full mt-1.5 flex items-center justify-center gap-1 bg-red-600 text-white text-[10px] lg:text-xs font-extrabold py-2 rounded-lg transition hover:bg-red-700 active:scale-95 uppercase">
                        COMPRAR AGORA
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===== CATEGORIES (carousel with arrows) ===== */}
      {allCats.length > 0 && !search && (() => {
        const scrollCats = (dir: 'left' | 'right') => {
          catScrollRef.current?.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' });
        };
        return (
          <div className="bg-white py-5 lg:py-10 border-b">
            <div className="max-w-7xl mx-auto px-4 relative">
              {/* Left arrow */}
              <button
                onClick={() => scrollCats('left')}
                className="hidden lg:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white shadow-lg border border-gray-200 items-center justify-center hover:bg-gray-50 transition"
                aria-label="Anterior"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              {/* Right arrow */}
              <button
                onClick={() => scrollCats('right')}
                className="hidden lg:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white shadow-lg border border-gray-200 items-center justify-center hover:bg-gray-50 transition"
                aria-label="Próximo"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
              </button>
              <div ref={catScrollRef} className="flex gap-5 lg:gap-8 overflow-x-auto scrollbar-hide pb-2 px-6 lg:px-12 scroll-smooth">
                {allCats.map((cat) => {
                  const isActive = activeCategory === cat.name;
                  return (
                    <button key={cat.name} onClick={() => { navigateToCategory(cat.name); }} className="flex flex-col items-center gap-2.5 min-w-[90px] lg:min-w-[120px] flex-shrink-0 transition-all">
                      <div
                        className={`w-[90px] h-[90px] lg:w-[120px] lg:h-[120px] rounded-full overflow-hidden flex items-center justify-center border-[3px] lg:border-4 transition-all ${isActive ? 'scale-110 shadow-xl' : 'hover:scale-105 shadow-md'}`}
                        style={{ borderColor: isActive ? primaryColor : '#e5e7eb' }}
                      >
                        {cat.icon_url ? (
                          <img src={cat.icon_url} alt={cat.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                            <span className="text-2xl lg:text-3xl font-bold" style={{ color: primaryColor }}>{cat.name.charAt(0)}</span>
                          </div>
                        )}
                      </div>
                      <span className="text-xs lg:text-sm font-semibold text-center leading-tight max-w-[90px] lg:max-w-[120px] line-clamp-2" style={{ color: isActive ? primaryColor : '#4b5563' }}>{cat.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===== FEATURED PRODUCTS ===== */}
      {!search && featured.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6 lg:py-10">
          <SectionTitle title="Mais procurados" color={primaryColor} action="Ver todos" onAction={() => { setCatalogCategory('all'); setCatalogPage(0); setPageView('catalog'); }} />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 lg:gap-5">
            {featured.slice(0, 12).map(p => (
              <ProductCard key={`feat-${p.id}`} product={p} primaryColor={primaryColor} showPrices={store.show_prices} fc={fc} onClick={() => { setSelectedProduct(p); setPageView('product'); }} onAddToCart={() => addToCart(p)} isFavorite={isFavorite(p.id)} onToggleFavorite={() => toggleFavorite(p.id)} />
            ))}
          </div>
        </div>
      )}

      {/* ===== INLINE BANNERS ===== */}
      {!search && inlineBanners.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-2">
          <div className={`grid gap-3 lg:gap-5 ${inlineBanners.length === 1 ? 'grid-cols-1' : inlineBanners.length === 2 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 lg:grid-cols-3'}`}>
            {inlineBanners.map(banner => (
              <div
                key={banner.id}
                className="relative rounded-2xl overflow-hidden cursor-pointer group"
                style={{ height: 'clamp(160px, 20vw, 240px)' }}
                onClick={() => banner.link_url && window.open(banner.link_url, '_blank')}
              >
                {banner.image_url ? (
                  <img src={banner.image_url} alt={banner.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
                    <span className="text-white text-xl font-bold">{banner.title}</span>
                  </div>
                )}
                {banner.title && banner.image_url && (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end">
                    <p className="text-white font-bold text-lg px-5 pb-4 drop-shadow-lg">{banner.title}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== SECTION 1: Products ===== */}
      <div ref={el => { productsSectionRef.current = el; }}>
      {!search && section1.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6 lg:py-10">
          <SectionTitle title={activeCategory !== 'all' ? activeCategory : 'Produtos em Destaque'} color={primaryColor} action="Ver todos" onAction={() => { setCatalogCategory(activeCategory); setCatalogPage(0); setPageView('catalog'); }} />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 lg:gap-5">
            {section1.map(p => <ProductCard key={p.id} product={p} primaryColor={primaryColor} showPrices={store.show_prices} fc={fc} onClick={() => { setSelectedProduct(p); setPageView('product'); }} onAddToCart={() => addToCart(p)} isFavorite={isFavorite(p.id)} onToggleFavorite={() => toggleFavorite(p.id)} />)}
          </div>
        </div>
      )}

      {/* ===== SECTION 2 ===== */}
      {!search && section2.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6 lg:py-10">
          <SectionTitle title="Mais Produtos" color={primaryColor} action="Ver todos" onAction={() => { setCatalogCategory('all'); setCatalogPage(0); setPageView('catalog'); }} />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 lg:gap-5">
            {section2.map(p => <ProductCard key={p.id} product={p} primaryColor={primaryColor} showPrices={store.show_prices} fc={fc} onClick={() => { setSelectedProduct(p); setPageView('product'); }} onAddToCart={() => addToCart(p)} isFavorite={isFavorite(p.id)} onToggleFavorite={() => toggleFavorite(p.id)} />)}
          </div>
        </div>
      )}
      </div>

      {/* ===== VER TODOS BUTTON ===== */}
      {!search && products.length > 16 && (
        <div className="max-w-7xl mx-auto px-4 pb-6 lg:pb-10 text-center">
          <button
            onClick={() => { setCatalogCategory('all'); setCatalogPage(0); setPageView('catalog'); }}
            className="inline-flex items-center gap-2 font-bold text-sm lg:text-base px-8 lg:px-10 py-3.5 lg:py-4 rounded-full border-2 transition hover:opacity-90"
            style={{ borderColor: primaryColor, color: primaryColor }}
          >
            <Store className="h-4 w-4 lg:h-5 lg:w-5" /> Ver todos os produtos ({products.length})
          </button>
        </div>
      )}

      {/* ===== SEARCH RESULTS ===== */}
      {search && (
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6 lg:py-10">
          <SectionTitle title={`Resultados para "${search}"`} color={primaryColor} />
          {filtered.length === 0 ? (
            <div className="text-center py-16"><ShoppingBag className="mx-auto h-14 w-14 text-gray-200 mb-3" /><p className="text-gray-500 font-medium">Nenhum produto encontrado</p></div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 lg:gap-5">
              {filtered.map(p => <ProductCard key={p.id} product={p} primaryColor={primaryColor} showPrices={store.show_prices} fc={fc} onClick={() => { setSelectedProduct(p); setPageView('product'); }} onAddToCart={() => addToCart(p)} isFavorite={isFavorite(p.id)} onToggleFavorite={() => toggleFavorite(p.id)} />)}
            </div>
          )}
        </div>
      )}

      {/* Cart FAB */}
      {cartCount > 0 && (
        <button onClick={() => setPageView('checkout')} className="fixed bottom-20 right-4 sm:right-6 flex items-center gap-2 text-white font-bold rounded-full px-5 py-3.5 shadow-2xl z-50 hover:scale-105 transition-all" style={{ backgroundColor: primaryColor }}>
          <ShoppingCart className="h-5 w-5" />
          <span>{cartCount} {cartCount === 1 ? 'item' : 'itens'}</span>
          <span className="ml-1 bg-white/20 rounded-full px-2.5 py-0.5 text-sm">{fc(cartTotal)}</span>
        </button>
      )}

      {/* WhatsApp FAB */}
      {store.show_whatsapp_button && store.whatsapp_number && (
        <button onClick={() => openWhatsApp()} className="fixed bottom-4 right-4 sm:right-6 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-white z-50 hover:scale-110 transition-all duration-200" style={{ backgroundColor: '#25D366' }} title="Fale conosco no WhatsApp">
          <WhatsAppIcon size={28} />
        </button>
      )}

      {/* Footer */}
      <footer className="bg-gray-900 text-white mt-8">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-10 lg:py-14">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
            {/* About */}
            <div>
              <div className="mb-4">
                {store.logo_url?.includes('conecta-mix') ? <ConectaMixLogo size="sm" /> : store.logo_url ? <img src={store.logo_url} alt="" className="max-h-10 lg:max-h-12 max-w-[140px] object-contain" /> : <h3 className="font-bold text-lg lg:text-xl">{store.name}</h3>}
              </div>
              {store.description && <p className="text-gray-400 text-sm leading-relaxed mb-3">{store.description}</p>}
              {store.about_us && (
                <button onClick={() => { setPolicyPage('about'); setPageView('policy'); }} className="text-xs hover:text-white text-gray-400 transition underline">
                  Saiba mais sobre nós →
                </button>
              )}
            </div>

            {/* Categorias */}
            <div>
              <h4 className="font-semibold text-sm mb-3 text-gray-300 uppercase tracking-wider">Categorias</h4>
              <div className="flex flex-wrap gap-2">
                {productCategories.slice(0, 8).map(c => (
                  <button key={c} onClick={() => { navigateToCategory(c); }} className="text-xs bg-gray-800 hover:bg-gray-700 px-2.5 py-1 rounded-full text-gray-400 hover:text-white transition">{c}</button>
                ))}
              </div>
            </div>

            {/* Institucional */}
            <div>
              <h4 className="font-semibold text-sm mb-3 text-gray-300 uppercase tracking-wider">Institucional</h4>
              <nav className="space-y-2">
                {store.policy_privacy && <button onClick={() => { setPolicyPage('privacy'); setPageView('policy'); }} className="block text-sm text-gray-400 hover:text-white transition">Política de Privacidade</button>}
                {store.policy_terms && <button onClick={() => { setPolicyPage('terms'); setPageView('policy'); }} className="block text-sm text-gray-400 hover:text-white transition">Termos de Uso</button>}
                {store.policy_purchase && <button onClick={() => { setPolicyPage('purchase'); setPageView('policy'); }} className="block text-sm text-gray-400 hover:text-white transition">Política de Compra</button>}
                {store.policy_exchange && <button onClick={() => { setPolicyPage('exchange'); setPageView('policy'); }} className="block text-sm text-gray-400 hover:text-white transition">Troca e Devolução</button>}
                {store.policy_shipping && <button onClick={() => { setPolicyPage('shipping'); setPageView('policy'); }} className="block text-sm text-gray-400 hover:text-white transition">Política de Envio</button>}
                <button onClick={() => setPageView('myorders')} className="block text-sm text-gray-400 hover:text-white transition">Meus Pedidos</button>
              </nav>
            </div>

            {/* Contato */}
            <div>
              <h4 className="font-semibold text-sm mb-3 text-gray-300 uppercase tracking-wider">Contato</h4>
              <div className="space-y-3">
                {(store.footer_phone || store.whatsapp_number) && (
                  <button onClick={() => openWhatsApp()} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition">
                    <Phone className="h-4 w-4 flex-shrink-0" /> {store.footer_phone || store.whatsapp_number}
                  </button>
                )}
                {store.footer_email && (
                  <a href={`mailto:${store.footer_email}`} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                    {store.footer_email}
                  </a>
                )}
                {store.footer_address && (
                  <p className="flex items-start gap-2 text-sm text-gray-400">
                    <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>{store.footer_address}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-8 pt-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs text-gray-500">© {new Date().getFullYear()} {store.name}. Todos os direitos reservados.</p>
              {store.footer_cnpj && <p className="text-xs text-gray-500">CNPJ: {store.footer_cnpj}</p>}
            </div>
            <div className="flex flex-wrap justify-center gap-3 mt-4 sm:hidden">
              {store.policy_privacy && <button onClick={() => { setPolicyPage('privacy'); setPageView('policy'); }} className="text-[10px] text-gray-600 hover:text-gray-300">Privacidade</button>}
              {store.policy_terms && <button onClick={() => { setPolicyPage('terms'); setPageView('policy'); }} className="text-[10px] text-gray-600 hover:text-gray-300">Termos</button>}
              {store.policy_exchange && <button onClick={() => { setPolicyPage('exchange'); setPageView('policy'); }} className="text-[10px] text-gray-600 hover:text-gray-300">Trocas</button>}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function PaymentIcon({ method, active, color }: { method: string; active: boolean; color: string }) {
  const stroke = active ? 'white' : color;
  const fill = active ? 'white' : color;
  const cls = "w-5 h-5 flex-shrink-0";
  const m = method.toLowerCase();
  if (m.includes('pix')) {
    return (
      <svg className={cls} viewBox="0 0 512 512" fill="none">
        <path d="M382.56 355.46l-89.37-89.37a15.88 15.88 0 00-22.48 0l-89.38 89.37a15.89 15.89 0 01-22.48 0l-44.96-44.96 133.3-133.3a15.88 15.88 0 0122.48 0l133.3 133.3-44.97 44.96a15.87 15.87 0 01-22.44 0z" fill={fill} fillOpacity=".2"/>
        <path d="M392.07 346.07l-84.14-84.14a26.5 26.5 0 00-37.5 0l-84.14 84.14a10.61 10.61 0 01-15 0l-62.79-62.79a21.22 21.22 0 010-30l62.79-62.79a10.61 10.61 0 0115 0l84.14 84.14a26.5 26.5 0 0037.5 0l84.14-84.14a10.61 10.61 0 0115 0l62.79 62.79a21.22 21.22 0 010 30l-62.79 62.79a10.61 10.61 0 01-15 0z" stroke={stroke} strokeWidth="32" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  }
  if (m.includes('card') || m.includes('cartao') || m.includes('cartão') || m.includes('credito') || m.includes('debito') || m.includes('crédito') || m.includes('débito')) {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
        <line x1="1" y1="10" x2="23" y2="10"/>
        <line x1="5" y1="15" x2="9" y2="15"/>
      </svg>
    );
  }
  if (m.includes('cash') || m.includes('dinheiro') || m.includes('especie') || m.includes('espécie')) {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2"/>
        <circle cx="12" cy="12" r="3"/>
        <circle cx="4.5" cy="12" r="0.8" fill={stroke} stroke="none"/>
        <circle cx="19.5" cy="12" r="0.8" fill={stroke} stroke="none"/>
      </svg>
    );
  }
  if (m.includes('boleto')) {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="1"/>
        <line x1="6" y1="8" x2="6" y2="16"/>
        <line x1="9" y1="8" x2="9" y2="16"/>
        <line x1="12" y1="8" x2="12" y2="16"/>
        <line x1="15" y1="8" x2="15" y2="16"/>
        <line x1="18" y1="8" x2="18" y2="16"/>
      </svg>
    );
  }
  if (m.includes('transfer') || m.includes('ted') || m.includes('doc')) {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12h6l3-9 4 18 3-9h4"/>
      </svg>
    );
  }
  // Default wallet icon
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12V8H6a2 2 0 01-2-2c0-1.1.9-2 2-2h12v4"/>
      <path d="M4 6v12c0 1.1.9 2 2 2h14V12"/>
      <circle cx="18" cy="14" r="1" fill={stroke} stroke="none"/>
    </svg>
  );
}

function getDefaultMenu(theme?: 'party' | 'furniture'): HeaderMenuItem[] {
  if (theme === 'furniture') {
    return [
      { name: 'Ofertas', icon: 'sale', category: 'Ofertas' },
      { name: 'Sofás', icon: 'sofa', category: 'Sofás' },
      { name: 'Poltronas', icon: 'armchair', category: 'Poltronas' },
      { name: 'Camas', icon: 'bed', category: 'Camas' },
      { name: 'Colchões', icon: 'mattress', category: 'Colchões' },
      { name: 'Guarda-roupas', icon: 'wardrobe', category: 'Guarda-roupas' },
      { name: 'Mesas', icon: 'table', category: 'Mesas' },
      { name: 'Cadeiras', icon: 'chair', category: 'Cadeiras' },
      { name: 'Estantes', icon: 'shelf', category: 'Estantes' },
      { name: 'Cozinha', icon: 'kitchen', category: 'Cozinha' },
      { name: 'Iluminação', icon: 'lamp', category: 'Iluminação' },
      { name: 'Decoração', icon: 'decor', category: 'Decoração' },
    ];
  }
  return [
    { name: 'Saldão de descontos', icon: 'sale', category: 'Saldão de descontos' },
    { name: 'Balões', icon: 'balloon', category: 'Balões' },
    { name: 'Descartáveis', icon: 'cutlery', category: 'Descartáveis' },
    { name: 'Temas Sazonais', icon: 'pumpkin', category: 'Temas Sazonais' },
    { name: 'Temas Menina', icon: 'girl', category: 'Temas Menina' },
    { name: 'Temas Menino', icon: 'boy', category: 'Temas Menino' },
    { name: 'Temas Bebê', icon: 'baby', category: 'Temas Bebê' },
    { name: 'Temas Jovem e Adulto', icon: 'party', category: 'Temas Jovem e Adulto' },
    { name: 'Lembrancinhas', icon: 'gift', category: 'Lembrancinhas' },
    { name: 'Acessórios de festas', icon: 'glasses', category: 'Acessórios de festas' },
    { name: 'Velas', icon: 'candle', category: 'Velas' },
    { name: 'Artigos de decoração', icon: 'decor', category: 'Artigos de decoração' },
  ];
}

function MenuIcon({ iconKey }: { iconKey?: string }) {
  const cls = "w-7 h-7";
  switch (iconKey) {
    case 'sale': return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h18v4H3z"/><path d="M3 7v13a1 1 0 001 1h16a1 1 0 001-1V7"/><path d="M16 10a4 4 0 01-8 0"/><circle cx="18" cy="4" r="3" fill="currentColor" stroke="none"/></svg>;
    case 'balloon': return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="9" rx="5" ry="7"/><path d="M12 16v5"/><path d="M10 21h4"/><path d="M10 16l2 2 2-2"/></svg>;
    case 'cutlery': return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h2a2 2 0 002-2V2"/><path d="M6 2v20"/><path d="M18 2c-1.5 1.5-2 3.5-2 6 0 2.5 2 4 4 4V2"/><path d="M20 12v10"/></svg>;
    case 'pumpkin': return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3c-1 0-2 .5-2 2"/><path d="M12 5C7 5 3 9 3 14s4 7 9 7 9-2 9-7-4-9-9-9z"/><path d="M9 13l1.5 2L12 13l1.5 2L15 13"/><path d="M9 10h.01M15 10h.01"/></svg>;
    case 'girl': return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="5"/><path d="M12 13c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5z"/><path d="M9 4c0-1 1.5-2 3-2s3 1 3 2"/></svg>;
    case 'boy': return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="5"/><path d="M12 13c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5z"/><path d="M7 5l3-3M17 5l-3-3"/></svg>;
    case 'baby': return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="10" r="6"/><path d="M12 16c-4 0-7 2-7 4v2h14v-2c0-2-3-4-7-4z"/><path d="M9 9h.01M15 9h.01"/><path d="M10 12a2 2 0 004 0"/><path d="M10 4h4"/></svg>;
    case 'party': return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5.8 11.3L2 22l10.7-3.8"/><path d="M4 3h.01M22 8h.01M15 2h.01M22 20h.01"/><path d="M9 7L6 4M17 14l4-1M20 18l1-3"/><path d="M2 22l4-11 7 7z"/></svg>;
    case 'gift': return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 01-2 2H7a2 2 0 01-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 010-5C9 3 12 8 12 8s3-5 4.5-5a2.5 2.5 0 010 5"/></svg>;
    case 'glasses': return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="7" cy="14" r="4"/><circle cx="17" cy="14" r="4"/><path d="M11 14h2"/><path d="M3 14l-1-4M21 14l1-4"/><path d="M15 6c-1 2-2 3-3 3s-2-1-3-3"/></svg>;
    case 'candle': return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="8" width="6" height="14" rx="1"/><path d="M12 3c-.5 1-1 2-1 3s1 2 1 2 1-1 1-2-0.5-2-1-3z" fill="currentColor"/></svg>;
    case 'decor': return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2 4 4.5.7-3.3 3.1.8 4.5L12 12.2 7.9 14.3l.8-4.5L5.5 6.7 10 6z"/><path d="M5 18h14"/><path d="M7 22h10"/><path d="M12 14v4"/></svg>;
    // Furniture icons
    case 'sofa': return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12v5a2 2 0 002 2h14a2 2 0 002-2v-5"/><path d="M3 12a2 2 0 012-2h1a2 2 0 012 2v3h8v-3a2 2 0 012-2h1a2 2 0 012 2"/><path d="M6 19v2M18 19v2"/></svg>;
    case 'armchair': return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 11V7a3 3 0 013-3h8a3 3 0 013 3v4"/><path d="M5 11a2 2 0 00-2 2v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 00-2-2"/><path d="M5 18v2M19 18v2"/><path d="M8 11h8"/></svg>;
    case 'bed': return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 17V7"/><path d="M2 11h20v6"/><path d="M2 17h20"/><path d="M22 17v3M2 17v3"/><path d="M6 11V8a1 1 0 011-1h4a1 1 0 011 1v3"/></svg>;
    case 'mattress': return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="8" width="20" height="9" rx="2"/><path d="M6 11v3M10 11v3M14 11v3M18 11v3"/><path d="M2 17v2M22 17v2"/></svg>;
    case 'wardrobe': return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="1"/><path d="M12 2v20"/><circle cx="10" cy="12" r=".5" fill="currentColor"/><circle cx="14" cy="12" r=".5" fill="currentColor"/></svg>;
    case 'table': return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9h18"/><path d="M3 9v2h18V9"/><path d="M5 11v10M19 11v10"/></svg>;
    case 'chair': return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3v11M17 3v11"/><path d="M5 14h14l-1 4H6z"/><path d="M7 18v3M17 18v3"/></svg>;
    case 'shelf': return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M4 9h16M4 15h16"/></svg>;
    case 'kitchen': return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="1"/><circle cx="9" cy="9" r="1.5"/><circle cx="15" cy="9" r="1.5"/><rect x="7" y="13" width="10" height="5" rx="1"/></svg>;
    case 'lamp': return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2h8l2 7H6z"/><path d="M12 9v9"/><path d="M8 21h8"/></svg>;
    case 'tv': return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 19v2"/></svg>;
    case 'drawer': return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 9h18M3 15h18"/><path d="M11 6h2M11 12h2M11 18h2"/></svg>;
    case 'buffet': return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="12" rx="1"/><path d="M12 6v12"/><path d="M3 12h18"/><circle cx="8" cy="9" r=".6" fill="currentColor"/><circle cx="16" cy="9" r=".6" fill="currentColor"/><circle cx="8" cy="15" r=".6" fill="currentColor"/><circle cx="16" cy="15" r=".6" fill="currentColor"/><path d="M5 18v2M19 18v2"/></svg>;
    case 'frame': return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="1"/><path d="M7 17l4-5 3 3 3-4"/><circle cx="9" cy="8" r="1.2"/></svg>;
    default:
      if (iconKey && (iconKey.startsWith('http') || iconKey.startsWith('/'))) {
        return <img src={iconKey} alt="" className="w-7 h-7 object-contain brightness-0 invert" />;
      }
      if (iconKey) return <span className="text-2xl leading-none">{iconKey}</span>;
      return <ShoppingBag className="w-7 h-7" />;
  }
}

function adjustColor(hex: string, amount: number): string {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(ch => ch + ch).join('');
  const num = parseInt(c, 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xFF) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xFF) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xFF) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/* ===== Section Title with decorative lines ===== */
function SectionTitle({ title, color, action, onAction }: { title: string; color: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex items-center gap-3 mb-5 lg:mb-7">
      <div className="flex-1 h-px" style={{ backgroundColor: `${color}30` }} />
      <h2 className="text-base sm:text-lg lg:text-xl font-bold whitespace-nowrap" style={{ color }}>{title}</h2>
      <div className="flex-1 h-px" style={{ backgroundColor: `${color}30` }} />
      {action && onAction && (
        <button onClick={onAction} className="text-xs lg:text-sm font-bold whitespace-nowrap px-3 lg:px-4 py-1.5 lg:py-2 rounded-full border transition hover:opacity-80" style={{ borderColor: color, color }}>
          {action} →
        </button>
      )}
    </div>
  );
}

/* ===== Product Card ===== */
function ProductCard({ product, primaryColor, showPrices, fc, onClick, onAddToCart, isFavorite, onToggleFavorite }: {
  product: CatalogProduct; primaryColor: string; showPrices: boolean; fc: (v: number) => string; onClick: () => void; onAddToCart: () => void;
  isFavorite?: boolean; onToggleFavorite?: () => void;
}) {
  const inStock = product.qty_available > 0 || (product.variants || []).some(v => v.qty_available > 0);
  const isPromo = product.promo_price && product.promo_ends_at && new Date() < new Date(product.promo_ends_at) && (!product.promo_starts_at || new Date() >= new Date(product.promo_starts_at));
  const effectivePrice = isPromo ? product.promo_price! : product.price_default;
  const discount = isPromo ? Math.round(((product.price_default - product.promo_price!) / product.price_default) * 100) : 0;
  const hasVariants = (product.variants || []).length > 0;
  const priceMin = product.price_min ?? null;
  const priceMax = product.price_max ?? null;
  const showRange = hasVariants && priceMin !== null && priceMax !== null && priceMin !== priceMax;

  return (
    <div className="bg-white rounded-xl lg:rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group relative">
      {isPromo && !showRange && <div className="absolute top-2 right-2 z-10 bg-red-600 text-white text-[10px] lg:text-xs font-extrabold px-2 py-0.5 rounded-full shadow">-{discount}%</div>}
      {hasVariants && <div className="absolute top-2 left-2 z-10 bg-white/95 backdrop-blur text-gray-700 text-[9px] lg:text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm uppercase tracking-wide">Opções</div>}
      {onToggleFavorite && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
          className={`absolute ${isPromo && !showRange ? 'top-9' : 'top-2'} right-2 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 shadow-sm ${isFavorite ? 'bg-red-50 hover:bg-red-100' : 'bg-white/90 hover:bg-white'}`}
        >
          <Heart className={`h-4 w-4 transition-all ${isFavorite ? 'fill-red-500 text-red-500 scale-110' : 'text-gray-400 hover:text-red-400'}`} />
        </button>
      )}
      <div onClick={onClick} className="aspect-square bg-gray-50 overflow-hidden relative">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100"><ShoppingBag className="h-10 w-10 text-gray-200" /></div>
        )}
        {!inStock && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><span className="bg-white text-gray-800 text-xs font-bold px-3 py-1.5 rounded-full shadow">Indisponível</span></div>}
        {product.brand && !hasVariants && <span className="absolute top-2 left-2 bg-white/95 text-gray-700 text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-sm">{product.brand}</span>}
      </div>
      <div className="p-3 lg:p-4 space-y-1">
        <h3 onClick={onClick} className="text-xs sm:text-sm font-semibold text-gray-800 line-clamp-2 leading-snug min-h-[2.5em]">{product.name}</h3>
        {showPrices && (
          <div>
            {showRange ? (
              <span className="text-sm sm:text-base font-extrabold" style={{ color: primaryColor }}>
                {fc(priceMin!)} <span className="text-gray-400 font-bold">–</span> {fc(priceMax!)}
              </span>
            ) : (
              <>
                {isPromo && <span className="text-[11px] text-gray-400 line-through mr-1">{fc(product.price_default)}</span>}
                <span className="text-base sm:text-lg font-extrabold" style={{ color: isPromo ? '#dc2626' : primaryColor }}>{fc(effectivePrice)}</span>
              </>
            )}
          </div>
        )}
        {inStock && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (hasVariants) { onClick(); return; }
              onAddToCart();
            }}
            className="w-full mt-1 flex items-center justify-center gap-1.5 text-white text-xs font-bold py-2.5 rounded-lg transition hover:opacity-90 active:scale-95 uppercase tracking-wide"
            style={{ backgroundColor: primaryColor }}
          >
            {hasVariants ? 'VER OPÇÕES' : 'COMPRAR'}
          </button>
        )}
      </div>
    </div>
  );
}

function MobileSidebarMenuItem({ item, primaryColor, onNavigate }: { item: HeaderMenuItem; primaryColor: string; onNavigate: (cat: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = item.children && item.children.length > 0;

  return (
    <div className="border-b border-gray-50">
      <button
        onClick={() => {
          if (hasChildren) {
            setExpanded(!expanded);
          } else {
            onNavigate(item.category || item.name);
          }
        }}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition text-left"
      >
        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${primaryColor}15` }}>
          <div style={{ color: primaryColor }}><MenuIcon iconKey={item.icon} /></div>
        </div>
        <span className="font-semibold text-sm flex-1 text-gray-800">{item.name}</span>
        {hasChildren ? (
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-300" />
        )}
      </button>
      {hasChildren && expanded && (
        <div className="bg-gray-50/50 pb-1">
          <button
            onClick={() => onNavigate(item.category || item.name)}
            className="w-full text-left px-6 pl-[68px] py-2.5 text-sm font-semibold hover:bg-gray-100 transition"
            style={{ color: primaryColor }}
          >
            Ver todos
          </button>
          {item.children!.map((child, ci) => (
            <button
              key={ci}
              onClick={() => onNavigate(child.category)}
              className="w-full text-left px-6 pl-[68px] py-2.5 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition"
            >
              {child.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function WhatsAppIcon({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
    </svg>
  );
}

/* ===== Zoomable Image: hover-lens on desktop, tap-to-open modal on mobile ===== */
function ZoomableImage({ src, alt }: { src: string; alt: string }) {
  const [hover, setHover] = useState(false);
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const [modalOpen, setModalOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Detect coarse pointer (mobile) — desktop has fine pointer
  const isCoarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  const ZOOM = 2.2;

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = containerRef.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPos({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
  };

  return (
    <>
      <div
        ref={containerRef}
        className="w-full h-full relative overflow-hidden cursor-zoom-in"
        onMouseEnter={() => !isCoarse && setHover(true)}
        onMouseLeave={() => setHover(false)}
        onMouseMove={(e) => !isCoarse && handleMove(e)}
        onClick={() => { if (isCoarse) setModalOpen(true); }}
      >
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover transition-transform duration-200 ease-out select-none"
          draggable={false}
          style={hover && !isCoarse ? {
            transform: `scale(${ZOOM})`,
            transformOrigin: `${pos.x}% ${pos.y}%`,
          } : undefined}
        />
        {!isCoarse && !hover && (
          <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur text-[10px] font-semibold text-gray-700 px-2 py-1 rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            Passe o mouse para ampliar
          </div>
        )}
        {isCoarse && (
          <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur text-[10px] font-semibold text-gray-700 px-2 py-1 rounded-full shadow pointer-events-none">
            Toque para ampliar
          </div>
        )}
      </div>

      {modalOpen && (
        <ImageZoomModal src={src} alt={alt} onClose={() => setModalOpen(false)} />
      )}
    </>
  );
}

/* ===== Mobile-friendly modal with pinch-to-zoom (uses native CSS) ===== */
function ImageZoomModal({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const lastTap = useRef(0);

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      setScale(s => (s > 1 ? 1 : 2));
    }
    lastTap.current = now;
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center touch-none"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white hover:bg-white/30"
        aria-label="Fechar"
      >
        <X className="h-5 w-5" />
      </button>
      <div
        className="w-full h-full overflow-auto flex items-center justify-center p-4"
        onClick={(e) => e.stopPropagation()}
        onTouchEnd={handleDoubleTap}
        style={{ touchAction: 'pinch-zoom' }}
      >
        <img
          src={src}
          alt={alt}
          className="max-w-none transition-transform duration-200"
          style={{ transform: `scale(${scale})`, transformOrigin: 'center', maxHeight: scale === 1 ? '90vh' : 'none', maxWidth: scale === 1 ? '95vw' : 'none' }}
          draggable={false}
        />
      </div>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/20 backdrop-blur text-white text-xs px-3 py-1.5 rounded-full pointer-events-none">
        Toque duas vezes para ampliar • Pinça para zoom
      </div>
    </div>
  );
}
