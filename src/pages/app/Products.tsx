import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { isModuleDisabled, isAiBlocked, AI_BLOCKED_MESSAGE } from "@/utils/accountModules";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/utils/activityLog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Pencil, Upload, Loader2, Copy, Trash2, CheckSquare, Image, Settings2, Package, Sparkles, DollarSign, CalendarClock, X, Wand2 } from "lucide-react";
// AI features removed (single-tenant build)
const AiSimulationDialog: any = () => null;
const BuyAiCreditsDialog: any = () => null;
const useAiSimulationEnabled = () => ({ enabled: false });
const useAiCreditBalance = () => ({ balance: { plan_credits: 0, purchased_credits: 0 }, refresh: () => {} });
import NcmLookup from "@/components/NcmLookup";
import ProductVariants from "@/components/ProductVariants";
import ProductPresentations from "@/components/ProductPresentations";
import ProductPriceTiers from "@/components/ProductPriceTiers";
import ProductImageGallery from "@/components/ProductImageGallery";
import SmartPagination from "@/components/SmartPagination";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Product } from "@/types/database";

const PAGE_SIZE = 50;

export default function Products() {
  const { user, currentAccount, currentStore, canEdit, userRole } = useAuth();
  // Ponto da Festa e Top Festas: vendedor só consulta, não edita produtos
  const sellerBlocked = userRole === 'seller' && isModuleDisabled(currentAccount?.id, 'seller_no_edit_products');
  const canManageProducts = sellerBlocked ? false : (canEdit || userRole === "seller");
  const { toast } = useToast();
  const aiBlocked = isAiBlocked(currentAccount);
  const { enabled: aiSimEnabledRaw } = useAiSimulationEnabled();
  const aiSimEnabled = aiSimEnabledRaw && !aiBlocked;
  const [aiSimProduct, setAiSimProduct] = useState<Product | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  const [categories, setCategories] = useState<string[]>([]);
  const [groups, setGroups] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    sku: "",
    name: "",
    unit: "UN",
    price_default: 0,
    cost_default: 0,
    ncm: "",
    cest: "",
    cfop_default: "",
    gtin: "",
    description: "",
    ai_training: "",
    image_url: "",
    brand: "",
    weight: "",
    weight_unit: "g",
    category: "",
    product_group: "",
    origem_icms: "0",
    cst_icms: "",
    csosn: "",
    cst_pis: "",
    cst_cofins: "",
    cst_ipi: "",
    aliq_icms: 0,
    aliq_pis: 0,
    aliq_cofins: 0,
    aliq_ipi: 0,
    promo_price: "",
    promo_starts_at: "",
    promo_ends_at: "",
    variant_options: null as string[] | null,
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [generatingAiImage, setGeneratingAiImage] = useState(false);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [showBuyCredits, setShowBuyCredits] = useState(false);
  const { balance: aiBalance, refresh: refreshAiBalance } = useAiCreditBalance();
  const aiTotalCredits = (aiBalance?.plan_credits ?? 0) + (aiBalance?.purchased_credits ?? 0);
  const [bulkGenProgress, setBulkGenProgress] = useState({ done: 0, total: 0 });
  const [validatingFiscal, setValidatingFiscal] = useState(false);
  const [fiscalAiResult, setFiscalAiResult] = useState<{ ambiguous: boolean; warning: string; explanation: string; suggestions: Record<string, any> } | null>(null);

  // Bulk fiscal AI state
  const [bulkFiscalRunning, setBulkFiscalRunning] = useState(false);
  const [bulkFiscalProgress, setBulkFiscalProgress] = useState({ done: 0, total: 0, updated: 0 });
  const [bulkFiscalAmbiguous, setBulkFiscalAmbiguous] = useState<{ id: string; name: string; sku: string; warning: string }[]>([]);
  const [showBulkFiscalResult, setShowBulkFiscalResult] = useState(false);

  // Expiration dates state
  const [expirationDates, setExpirationDates] = useState<{ id?: string; batch_label: string; expiration_date: string; quantity: number }[]>([]);
  const [loadingExpirations, setLoadingExpirations] = useState(false);

  const loadExpirationDates = async (productId: string) => {
    if (!currentAccount) return;
    setLoadingExpirations(true);
    const { data } = await supabase
      .from('product_expiration_dates')
      .select('id, batch_label, expiration_date, quantity')
      .eq('product_id', productId)
      .eq('account_id', currentAccount.id)
      .order('expiration_date', { ascending: true });
    setExpirationDates((data || []).map(d => ({
      id: d.id,
      batch_label: d.batch_label || '',
      expiration_date: d.expiration_date,
      quantity: d.quantity,
    })));
    setLoadingExpirations(false);
  };

  const saveExpirationDates = async (productId: string) => {
    if (!currentAccount || !currentStore) return;
    // Delete removed ones
    const existingIds = expirationDates.filter(e => e.id).map(e => e.id!);
    const { data: current } = await supabase
      .from('product_expiration_dates')
      .select('id')
      .eq('product_id', productId)
      .eq('account_id', currentAccount.id);
    const toDelete = (current || []).filter(c => !existingIds.includes(c.id)).map(c => c.id);
    if (toDelete.length > 0) {
      await supabase.from('product_expiration_dates').delete().in('id', toDelete);
    }
    // Upsert
    for (const exp of expirationDates) {
      if (!exp.expiration_date) continue;
      if (exp.id) {
        await supabase.from('product_expiration_dates').update({
          batch_label: exp.batch_label || null,
          expiration_date: exp.expiration_date,
          quantity: exp.quantity,
        }).eq('id', exp.id);
      } else {
        await supabase.from('product_expiration_dates').insert({
          product_id: productId,
          account_id: currentAccount.id,
          store_id: currentStore.id,
          batch_label: exp.batch_label || null,
          expiration_date: exp.expiration_date,
          quantity: exp.quantity,
        });
      }
    }
  };

  const generateAiImage = async (productId: string, productName: string) => {
    if (!currentAccount) return;
    setGeneratingAiImage(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-product-image', {
        body: { product_id: productId, product_name: productName, account_id: currentAccount.id },
      });
      // Sem créditos → abre dialog de compra
      const errMsg = (error as any)?.message || data?.error;
      const isInsufficient =
        (data?.error === 'insufficient_credits') ||
        (typeof errMsg === 'string' && /insufficient_credits|sem cr[eé]ditos/i.test(errMsg)) ||
        ((error as any)?.context?.status === 402);
      if (isInsufficient) {
        toast({ variant: 'destructive', title: 'Sem créditos de IA', description: 'Compre um pacote para continuar gerando imagens.' });
        setShowBuyCredits(true);
        return;
      }
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.image_url) {
        setFormData(prev => ({ ...prev, image_url: data.image_url }));
        toast({ title: 'Imagem gerada com IA!', description: '1 crédito de IA foi consumido.' });
        refreshAiBalance();
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro ao gerar imagem', description: err.message });
    } finally { setGeneratingAiImage(false); }
  };

  const validateFiscalWithAi = async () => {
    if (!formData.name || formData.name.trim().length < 2) {
      toast({ variant: 'destructive', title: 'Nome obrigatório', description: 'Digite o nome do produto antes de validar com IA.' });
      return;
    }
    setValidatingFiscal(true);
    setFiscalAiResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('validate-fiscal-fields', {
        body: {
          product_name: formData.name,
          unit: formData.unit,
          current_fields: {
            ncm: formData.ncm,
            cest: formData.cest,
            cfop_default: formData.cfop_default,
            csosn: formData.csosn,
            cst_icms: formData.cst_icms,
            cst_pis: formData.cst_pis,
            cst_cofins: formData.cst_cofins,
            cst_ipi: formData.cst_ipi,
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setFiscalAiResult(data);
      if (data.ambiguous) {
        toast({ variant: 'destructive', title: 'Produto ambíguo', description: data.warning || 'A IA não conseguiu interpretar o produto. Preencha manualmente.' });
      } else {
        toast({ title: 'Sugestão fiscal gerada!', description: 'Revise os valores e clique em "Aplicar" para preencher.' });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro na validação fiscal', description: err.message });
    } finally {
      setValidatingFiscal(false);
    }
  };

  const applyFiscalSuggestions = () => {
    if (!fiscalAiResult?.suggestions) return;
    const s = fiscalAiResult.suggestions;
    setFormData(prev => ({
      ...prev,
      ncm: s.ncm || prev.ncm,
      cest: s.cest ?? prev.cest,
      cfop_default: s.cfop_default || prev.cfop_default,
      origem_icms: s.origem_icms ?? prev.origem_icms,
      cst_icms: s.cst_icms || prev.cst_icms,
      csosn: s.csosn || prev.csosn,
      cst_pis: s.cst_pis || prev.cst_pis,
      cst_cofins: s.cst_cofins || prev.cst_cofins,
      cst_ipi: s.cst_ipi || prev.cst_ipi,
      aliq_icms: s.aliq_icms ?? prev.aliq_icms,
      aliq_pis: s.aliq_pis ?? prev.aliq_pis,
      aliq_cofins: s.aliq_cofins ?? prev.aliq_cofins,
      aliq_ipi: s.aliq_ipi ?? prev.aliq_ipi,
    }));
    setFiscalAiResult(null);
    toast({ title: 'Campos fiscais preenchidos pela IA!' });
  };

  const bulkFiscalAi = async () => {
    if (!currentAccount) return;
    const targetProducts = selectedIds.size > 0
      ? products.filter(p => selectedIds.has(p.id))
      : products;

    // Filter products missing key fiscal fields
    const needsFiscal = targetProducts.filter(p => !p.ncm || !(p as any).cfop_default);
    if (needsFiscal.length === 0) {
      toast({ title: 'Todos os produtos já possuem campos fiscais preenchidos!' });
      return;
    }

    setBulkFiscalRunning(true);
    setBulkFiscalProgress({ done: 0, total: needsFiscal.length, updated: 0 });
    setBulkFiscalAmbiguous([]);

    const ambiguousList: { id: string; name: string; sku: string; warning: string }[] = [];
    let updated = 0;
    let errors = 0;

    for (const p of needsFiscal) {
      try {
        const { data, error } = await supabase.functions.invoke('validate-fiscal-fields', {
          body: {
            product_name: p.name,
            unit: p.unit,
            current_fields: {
              ncm: p.ncm,
              cest: p.cest,
              cfop_default: p.cfop_default,
              csosn: (p as any).csosn,
              cst_icms: (p as any).cst_icms,
              cst_pis: (p as any).cst_pis,
              cst_cofins: (p as any).cst_cofins,
              cst_ipi: (p as any).cst_ipi,
            },
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        if (data?.ambiguous) {
          ambiguousList.push({ id: p.id, name: p.name, sku: p.sku || '', warning: data.warning || 'Nome não interpretável' });
        } else if (data?.suggestions) {
          const s = data.suggestions;
          await supabase.from('products').update({
            ncm: s.ncm || null,
            cest: s.cest || null,
            cfop_default: s.cfop_default || null,
            origem_icms: s.origem_icms || '0',
            cst_icms: s.cst_icms || null,
            csosn: s.csosn || null,
            cst_pis: s.cst_pis || null,
            cst_cofins: s.cst_cofins || null,
            cst_ipi: s.cst_ipi || null,
            aliq_icms: s.aliq_icms ?? 0,
            aliq_pis: s.aliq_pis ?? 0,
            aliq_cofins: s.aliq_cofins ?? 0,
            aliq_ipi: s.aliq_ipi ?? 0,
          }).eq('id', p.id);
          updated++;
        }
      } catch (err) {
        errors++;
        console.error(`Fiscal AI error for ${p.name}:`, err);
      }
      setBulkFiscalProgress(prev => ({ ...prev, done: prev.done + 1, updated }));
      // Delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 1500));
    }

    setBulkFiscalRunning(false);
    setBulkFiscalAmbiguous(ambiguousList);
    setShowBulkFiscalResult(true);
    setSelectedIds(new Set());
    toast({
      title: 'Validação fiscal em massa concluída!',
      description: `${updated} atualizados, ${ambiguousList.length} ambíguos, ${errors} erros.`,
    });
    loadProducts();
  };

  const bulkGenerateImages = async () => {
    if (!currentAccount) return;
    const targetProducts = selectedIds.size > 0
      ? products.filter(p => selectedIds.has(p.id))
      : paginatedProducts;
    if (targetProducts.length === 0) {
      toast({ title: 'Nenhum produto para gerar imagem!' });
      return;
    }
    // Aviso: cada imagem consome 1 crédito de IA
    const ok = window.confirm(
      `Esta ação vai gerar ${targetProducts.length} imagem(ns) com IA e consumir ${targetProducts.length} crédito(s) do seu saldo.\n\nSaldo atual: ${aiTotalCredits} crédito(s).\n\nDeseja continuar?`,
    );
    if (!ok) return;
    if (aiTotalCredits < targetProducts.length) {
      toast({
        variant: 'destructive',
        title: 'Saldo de IA insuficiente',
        description: `Você tem ${aiTotalCredits} crédito(s) e precisa de ${targetProducts.length}. Compre um pacote para continuar.`,
      });
      setShowBuyCredits(true);
      return;
    }
    setBulkGenerating(true);
    setBulkGenProgress({ done: 0, total: targetProducts.length });
    let success = 0, errors = 0, ranOut = false;
    for (const p of targetProducts) {
      try {
        const { data, error } = await supabase.functions.invoke('generate-product-image', {
          body: { product_id: p.id, product_name: p.name, account_id: currentAccount.id },
        });
        const errMsg = (error as any)?.message || data?.error;
        const isInsufficient =
          (data?.error === 'insufficient_credits') ||
          (typeof errMsg === 'string' && /insufficient_credits|sem cr[eé]ditos/i.test(errMsg)) ||
          ((error as any)?.context?.status === 402);
        if (isInsufficient) { ranOut = true; break; }
        if (error || data?.error) { errors++; } else { success++; }
      } catch { errors++; }
      setBulkGenProgress(prev => ({ ...prev, done: prev.done + 1 }));
      await new Promise(r => setTimeout(r, 2000));
    }
    setBulkGenerating(false);
    setSelectedIds(new Set());
    refreshAiBalance();
    if (ranOut) {
      toast({
        variant: 'destructive',
        title: 'Créditos de IA esgotados',
        description: `${success} imagens criadas antes do saldo acabar. Compre mais para continuar.`,
      });
      setShowBuyCredits(true);
    } else {
      toast({ title: `Geração concluída!`, description: `${success} imagens criadas, ${errors} erros. ${success} crédito(s) consumido(s).` });
    }
    loadProducts();
  };

  useEffect(() => {
    if (currentAccount) {
      loadProducts();
      loadCategories();
      loadGroups();
    }
  }, [currentAccount]);

  const loadCategories = async () => {
    if (!currentAccount) return;
    const { data } = await supabase
      .from('products')
      .select('category')
      .eq('account_id', currentAccount.id)
      .not('category', 'is', null);
    const unique = [...new Set((data || []).map(p => p.category).filter(Boolean))] as string[];
    setCategories(unique.sort());
  };

  const loadGroups = async () => {
    if (!currentAccount) return;
    const { data } = await supabase
      .from('products')
      .select('product_group')
      .eq('account_id', currentAccount.id)
      .not('product_group', 'is', null);
    const unique = [...new Set((data || []).map((p: any) => p.product_group).filter(Boolean))] as string[];
    setGroups(unique.sort());
  };

  const loadProducts = async () => {
    if (!currentAccount) return;
    setLoading(true);

    // Load ALL products with pagination to bypass 1000 row limit
    const allProducts: Product[] = [];
    const pageSize = 1000;
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("account_id", currentAccount.id)
        .order("name")
        .range(from, from + pageSize - 1);
      if (error || !data) break;
      allProducts.push(...data);
      hasMore = data.length === pageSize;
      from += pageSize;
    }

    setProducts(allProducts);
    setLoading(false);
  };

  const openCreateModal = async () => {
    setEditingProduct(null);
    let nextSku = "";
    if (currentAccount) {
      const { data } = await supabase.rpc("generate_next_sku", { _account_id: currentAccount.id });
      if (data) nextSku = data;
    }
    setFormData({
      sku: nextSku, name: "", unit: "UN", price_default: 0, cost_default: 0,
      ncm: "", cest: "", cfop_default: "", gtin: "", description: "", ai_training: "", image_url: "",
      brand: "", weight: "", weight_unit: "g", category: "", product_group: "",
      origem_icms: "0", cst_icms: "", csosn: "", cst_pis: "", cst_cofins: "",
      cst_ipi: "", aliq_icms: 0, aliq_pis: 0, aliq_cofins: 0, aliq_ipi: 0,
      promo_price: "", promo_starts_at: "", promo_ends_at: "",
      variant_options: null,
    });
    setExpirationDates([]);
    setFiscalAiResult(null);
    setShowModal(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      sku: product.sku || "", name: product.name, unit: product.unit,
      price_default: product.price_default, cost_default: product.cost_default,
      ncm: product.ncm || "", cest: product.cest || "", cfop_default: product.cfop_default || "",
      gtin: product.gtin || "", description: (product as any).description || "", ai_training: (product as any).ai_training || "",
      image_url: (product as any).image_url || "", brand: (product as any).brand || "",
      weight: (product as any).weight ? String((product as any).weight) : "",
      weight_unit: (product as any).weight_unit || "g", category: (product as any).category || "",
      product_group: (product as any).product_group || "",
      origem_icms: (product as any).origem_icms || "0",
      cst_icms: (product as any).cst_icms || "",
      csosn: (product as any).csosn || "",
      cst_pis: (product as any).cst_pis || "",
      cst_cofins: (product as any).cst_cofins || "",
      cst_ipi: (product as any).cst_ipi || "",
      aliq_icms: (product as any).aliq_icms || 0,
      aliq_pis: (product as any).aliq_pis || 0,
      aliq_cofins: (product as any).aliq_cofins || 0,
      aliq_ipi: (product as any).aliq_ipi || 0,
      promo_price: (product as any).promo_price ? String((product as any).promo_price) : "",
      promo_starts_at: (product as any).promo_starts_at ? (product as any).promo_starts_at.slice(0, 16) : "",
      promo_ends_at: (product as any).promo_ends_at ? (product as any).promo_ends_at.slice(0, 16) : "",
      variant_options: (product as any).variant_options || null,
    });
    loadExpirationDates(product.id);
    setShowModal(true);
  };

  const cloneProduct = async (product: Product) => {
    if (!currentAccount) return;
    setSaving(true);
    try {
      const { data: nextSku } = await supabase.rpc("generate_next_sku", { _account_id: currentAccount.id });
      const { error } = await supabase.from("products").insert({
        account_id: currentAccount.id,
        sku: nextSku || null,
        name: `${product.name} (Cópia)`,
        unit: product.unit,
        price_default: product.price_default,
        cost_default: product.cost_default,
        ncm: product.ncm || null,
        cest: product.cest || null,
        cfop_default: product.cfop_default || null,
        gtin: null,
      });
      if (error) throw error;
      await logActivity({ accountId: currentAccount.id, userId: user!.id, userName: user!.email, action: 'create', entityType: 'product', details: { nome: `${product.name} (Cópia)` } });
      toast({ title: "Produto clonado!", description: "Edite o novo produto para ajustar os dados." });
      loadProducts();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao clonar", description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingProduct) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("products").delete().eq("id", deletingProduct.id);
      if (error) throw error;
      await logActivity({ accountId: currentAccount!.id, userId: user!.id, userName: user!.email, action: 'delete', entityType: 'product', entityId: deletingProduct.id, details: { nome: deletingProduct.name } });
      toast({ title: "Produto excluído!" });
      setDeletingProduct(null);
      loadProducts();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao excluir", description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase.from("products").delete().in("id", ids);
      if (error) throw error;
      await logActivity({ accountId: currentAccount!.id, userId: user!.id, userName: user!.email, action: 'delete', entityType: 'product', details: { quantidade: ids.length } });
      toast({ title: `${ids.length} produto(s) excluído(s)!` });
      setSelectedIds(new Set());
      setShowBulkDeleteConfirm(false);
      loadProducts();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao excluir", description: error.message });
    } finally {
      setBulkDeleting(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const pageIds = paginatedProducts.map((p) => p.id);
    const allPageSelected = pageIds.every((id) => selectedIds.has(id));
    if (allPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ variant: "destructive", title: "Nome é obrigatório" });
      return;
    }
    if (!currentAccount) return;
    setSaving(true);
    try {
      const payload = {
        sku: formData.sku || null,
        name: formData.name.trim(),
        unit: formData.unit,
        price_default: formData.price_default,
        cost_default: formData.cost_default,
        ncm: formData.ncm || null,
        cest: formData.cest || null,
        cfop_default: formData.cfop_default || null,
        gtin: formData.gtin || null,
        description: formData.description || null,
        ai_training: formData.ai_training || null,
        image_url: formData.image_url || null,
        brand: formData.brand || null,
        weight: formData.weight ? Number(formData.weight) : null,
        weight_unit: formData.weight_unit || 'g',
        category: formData.category || null,
        product_group: (formData as any).product_group || null,
        origem_icms: formData.origem_icms || '0',
        cst_icms: formData.cst_icms || null,
        csosn: formData.csosn || null,
        cst_pis: formData.cst_pis || null,
        cst_cofins: formData.cst_cofins || null,
        cst_ipi: formData.cst_ipi || null,
        aliq_icms: formData.aliq_icms || 0,
        aliq_pis: formData.aliq_pis || 0,
        aliq_cofins: formData.aliq_cofins || 0,
        aliq_ipi: formData.aliq_ipi || 0,
        promo_price: formData.promo_price ? Number(formData.promo_price) : null,
        promo_starts_at: formData.promo_starts_at || null,
        promo_ends_at: formData.promo_ends_at || null,
        variant_options: formData.variant_options && formData.variant_options.length > 0 ? formData.variant_options : null,
      };
      if (editingProduct) {
        const { error } = await supabase.from("products").update(payload).eq("id", editingProduct.id);
        if (error) throw error;
        await saveExpirationDates(editingProduct.id);
        await logActivity({ accountId: currentAccount.id, userId: user!.id, userName: user!.email, action: 'update', entityType: 'product', entityId: editingProduct.id, details: { nome: payload.name } });
        toast({ title: "Produto atualizado!" });
      } else {
        const { data: inserted, error } = await supabase.from("products").insert({ ...payload, account_id: currentAccount.id }).select('id').single();
        if (error) throw error;
        if (inserted && expirationDates.length > 0) {
          await saveExpirationDates(inserted.id);
        }
        await logActivity({ accountId: currentAccount.id, userId: user!.id, userName: user!.email, action: 'create', entityType: 'product', details: { nome: payload.name } });
        toast({ title: "Produto criado!" });
      }
      setShowModal(false);
      loadProducts();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const fc = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const filteredProducts = products.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q);
  });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedProducts = filteredProducts.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reset page on search
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Produtos</h1>
          <p className="text-sm text-muted-foreground">Catálogo de produtos da empresa — <span className="font-medium text-foreground">{filteredProducts.length}</span> itens</p>
        </div>
        {canManageProducts && (
          <div className="flex gap-2 flex-wrap items-center">
            {(bulkGenerating || bulkFiscalRunning) && (
              <Badge variant="outline" className="h-9 px-3 flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="text-xs">
                  {bulkFiscalRunning
                    ? `Fiscal IA: ${bulkFiscalProgress.done}/${bulkFiscalProgress.total} (${bulkFiscalProgress.updated} atualizados)`
                    : `IA: ${bulkGenProgress.done}/${bulkGenProgress.total}`
                  }
                </span>
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={bulkFiscalAi}
              disabled={bulkFiscalRunning || bulkGenerating || aiBlocked}
              title={aiBlocked ? AI_BLOCKED_MESSAGE : undefined}
              className={aiBlocked ? 'opacity-60 cursor-not-allowed' : ''}
            >
              <Settings2 className="mr-1 h-4 w-4" /> {selectedIds.size > 0 ? `Fiscal IA (${selectedIds.size})` : 'Fiscal IA (Todos)'}
            </Button>
            {selectedIds.size > 0 && (
              <>
                <Button variant="destructive" size="sm" onClick={() => setShowBulkDeleteConfirm(true)}>
                  <Trash2 className="mr-1 h-4 w-4" /> Excluir ({selectedIds.size})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={bulkGenerateImages}
                  disabled={bulkGenerating || aiBlocked}
                  title={aiBlocked ? AI_BLOCKED_MESSAGE : undefined}
                  className={aiBlocked ? 'opacity-60 cursor-not-allowed' : ''}
                >
                  <Sparkles className="mr-1 h-4 w-4" /> Gerar Imagens IA ({selectedIds.size})
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link to="/app/products/import">
                <Upload className="mr-1 h-4 w-4" /> CSV
              </Link>
            </Button>
            <Button size="sm" onClick={openCreateModal}>
              <Plus className="mr-1 h-4 w-4" /> Novo Produto
            </Button>
          </div>
        )}
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="pb-3 px-4 pt-4 sm:px-6 sm:pt-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {canManageProducts && paginatedProducts.length > 0 && (
                <input
                  type="checkbox"
                  checked={paginatedProducts.length > 0 && paginatedProducts.every(p => selectedIds.has(p.id))}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-input accent-primary"
                  title="Selecionar todos desta página"
                />
              )}
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Página {safePage} de {totalPages}
              </span>
            </div>
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-4">
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Nenhum produto encontrado</div>
          ) : (
            <>
              {/* Table Header */}
              <div className="hidden sm:grid sm:grid-cols-[48px_40px_48px_1fr_100px_100px_80px_120px] items-center px-4 sm:px-6 py-2 border-b bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <span></span>
                <span className="text-center">#</span>
                <span></span>
                <span>Produto</span>
                <span className="text-right">Preço</span>
                <span className="text-right">Custo</span>
                <span className="text-center">Status</span>
                <span className="text-center">Ações</span>
              </div>

              <div className="divide-y divide-border/60">
                {paginatedProducts.map((product, idx) => {
                  const globalIndex = (safePage - 1) * PAGE_SIZE + idx + 1;
                  return (
                    <div
                      key={product.id}
                      className={cn(
                        'group flex items-center sm:grid sm:grid-cols-[48px_40px_48px_1fr_100px_100px_80px_120px] gap-2 sm:gap-0 px-4 sm:px-6 py-3 transition-colors duration-150',
                        selectedIds.has(product.id)
                          ? 'bg-primary/5'
                          : 'hover:bg-muted/30'
                      )}
                    >
                      {/* Checkbox */}
                      <div className="flex items-center justify-center flex-shrink-0">
                        {canManageProducts ? (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(product.id)}
                            onChange={() => toggleSelect(product.id)}
                            className="h-4 w-4 rounded border-input accent-primary"
                          />
                        ) : <span className="w-4" />}
                      </div>

                      {/* Row number */}
                      <div className="flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-mono text-muted-foreground/60 tabular-nums">{globalIndex}</span>
                      </div>

                      {/* Image */}
                      <div className="flex items-center justify-center flex-shrink-0">
                        {product.image_url ? (
                          <img src={product.image_url} alt="" className="h-9 w-9 rounded-lg object-cover border border-border/50 shadow-sm" />
                        ) : (
                          <div className="h-9 w-9 rounded-lg bg-muted/60 flex items-center justify-center">
                            <Package className="h-4 w-4 text-muted-foreground/40" />
                          </div>
                        )}
                      </div>

                      {/* Product info */}
                      <div className="min-w-0 flex-1 pl-2">
                        <p className="font-medium text-sm truncate text-foreground leading-tight">{product.name}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          {product.sku && <span className="font-mono">{product.sku}</span>}
                          {product.sku && product.unit && ' • '}
                          {product.unit}
                          {(product as any).product_group && ` • ${(product as any).product_group}`}
                          {(product as any).category && ` • ${(product as any).category}`}
                        </p>
                      </div>

                      {/* Price */}
                      <div className="hidden sm:flex items-center justify-end">
                        <span className="text-sm font-semibold text-foreground tabular-nums">{fc(product.price_default)}</span>
                      </div>

                      {/* Cost */}
                      <div className="hidden sm:flex items-center justify-end">
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {product.cost_default > 0 ? fc(product.cost_default) : '—'}
                        </span>
                      </div>

                      {/* Status */}
                      <div className="hidden sm:flex items-center justify-center">
                        <span className={cn(
                          'inline-flex h-2 w-2 rounded-full',
                          product.is_active ? 'bg-success' : 'bg-muted-foreground/30'
                        )} title={product.is_active ? 'Ativo' : 'Inativo'} />
                      </div>

                      {/* Actions */}
                      {canManageProducts && (
                        <div className="flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          {aiSimEnabled && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => setAiSimProduct(product)} title="Simular no ambiente do cliente (IA)">
                              <Wand2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {aiBlocked && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/40 cursor-not-allowed" disabled title={AI_BLOCKED_MESSAGE}>
                              <Wand2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => cloneProduct(product)} title="Clonar" disabled={saving}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => openEditModal(product)} title="Editar">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeletingProduct(product)} title="Excluir">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}

                      {/* Mobile price */}
                      <div className="sm:hidden ml-auto text-right flex-shrink-0">
                        <span className="text-sm font-semibold text-foreground">{fc(product.price_default)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="px-4 sm:px-6 pt-4">
                <SmartPagination
                  currentPage={safePage}
                  totalPages={totalPages}
                  totalItems={filteredProducts.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={setCurrentPage}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Editar Produto" : "Novo Produto"}</DialogTitle>
            <DialogDescription>Preencha os dados do produto</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="geral" className="w-full">
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="geral" className="text-xs">Geral</TabsTrigger>
              <TabsTrigger value="fiscal" className="text-xs">Fiscal</TabsTrigger>
              <TabsTrigger value="varejo" className="text-xs">Varejo</TabsTrigger>
              <TabsTrigger value="imagem" className="text-xs">Imagem</TabsTrigger>
              <TabsTrigger value="variacoes" className="text-xs" disabled={!editingProduct}>
                <Settings2 className="h-3 w-3 mr-1" />Variações
              </TabsTrigger>
              <TabsTrigger value="fracionamento" className="text-xs" disabled={!editingProduct}>
                <Package className="h-3 w-3 mr-1" />Fração
              </TabsTrigger>
              <TabsTrigger value="precos" className="text-xs" disabled={!editingProduct}>
                <DollarSign className="h-3 w-3 mr-1" />Preços
              </TabsTrigger>
            </TabsList>

            {/* TAB GERAL */}
            <TabsContent value="geral" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>SKU</Label>
                  <Input value={formData.sku} onChange={e => setFormData({ ...formData, sku: e.target.value })} placeholder="SKU-0001" />
                </div>
                <div className="space-y-2">
                  <Label>Unidade</Label>
                  <Input value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} placeholder="UN" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Nome do produto" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Preço de Venda</Label>
                  <Input type="number" value={formData.price_default} onChange={e => setFormData({ ...formData, price_default: Number(e.target.value) })} min={0} step={0.01} />
                </div>
                <div className="space-y-2">
                  <Label>Custo</Label>
                  <Input type="number" value={formData.cost_default} onChange={e => setFormData({ ...formData, cost_default: Number(e.target.value) })} min={0} step={0.01} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>GTIN/EAN (Código de Barras)</Label>
                <Input value={formData.gtin} onChange={e => setFormData({ ...formData, gtin: e.target.value })} placeholder="7890000000000" />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Descrição do produto para loja online" rows={3} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Treinamento IA (chatbot WhatsApp)
                </Label>
                <Textarea
                  value={formData.ai_training}
                  onChange={e => setFormData({ ...formData, ai_training: e.target.value })}
                  rows={4}
                  placeholder={`Ensine o chatbot a falar deste produto. Exemplo:
- Produto premium, ideal para festa de aniversário infantil.
- Rende cerca de 20 docinhos por embalagem.
- Combina com forminha n°5.
- Cliente costuma perguntar se vai ao freezer: vai sim, até 30 dias.`}
                />
                <p className="text-[11px] text-muted-foreground">
                  Quanto mais detalhes você der aqui, mais o chatbot responde com confiança sobre este produto.
                </p>
              </div>
            </TabsContent>

            {/* TAB FISCAL */}
            <TabsContent value="fiscal" className="space-y-4 mt-4">
              <p className="text-xs text-muted-foreground">Dados fiscais para emissão de NF-e / NFC-e</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>NCM</Label>
                  <NcmLookup value={formData.ncm} onChange={v => setFormData({ ...formData, ncm: v })} />
                </div>
                <div className="space-y-2">
                  <Label>CEST</Label>
                  <Input value={formData.cest} onChange={e => setFormData({ ...formData, cest: e.target.value })} placeholder="00.000.00" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CFOP</Label>
                  <Input value={formData.cfop_default} onChange={e => setFormData({ ...formData, cfop_default: e.target.value })} placeholder="5102" />
                </div>
                <div className="space-y-2">
                  <Label>Origem ICMS</Label>
                  <Select value={formData.origem_icms} onValueChange={v => setFormData({ ...formData, origem_icms: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 - Nacional</SelectItem>
                      <SelectItem value="1">1 - Estrangeira (importação direta)</SelectItem>
                      <SelectItem value="2">2 - Estrangeira (mercado interno)</SelectItem>
                      <SelectItem value="3">3 - Nacional (40-70% conteúdo importado)</SelectItem>
                      <SelectItem value="5">5 - Nacional (conteúdo importado &lt; 40%)</SelectItem>
                      <SelectItem value="6">6 - Estrangeira (importação direta, sem similar)</SelectItem>
                      <SelectItem value="7">7 - Estrangeira (mercado interno, sem similar)</SelectItem>
                      <SelectItem value="8">8 - Nacional (conteúdo importado &gt; 70%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="border-t pt-3 mt-2">
                <p className="text-xs font-semibold text-muted-foreground mb-3">ICMS</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>CST ICMS</Label>
                    <Input value={formData.cst_icms} onChange={e => setFormData({ ...formData, cst_icms: e.target.value })} placeholder="00, 10, 20..." />
                  </div>
                  <div className="space-y-2">
                    <Label>CSOSN (Simples Nacional)</Label>
                    <Input value={formData.csosn} onChange={e => setFormData({ ...formData, csosn: e.target.value })} placeholder="102, 500..." />
                  </div>
                </div>
                <div className="space-y-2 mt-4">
                  <Label>Alíquota ICMS (%)</Label>
                  <Input type="number" value={formData.aliq_icms} onChange={e => setFormData({ ...formData, aliq_icms: Number(e.target.value) })} min={0} step={0.01} />
                </div>
              </div>
              <div className="border-t pt-3 mt-2">
                <p className="text-xs font-semibold text-muted-foreground mb-3">PIS / COFINS / IPI</p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>CST PIS</Label>
                    <Input value={formData.cst_pis} onChange={e => setFormData({ ...formData, cst_pis: e.target.value })} placeholder="01, 04..." />
                  </div>
                  <div className="space-y-2">
                    <Label>CST COFINS</Label>
                    <Input value={formData.cst_cofins} onChange={e => setFormData({ ...formData, cst_cofins: e.target.value })} placeholder="01, 04..." />
                  </div>
                  <div className="space-y-2">
                    <Label>CST IPI</Label>
                    <Input value={formData.cst_ipi} onChange={e => setFormData({ ...formData, cst_ipi: e.target.value })} placeholder="50, 99..." />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div className="space-y-2">
                    <Label>Alíq. PIS (%)</Label>
                    <Input type="number" value={formData.aliq_pis} onChange={e => setFormData({ ...formData, aliq_pis: Number(e.target.value) })} min={0} step={0.01} />
                  </div>
                  <div className="space-y-2">
                    <Label>Alíq. COFINS (%)</Label>
                    <Input type="number" value={formData.aliq_cofins} onChange={e => setFormData({ ...formData, aliq_cofins: Number(e.target.value) })} min={0} step={0.01} />
                  </div>
                  <div className="space-y-2">
                    <Label>Alíq. IPI (%)</Label>
                    <Input type="number" value={formData.aliq_ipi} onChange={e => setFormData({ ...formData, aliq_ipi: Number(e.target.value) })} min={0} step={0.01} />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB VAREJO */}
            <TabsContent value="varejo" className="space-y-4 mt-4">
              <p className="text-xs text-muted-foreground">Campos para varejo, supermercado e e-commerce</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Grupo</Label>
                  <div className="flex gap-2">
                    <Select value={(formData as any).product_group || '__none__'} onValueChange={v => setFormData({ ...formData, product_group: v === '__none__' ? '' : v } as any)}>
                      <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Sem grupo —</SelectItem>
                        {groups.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input value={(formData as any).product_group} onChange={e => setFormData({ ...formData, product_group: e.target.value } as any)} placeholder="Ou digite novo grupo..." className="h-8 text-xs" />
                </div>
                <div className="space-y-2">
                  <Label>Marca</Label>
                  <Input value={formData.brand} onChange={e => setFormData({ ...formData, brand: e.target.value })} placeholder="Ex: Nestlé" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <div className="flex gap-2">
                    <Select value={formData.category || '__none__'} onValueChange={v => setFormData({ ...formData, category: v === '__none__' ? '' : v })}>
                      <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Sem categoria —</SelectItem>
                        {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} placeholder="Ou digite nova..." className="h-8 text-xs" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Peso</Label>
                  <Input type="number" value={formData.weight} onChange={e => setFormData({ ...formData, weight: e.target.value })} placeholder="500" min={0} step={0.01} />
                </div>
                <div className="space-y-2">
                  <Label>Unidade de Peso</Label>
                  <Select value={formData.weight_unit} onValueChange={v => setFormData({ ...formData, weight_unit: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="g">Gramas (g)</SelectItem>
                      <SelectItem value="kg">Quilos (kg)</SelectItem>
                      <SelectItem value="ml">Mililitros (ml)</SelectItem>
                      <SelectItem value="L">Litros (L)</SelectItem>
                      <SelectItem value="un">Unidade</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Promoção */}
              <div className="border-t pt-3 mt-2">
                <p className="text-xs font-semibold text-muted-foreground mb-3">🔥 Promoção / Oferta Relâmpago</p>
                <div className="space-y-2">
                  <Label>Preço Promocional</Label>
                  <Input type="number" value={formData.promo_price} onChange={e => setFormData({ ...formData, promo_price: e.target.value })} placeholder="0.00" min={0} step={0.01} />
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div className="space-y-2">
                    <Label>Início da Promoção</Label>
                    <Input type="datetime-local" value={formData.promo_starts_at} onChange={e => setFormData({ ...formData, promo_starts_at: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Fim da Promoção</Label>
                    <Input type="datetime-local" value={formData.promo_ends_at} onChange={e => setFormData({ ...formData, promo_ends_at: e.target.value })} />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Defina o preço e o período para exibir o produto com temporizador na loja online.</p>
              </div>

              {/* Validade / Lotes */}
              <div className="border-t pt-3 mt-2">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                    <CalendarClock className="h-3.5 w-3.5" /> Controle de Validade
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setExpirationDates(prev => [...prev, { batch_label: '', expiration_date: '', quantity: 0 }])}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Adicionar Lote
                  </Button>
                </div>
                {loadingExpirations ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> Carregando...
                  </div>
                ) : expirationDates.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma validade cadastrada. Clique em "Adicionar Lote" para registrar.</p>
                ) : (
                  <div className="space-y-2">
                    {expirationDates.map((exp, idx) => {
                      const daysLeft = exp.expiration_date
                        ? Math.ceil((new Date(exp.expiration_date + 'T12:00:00').getTime() - Date.now()) / 86400000)
                        : null;
                      let statusColor = 'text-muted-foreground';
                      let statusLabel = '';
                      if (daysLeft !== null) {
                        if (daysLeft <= 0) { statusColor = 'text-destructive'; statusLabel = '⚠️ Vencido'; }
                        else if (daysLeft <= 30) { statusColor = 'text-orange-600'; statusLabel = '🔥 Saldão'; }
                        else if (daysLeft <= 90) { statusColor = 'text-yellow-600'; statusLabel = '🏷️ Promoção'; }
                      }
                      return (
                        <div key={idx} className="flex items-end gap-2 p-2 rounded border bg-muted/30">
                          <div className="space-y-1 flex-1">
                            <Label className="text-[10px]">Lote</Label>
                            <Input
                              value={exp.batch_label}
                              onChange={e => {
                                const copy = [...expirationDates];
                                copy[idx] = { ...copy[idx], batch_label: e.target.value };
                                setExpirationDates(copy);
                              }}
                              placeholder="Ex: Lote 001"
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px]">Validade</Label>
                            <Input
                              type="date"
                              value={exp.expiration_date}
                              onChange={e => {
                                const copy = [...expirationDates];
                                copy[idx] = { ...copy[idx], expiration_date: e.target.value };
                                setExpirationDates(copy);
                              }}
                              className="h-8 text-xs w-36"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px]">Qtd</Label>
                            <Input
                              type="number"
                              value={exp.quantity}
                              onChange={e => {
                                const copy = [...expirationDates];
                                copy[idx] = { ...copy[idx], quantity: Number(e.target.value) };
                                setExpirationDates(copy);
                              }}
                              min={0}
                              className="h-8 text-xs w-20"
                            />
                          </div>
                          {statusLabel && (
                            <Badge variant="outline" className={`text-[10px] ${statusColor} whitespace-nowrap`}>
                              {statusLabel}
                            </Badge>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setExpirationDates(prev => prev.filter((_, i) => i !== idx))}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground mt-1">
                  Adicione múltiplos lotes com datas de validade diferentes. Os alertas aparecem no dashboard e no relatório de validade.
                </p>
              </div>
            </TabsContent>

            {/* TAB IMAGEM */}
            <TabsContent value="imagem" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Imagem do Produto</Label>
                <div className="flex items-center gap-4">
                  {formData.image_url ? (
                    <img src={formData.image_url} alt="Produto" className="h-24 w-24 rounded-lg object-cover border" />
                  ) : (
                    <div className="h-24 w-24 rounded-lg bg-muted flex items-center justify-center border-2 border-dashed">
                      <Image className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 space-y-2">
                    <Button variant="outline" size="sm" className="relative" disabled={uploadingImage}>
                      {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                      {uploadingImage ? 'Enviando...' : 'Upload Imagem'}
                      <input
                        type="file"
                        accept="image/*"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file || !currentAccount) return;
                          setUploadingImage(true);
                          try {
                            const ext = file.name.split('.').pop();
                            const path = `${currentAccount.id}/${Date.now()}.${ext}`;
                            const { error: upErr } = await supabase.storage.from('product-images').upload(path, file, { upsert: true });
                            if (upErr) throw upErr;
                            const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(path);
                            setFormData(prev => ({ ...prev, image_url: urlData.publicUrl }));
                          } catch (err: any) {
                            toast({ variant: 'destructive', title: 'Erro no upload', description: err.message });
                          } finally { setUploadingImage(false); }
                        }}
                      />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => formData.name && (editingProduct ? generateAiImage(editingProduct.id, formData.name) : null)}
                      disabled={generatingAiImage || !formData.name || aiBlocked}
                      title={aiBlocked ? AI_BLOCKED_MESSAGE : undefined}
                      className={aiBlocked ? 'opacity-60 cursor-not-allowed' : ''}
                    >
                      {generatingAiImage ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                      {generatingAiImage ? 'Gerando...' : 'Gerar com IA'}
                    </Button>
                    {formData.image_url && (
                      <Button variant="ghost" size="sm" className="text-destructive text-xs" onClick={() => setFormData(prev => ({ ...prev, image_url: '' }))}>
                        Remover imagem
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                💡 A IA gera uma foto realista baseada no nome do produto. Funciona melhor com nomes descritivos.
                <br />
                <span className="font-medium text-foreground">⚡ Será consumido 1 crédito de IA do seu saldo</span> (saldo atual: {aiTotalCredits}).
              </p>

              {editingProduct && currentAccount ? (
                <ProductImageGallery productId={editingProduct.id} accountId={currentAccount.id} maxImages={4} />
              ) : (
                <p className="text-[11px] text-muted-foreground border-t pt-2">Salve o produto para adicionar imagens adicionais (até 4).</p>
              )}
            </TabsContent>

            {/* TAB VARIAÇÕES */}
            <TabsContent value="variacoes" className="space-y-4 mt-4">
              {editingProduct ? (
                <ProductVariants
                  productId={editingProduct.id}
                  accountId={currentAccount?.id || ''}
                  defaultPrice={formData.price_default}
                  defaultCost={formData.cost_default}
                  variantOptions={formData.variant_options}
                  onVariantOptionsChange={(opts) => setFormData(prev => ({ ...prev, variant_options: opts }))}
                />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Salve o produto primeiro para adicionar variações.
                </p>
              )}
            </TabsContent>

            {/* TAB FRACIONAMENTO */}
            <TabsContent value="fracionamento" className="space-y-4 mt-4">
              {editingProduct ? (
                <ProductPresentations
                  productId={editingProduct.id}
                  baseUnit={formData.unit || 'UN'}
                  defaultPrice={formData.price_default}
                />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Salve o produto primeiro para configurar fracionamento.
                </p>
              )}
            </TabsContent>

            {/* TAB PREÇOS (ATACADO/VAREJO) */}
            <TabsContent value="precos" className="space-y-4 mt-4">
              {editingProduct ? (
                <ProductPriceTiers
                  productId={editingProduct.id}
                  defaultPrice={formData.price_default}
                />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Salve o produto primeiro para configurar faixas de preço.
                </p>
              )}
            </TabsContent>
          </Tabs>
          <DialogFooter className="mt-4 gap-2 flex-wrap">
            {aiSimEnabled && editingProduct && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setAiSimProduct(editingProduct)}
                className="gap-2 border-primary/30 text-primary hover:bg-primary/10"
              >
                <Wand2 className="h-4 w-4" /> Simular no ambiente (IA)
              </Button>
            )}
            {aiBlocked && editingProduct && (
              <Button
                type="button"
                variant="outline"
                disabled
                title={AI_BLOCKED_MESSAGE}
                className="gap-2 opacity-60 cursor-not-allowed"
              >
                <Wand2 className="h-4 w-4" /> Simular no ambiente (IA)
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingProduct} onOpenChange={(open) => !open && setDeletingProduct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{deletingProduct?.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedIds.size} produto(s)</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {selectedIds.size} produto(s) selecionado(s)? Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Excluir Todos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Bulk Fiscal AI Results Dialog */}
      <Dialog open={showBulkFiscalResult} onOpenChange={setShowBulkFiscalResult}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" /> Resultado — Fiscal IA em Massa
            </DialogTitle>
            <DialogDescription>
              {bulkFiscalProgress.updated} produto(s) atualizado(s) automaticamente.
              {bulkFiscalAmbiguous.length > 0 && (
                <span className="block mt-1 text-destructive font-medium">
                  {bulkFiscalAmbiguous.length} produto(s) não puderam ser interpretados e precisam de revisão manual.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          {bulkFiscalAmbiguous.length > 0 ? (
            <div className="space-y-2 mt-2">
              <p className="text-sm font-semibold text-foreground">Produtos ambíguos:</p>
              <div className="divide-y divide-border rounded-md border">
                {bulkFiscalAmbiguous.map((item) => (
                  <div key={item.id} className="p-3 text-sm space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{item.name}</span>
                      {item.sku && <Badge variant="secondary" className="text-xs">{item.sku}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{item.warning}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-1"
                      onClick={() => {
                        const prod = products.find(p => p.id === item.id);
                        if (prod) {
                          setShowBulkFiscalResult(false);
                          openEditModal(prod);
                        }
                      }}
                    >
                      <Pencil className="mr-1 h-3 w-3" /> Editar produto
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mt-2">Todos os produtos foram processados com sucesso! ✅</p>
          )}
          <DialogFooter>
            <Button onClick={() => setShowBulkFiscalResult(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {aiSimProduct && (
        <AiSimulationDialog
          open={!!aiSimProduct}
          onOpenChange={(o) => { if (!o) setAiSimProduct(null); }}
          productId={aiSimProduct.id}
          productName={aiSimProduct.name}
          productImageUrl={aiSimProduct.image_url}
        />
      )}

      <BuyAiCreditsDialog open={showBuyCredits} onOpenChange={setShowBuyCredits} />
    </div>
  );
}
