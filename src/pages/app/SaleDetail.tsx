import { useEffect, useState } from 'react';
import PinAuthModal from '@/components/PinAuthModal';
import SaleEditModal from '@/components/sale/SaleEditModal';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { isModuleDisabled } from '@/utils/accountModules';
import { logActivity } from '@/utils/activityLog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { isMirandaEFarias, hasJpOrigin, setJpOrigin, stripJpOrigin } from '@/lib/saleOrigin';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { toast as sonnerToast } from 'sonner';
import {
  ArrowLeft, FileText, Loader2, Truck, CreditCard, Download, Printer,
  RefreshCw, XCircle, Mail, MessageCircle,
  Smartphone, Banknote, DollarSign, CheckCircle, Wrench, CalendarDays, Pencil
} from 'lucide-react';
import type { SaleWithDetails, SaleStatus, DeliveryStatus, FiscalDocument, PaymentMethod, CardType } from '@/types/database';
import { generateSalePDF, printSalePDF, openBlobForViewing } from '@/utils/generateSalePDF';
import { generateDanfeNfce, printDanfeNfce } from '@/utils/generateDanfeNfce';

const statusColors: Record<SaleStatus, string> = {
  draft: 'bg-status-draft',
  open: 'bg-status-open',
  paid: 'bg-status-paid',
  canceled: 'bg-status-canceled',
  crediario: 'bg-orange-500',
};

const statusLabels: Record<SaleStatus, string> = {
  draft: 'Rascunho',
  open: 'Aberta',
  paid: 'Paga',
  canceled: 'Cancelada',
  crediario: 'Crediário',
};

const deliveryStatusLabels: Record<DeliveryStatus, string> = {
  pending: 'Pendente',
  assigned: 'Atribuído',
  out_for_delivery: 'Em Entrega',
  delivered: 'Entregue',
  canceled: 'Cancelado',
};

const cardBrands = [
  'Visa', 'MasterCard', 'Elo', 'Hipercard', 'American Express',
  'Diners', 'Discover', 'Aura', 'JCB', 'UnionPay', 'Maestro',
];

export default function SaleDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, canEdit, isOwnerOrAdmin, currentAccount } = useAuth();
  const { toast } = useToast();

  const [sale, setSale] = useState<SaleWithDetails | null>(null);
  const [fiscalDocs, setFiscalDocs] = useState<FiscalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [emittingFiscal, setEmittingFiscal] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState<string | null>(null);
  const [cancellingDoc, setCancellingDoc] = useState<string | null>(null);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [sendingEmailDocId, setSendingEmailDocId] = useState<string | null>(null);
  const [commission, setCommission] = useState<{ percent: number; value: number; status: string } | null>(null);
  const [assembly, setAssembly] = useState<any>(null);
  const [sellerName, setSellerName] = useState<string>('');
  const [crediarioInstallments, setCrediarioInstallments] = useState<{ number: number; due_date: string; amount: number; status?: string; paid_at?: string | null }[]>([]);
  const [assemblers, setAssemblers] = useState<any[]>([]);
  const [creatingAssembly, setCreatingAssembly] = useState(false);
  const [showAssemblyDialog, setShowAssemblyDialog] = useState(false);
  const [asmAssemblerId, setAsmAssemblerId] = useState('');
  const [asmDate, setAsmDate] = useState('');
  const [asmTime, setAsmTime] = useState('');
  const [asmNotes, setAsmNotes] = useState('');
  const [savingAssembly, setSavingAssembly] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showCancelPinModal, setShowCancelPinModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  // Payment modal — only shown when NO payments exist yet
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cardType, setCardType] = useState<CardType>('debit');
  const [cardBrand, setCardBrand] = useState('');
  const [installments, setInstallments] = useState(1);
  const [cardFeePercent, setCardFeePercent] = useState(0);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEditPinModal, setShowEditPinModal] = useState(false);
  // CC-e (Carta de Correção)
  const [cceDocId, setCceDocId] = useState<string | null>(null);
  const [cceText, setCceText] = useState('');
  const [emittingCce, setEmittingCce] = useState(false);
  // NFS-e
  const [emittingNfse, setEmittingNfse] = useState(false);
  // NF-e Complementar
  const [complRefDocId, setComplRefDocId] = useState<string | null>(null);
  const [complValor, setComplValor] = useState('');
  const [complMotivo, setComplMotivo] = useState('');
  const [emittingCompl, setEmittingCompl] = useState(false);

  useEffect(() => {
    if (id) loadSale();
  }, [id]);

  const loadSale = async () => {
    if (!id) return;
    setLoading(true);

    const { data: saleData, error: saleError } = await supabase
      .from('sales')
      .select(`
        *,
        customers(name, document, email, phone, address_json, credit_authorized, credit_limit),
        stores(name, cnpj, ie, phone, address_json, pix_key, pix_key_type, logo_path, logo_updated_at),
        sale_items(*, products(name, sku, unit)),
        payments(*),
        deliveries(*, drivers(name, phone))
      `)
      .eq('id', id)
      .single();

    if (saleError) {
      console.error('Error loading sale:', saleError);
      setLoading(false);
      return;
    }

    setSale(saleData as unknown as SaleWithDetails);

    // Load seller name
    if ((saleData as any).seller_user_id) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', (saleData as any).seller_user_id)
        .maybeSingle();
      setSellerName(profileData?.full_name || '');
    }

    const { data: docsData } = await supabase
      .from('fiscal_documents')
      .select('*')
      .eq('sale_id', id)
      .order('created_at', { ascending: false });

    if (docsData) setFiscalDocs(docsData);

    if (user) {
      // Try to load commission - first for current user, then any (for admins)
      let { data: commData } = await supabase
        .from('commissions')
        .select('percent, value, status')
        .eq('sale_id', id)
        .maybeSingle();
      setCommission(commData || null);
    }

    // Load assembly
    const { data: asmData } = await supabase
      .from('assemblies')
      .select('*, assemblers(name, phone)')
      .eq('sale_id', id)
      .maybeSingle();
    setAssembly(asmData || null);

    // Load assemblers list
    if (saleData) {
      const { data: asmList } = await supabase
        .from('assemblers')
        .select('id, name')
        .eq('account_id', (saleData as any).account_id)
        .eq('is_active', true)
        .order('name');
      setAssemblers(asmList || []);
    }

    // Load crediário installments (for showing in Pedido PDF)
    const hasCrediario = (saleData as any)?.payments?.some?.((p: any) => p.method === 'crediario')
      || (saleData as any)?.status === 'crediario';
    if (hasCrediario) {
      const { data: arData } = await supabase
        .from('accounts_receivable')
        .select('installment_number, total_installments, due_date, amount, status, paid_at')
        .eq('sale_id', id)
        .order('installment_number', { ascending: true });
      if (arData && arData.length > 0) {
        setCrediarioInstallments(
          arData.map((r: any) => ({
            number: r.installment_number || 1,
            due_date: r.due_date,
            amount: Number(r.amount || 0),
            status: r.status,
            paid_at: r.paid_at,
          }))
        );
      } else {
        setCrediarioInstallments([]);
      }
    } else {
      setCrediarioInstallments([]);
    }

    setLoading(false);
  };

  // Mark as paid: if payments exist, just change status. Otherwise show payment modal.
  const handleMarkPaid = () => {
    if (!sale) return;
    const existingPayments = sale.payments || [];
    if (existingPayments.length > 0) {
      // Payments already registered (from PDV), just flip status
      confirmMarkPaid();
    } else {
      // No payments yet, need to register one
      setShowPaymentModal(true);
    }
  };

  const confirmMarkPaid = async () => {
    if (!id || !sale) return;
    setMarkingPaid(true);
    try {
      const { error } = await supabase
        .from('sales')
        .update({ status: 'paid' as SaleStatus, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      toast({ title: 'Venda marcada como paga!' });
      loadSale();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally { setMarkingPaid(false); }
  };

  const markAsPaidWithPayment = async () => {
    if (!id || !sale) return;
    if (paymentMethod === 'card' && !cardBrand) {
      toast({ variant: 'destructive', title: 'Selecione a bandeira do cartão' });
      return;
    }
    setMarkingPaid(true);
    try {
      const feeValue = paymentMethod === 'card' ? (sale.total * cardFeePercent) / 100 : 0;
      await supabase.from('payments').insert({
        sale_id: id,
        method: paymentMethod,
        card_type: paymentMethod === 'card' ? cardType : null,
        brand: paymentMethod === 'card' ? cardBrand : null,
        installments: paymentMethod === 'card' && cardType === 'credit' ? installments : 1,
        card_fee_percent: paymentMethod === 'card' ? cardFeePercent : 0,
        card_fee_value: feeValue,
        paid_value: sale.total,
      });
      const { error } = await supabase
        .from('sales')
        .update({ status: 'paid' as SaleStatus, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      toast({ title: 'Venda marcada como paga!' });
      setShowPaymentModal(false);
      loadSale();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally { setMarkingPaid(false); }
  };

  const createAssembly = async () => {
    if (!id || !sale) return;
    setCreatingAssembly(true);
    try {
      const { error } = await supabase.from('assemblies').insert({
        sale_id: id,
        account_id: sale.account_id,
        store_id: sale.store_id,
        status: 'pending',
      });
      if (error) throw error;
      toast({ title: 'Montagem criada!' });
      loadSale();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally {
      setCreatingAssembly(false);
    }
  };

  const openAssemblyDialog = () => {
    if (!assembly) return;
    setAsmAssemblerId(assembly.assembler_id || '');
    setAsmDate(assembly.scheduled_date || '');
    setAsmTime(assembly.scheduled_time || '');
    setAsmNotes(assembly.notes || '');
    setShowAssemblyDialog(true);
  };

  const saveAssembly = async () => {
    if (!assembly) return;
    setSavingAssembly(true);
    try {
      const newStatus = asmAssemblerId && asmDate ? 'scheduled' : assembly.status;
      const { error } = await supabase.from('assemblies').update({
        assembler_id: asmAssemblerId || null,
        scheduled_date: asmDate || null,
        scheduled_time: asmTime || null,
        notes: asmNotes || null,
        status: newStatus,
      }).eq('id', assembly.id);
      if (error) throw error;
      toast({ title: 'Montagem atualizada!' });
      setShowAssemblyDialog(false);
      loadSale();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally {
      setSavingAssembly(false);
    }
  };

  const emitFiscalDocument = async (type: 'nfe' | 'nfce') => {
    if (!id) return;
    setEmittingFiscal(true);
    try {
      const { data, error } = await supabase.functions.invoke('emit-fiscal-document', {
        body: { sale_id: id, type },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: 'Documento fiscal emitido!',
        description: `${type.toUpperCase()} enviada para processamento`,
      });
      loadSale();
    } catch (error: any) {
      // Show user-friendly message without sensitive data
      const msg = error.message || 'Erro desconhecido';
      const userMsg = msg.includes('Schema xml')
        ? 'Erro de validação no XML da nota. Verifique os dados fiscais dos produtos (NCM, CFOP) e do cliente.'
        : msg.includes('company_id')
        ? 'Configure o ID da empresa nas configurações fiscais.'
        : msg;
      toast({ variant: 'destructive', title: 'Erro ao emitir nota', description: userMsg });
    } finally { setEmittingFiscal(false); }
  };

  const checkFiscalStatus = async (docId: string) => {
    setCheckingStatus(docId);
    try {
      const { data, error } = await supabase.functions.invoke('check-fiscal-status', {
        body: { fiscal_document_id: docId },
      });
      if (error) throw error;
      const isError = data.status === 'error' || data.status === 'denied';
      toast({
        variant: isError ? 'destructive' : 'default',
        title: `Status: ${data.status_label}`,
        description: data.error_message
          ? `Motivo: ${data.error_message}`
          : data.pdf_url ? 'PDF disponível para download' : 'Aguardando processamento na SEFAZ',
      });
      loadSale();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro ao consultar status', description: error.message });
    } finally { setCheckingStatus(null); }
  };

  const cancelFiscalDocument = async (docId: string) => {
    if (!confirm('Tem certeza que deseja cancelar esta nota fiscal?')) return;
    setCancellingDoc(docId);
    try {
      const { data, error } = await supabase.functions.invoke('cancel-fiscal-document', {
        body: { fiscal_document_id: docId },
      });
      if (error) throw error;
      toast({ title: 'Nota cancelada!', description: data.message || 'Nota fiscal cancelada com sucesso.' });
      loadSale();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro ao cancelar nota', description: error.message });
    } finally { setCancellingDoc(null); }
  };

  const emitCarta = async () => {
    if (!cceDocId) return;
    if (cceText.trim().length < 15) {
      toast({ variant: 'destructive', title: 'Texto curto', description: 'A correção deve ter pelo menos 15 caracteres.' });
      return;
    }
    setEmittingCce(true);
    try {
      const { data, error } = await supabase.functions.invoke('emit-fiscal-correction', {
        body: { fiscal_document_id: cceDocId, correcao: cceText.trim() },
      });
      if (error) throw error;
      toast({ title: 'CC-e enviada!', description: data?.message || 'Carta de correção enviada à SEFAZ.' });
      setCceDocId(null);
      setCceText('');
      loadSale();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro ao emitir CC-e', description: error.message });
    } finally {
      setEmittingCce(false);
    }
  };

  const emitNfse = async () => {
    if (!id) return;
    setEmittingNfse(true);
    try {
      const { data, error } = await supabase.functions.invoke('emit-nfse', { body: { sale_id: id } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: 'NFS-e enviada!', description: 'Aguardando autorização da prefeitura.' });
      loadSale();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao emitir NFS-e', description: e.message });
    } finally { setEmittingNfse(false); }
  };

  const emitComplementar = async () => {
    if (!complRefDocId) return;
    const valor = Number(complValor);
    if (!valor || valor <= 0) { toast({ variant: 'destructive', title: 'Valor inválido' }); return; }
    if (complMotivo.trim().length < 15) { toast({ variant: 'destructive', title: 'Motivo deve ter ao menos 15 caracteres' }); return; }
    setEmittingCompl(true);
    try {
      const { data, error } = await supabase.functions.invoke('emit-nfe-complementar', {
        body: { ref_fiscal_document_id: complRefDocId, valor_complementar: valor, motivo: complMotivo.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: 'NF-e Complementar enviada!' });
      setComplRefDocId(null); setComplValor(''); setComplMotivo('');
      loadSale();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao emitir complementar', description: e.message });
    } finally { setEmittingCompl(false); }
  };

  const downloadFiscalFile = async (docId: string, format: 'pdf' | 'xml' = 'pdf') => {
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Sessão expirada.' });
        return null;
      }
      const url = `https://${projectId}.supabase.co/functions/v1/download-fiscal-file?doc_id=${docId}&format=${format}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Erro ${response.status}`);
      }
      const contentType = response.headers.get('content-type') || '';
      const isHtml = contentType.includes('text/html');
      const blob = await response.blob();
      return { blob, blobUrl: URL.createObjectURL(blob), isHtml };
    } catch (error: any) {
      toast({ variant: 'destructive', title: `Erro ao baixar ${format.toUpperCase()}`, description: error.message });
      return null;
    }
  };

  const triggerBlobDownload = (blobUrl: string, filename: string) => {
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
  };

  const openFiscalPdf = async (docId: string) => {
    const result = await downloadFiscalFile(docId, 'pdf');
    if (!result) return;
    await openBlobForViewing(result.blob, result.isHtml ? 'text/html' : 'application/pdf', docId);
  };

  const shareFiscalViaEmail = async (docId: string) => {
    const customerEmail = sale?.customers?.email;
    if (!customerEmail) {
      sonnerToast.error('Cliente sem email cadastrado', {
        description: 'Cadastre o email do cliente para enviar a nota fiscal.',
      });
      return;
    }
    setSendingEmailDocId(docId);
    const toastId = sonnerToast.loading('Enviando nota fiscal por email...', {
      description: `Destinatário: ${customerEmail}`,
    });
    try {
      const { data, error } = await supabase.functions.invoke('send-fiscal-email', {
        body: { fiscal_document_id: docId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      sonnerToast.success('Email enviado com sucesso!', {
        id: toastId,
        description: `Nota fiscal entregue em ${customerEmail}`,
        duration: 6000,
      });
    } catch (e: any) {
      sonnerToast.error('Falha no envio', {
        id: toastId,
        description: e?.message || 'Erro desconhecido ao enviar email.',
        duration: 7000,
      });
    } finally {
      setSendingEmailDocId(null);
    }
  };

  const shareFiscalViaWhatsApp = async (docId: string) => {
    const result = await downloadFiscalFile(docId, 'pdf');
    if (!result) return;
    if (navigator.share && navigator.canShare) {
      try {
        const file = new File([result.blob], `nota-fiscal-${docId.substring(0, 8)}.pdf`, { type: 'application/pdf' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ title: 'Nota Fiscal', text: 'Segue a nota fiscal.', files: [file] });
          return;
        }
      } catch {}
    }
    const phone = sale?.customers?.phone?.replace(/\D/g, '') || '';
    const whatsappNumber = phone.startsWith('55') ? phone : `55${phone}`;
    const text = encodeURIComponent('Olá! Segue a nota fiscal da sua compra.');
    triggerBlobDownload(result.blobUrl, `nota-fiscal-${docId.substring(0, 8)}.pdf`);
    window.open(`https://wa.me/${whatsappNumber}?text=${text}`, '_blank');
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleString('pt-BR');

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Venda não encontrada</p>
        <Button variant="link" asChild>
          <Link to="/app/sales">Voltar para vendas</Link>
        </Button>
      </div>
    );
  }

  const payments = sale.payments || [];
  const delivery = sale.deliveries?.[0];
  const cardFeeValue = paymentMethod === 'card' ? (sale.total * cardFeePercent) / 100 : 0;
  const isSeller = user?.id === sale.seller_user_id;
  const canMarkPaid = (sale.status === 'open' || sale.status === 'draft') && (canEdit || isSeller);
  const canEmitFiscal = sale.status === 'paid';

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/app/sales"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg sm:text-2xl font-bold text-foreground">
              Pedido #{(sale as any).order_number || '—'}
            </h1>
            <Badge className={`${statusColors[sale.status]} text-white`}>
              {statusLabels[sale.status]}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {formatDate(sale.created_at)} • Loja: {(sale as any).stores?.name || '—'}
          </p>
        </div>
        {(() => {
          const issuedDoc = fiscalDocs.find((d) => d.status === 'issued');
          if (!issuedDoc) return null;
          const label = (issuedDoc.type as string)?.toUpperCase() === 'NFCE' ? 'NFC-e' : 'NFe';
          const isSending = sendingEmailDocId === issuedDoc.id;
          return (
            <Button
              size="sm"
              variant="default"
              onClick={() => shareFiscalViaEmail(issuedDoc.id)}
              disabled={isSending}
              title={sale.customers?.email ? `Enviar para ${sale.customers.email}` : 'Cliente sem email cadastrado'}
            >
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Enviar {label} por Email
                </>
              )}
            </Button>
          );
        })()}
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Items - card layout on mobile */}
          <Card>
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Itens da Venda</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              {/* Mobile: cards */}
              <div className="space-y-2 sm:hidden">
                {sale.sale_items?.map((item: any) => (
                  <div key={item.id} className="border rounded-lg p-3 space-y-1">
                    <p className="font-medium text-sm">{item.products?.name}</p>
                    {item.products?.sku && <p className="text-xs text-muted-foreground">SKU: {item.products.sku}</p>}
                    {item.presentation_name && (
                      <p className="text-xs text-muted-foreground">📦 {item.presentation_name} ({item.sold_qty}x → {item.base_qty} {item.products?.unit})</p>
                    )}
                    <div className="flex justify-between text-sm">
                      <span>{item.presentation_name ? `${item.sold_qty}x` : `${item.qty} ${item.products?.unit}`} × {formatCurrency(item.unit_price)}</span>
                      <span className="font-medium">{formatCurrency(item.total_line)}</span>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop: table */}
              <div className="hidden sm:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium text-muted-foreground">Produto</th>
                      <th className="text-center py-2 font-medium text-muted-foreground">Qtd</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Preço Unit.</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sale.sale_items?.map((item: any) => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="py-2">
                          <p className="font-medium">{item.products?.name}</p>
                          {item.products?.sku && <p className="text-xs text-muted-foreground">SKU: {item.products.sku}</p>}
                          {item.presentation_name && (
                            <p className="text-xs text-muted-foreground">📦 {item.presentation_name}</p>
                          )}
                        </td>
                        <td className="text-center py-2">
                          {item.presentation_name
                            ? <span>{item.sold_qty}x <span className="text-xs text-muted-foreground">(= {item.base_qty} {item.products?.unit})</span></span>
                            : <span>{item.qty} {item.products?.unit}</span>
                          }
                        </td>
                        <td className="text-right py-2">{formatCurrency(item.unit_price)}</td>
                        <td className="text-right py-2 font-medium">{formatCurrency(item.total_line)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 border-t pt-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatCurrency(sale.subtotal)}</span>
                </div>
                {sale.discount > 0 && (
                  <div className="flex justify-between text-sm text-destructive">
                    <span>Desconto</span>
                    <span>-{formatCurrency(sale.discount)}</span>
                  </div>
                )}
                {(sale as any).delivery_fee > 0 && (
                  <div className="flex justify-between text-sm text-blue-600">
                    <span>Taxa de Entrega</span>
                    <span>+{formatCurrency((sale as any).delivery_fee)}</span>
                  </div>
                )}
                {Number((sale as any).assembly_fee || 0) > 0 && (
                  <div className="flex justify-between text-sm text-purple-600">
                    <span>Taxa de Montagem</span>
                    <span>+{formatCurrency(Number((sale as any).assembly_fee))}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(sale.total)}</span>
                </div>
                {(sale as any).payment_on_delivery && Number((sale as any).remaining_balance || 0) > 0 && (
                  <div className="mt-3 rounded-lg border-2 border-status-warning bg-status-warning/10 p-3 space-y-1">
                    <p className="text-xs font-bold text-status-warning uppercase">⏳ Pagamento parcial — Saldo na entrega</p>
                    <div className="flex justify-between text-sm">
                      <span>Sinal pago</span>
                      <span className="font-medium">{formatCurrency(Number((sale as any).down_payment || 0))}</span>
                    </div>
                    <div className="flex justify-between text-base font-bold text-status-warning">
                      <span>A receber na entrega</span>
                      <span>{formatCurrency(Number((sale as any).remaining_balance || 0))}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">A nota fiscal será emitida apenas quando o saldo for pago no ato da entrega.</p>
                  </div>
                )}
              </div>

              {/* Notes/Observations */}
              {(() => {
                const rawNotes = (sale as any).notes as string | null;
                const cleanNotes = stripJpOrigin(rawNotes);
                const isJp = hasJpOrigin(rawNotes);
                const showJpToggle = isMirandaEFarias((sale as any).stores?.name) && sale.status !== 'canceled';
                if (!cleanNotes && !showJpToggle) return null;
                const toggleJp = async (next: boolean) => {
                  const newNotes = setJpOrigin(cleanNotes, next);
                  const { error } = await supabase
                    .from('sales')
                    .update({ notes: newNotes || null, updated_at: new Date().toISOString() })
                    .eq('id', sale.id);
                  if (error) {
                    toast({ variant: 'destructive', title: 'Erro ao atualizar', description: error.message });
                    return;
                  }
                  setSale(prev => (prev ? ({ ...prev, notes: newNotes || null } as any) : prev));
                  toast({ title: next ? 'Marcada como JP Móveis' : 'Marcação JP removida' });
                };
                return (
                  <div className="mt-3 border-t pt-3 space-y-3">
                    {cleanNotes && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Observações</p>
                        <p className="text-sm whitespace-pre-wrap">{cleanNotes}</p>
                      </div>
                    )}
                    {showJpToggle && (
                      <div className="flex items-start justify-between gap-2 rounded-md border border-orange-300 bg-orange-50 dark:bg-orange-950/30 px-3 py-2">
                        <div className="flex-1">
                          <Label htmlFor="jp-origin-detail" className="text-xs font-semibold text-orange-700 dark:text-orange-300 cursor-pointer">
                            🔄 Esta venda é da JP Móveis (faturada aqui)
                          </Label>
                          <p className="text-[10px] text-orange-600/80 dark:text-orange-400/80 leading-tight mt-0.5">
                            Marcação temporária para organização interna enquanto a NF da JP está suspensa.
                          </p>
                        </div>
                        <Switch id="jp-origin-detail" checked={isJp} onCheckedChange={toggleJp} />
                      </div>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Payment */}
          {payments.length > 0 && (
            <Card>
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <CreditCard className="h-4 w-4 sm:h-5 sm:w-5" /> Pagamento
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                {payments.map((payment: any) => (
                  <div key={payment.id} className="space-y-1 text-sm border-b last:border-b-0 pb-2 last:pb-0">
                    <div className="flex justify-between">
                      <span>Método</span>
                      <span className="font-medium">
                        {payment.method === 'pix' && 'Pix'}
                        {payment.method === 'cash' && 'Dinheiro'}
                        {payment.method === 'card' && `Cartão ${payment.card_type === 'credit' ? 'Crédito' : 'Débito'}`}
                        {payment.method === 'crediario' && 'Crediário'}
                        {payment.method === 'financeira' && 'Financeira'}
                      </span>
                    </div>
                    {payment.brand && (
                      <div className="flex justify-between"><span>Bandeira</span><span>{payment.brand}</span></div>
                    )}
                    {payment.method === 'crediario' && payment.installments > 0 && (
                      <div className="flex justify-between">
                        <span>Parcelas</span>
                        <span className="font-medium">{payment.installments}x de {formatCurrency(payment.paid_value / payment.installments)}</span>
                      </div>
                    )}
                    {payment.method === 'card' && payment.installments > 1 && (
                      <div className="flex justify-between"><span>Parcelas</span><span>{payment.installments}x</span></div>
                    )}
                    {payment.card_fee_percent > 0 && (
                      <>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Taxa ({payment.card_fee_percent}%)</span>
                          <span>-{formatCurrency(payment.card_fee_value)}</span>
                        </div>
                        <div className="flex justify-between font-medium border-t pt-1">
                          <span>Líquido</span>
                          <span>{formatCurrency(payment.paid_value - payment.card_fee_value)}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between">
                      <span>Valor Pago</span>
                      <span className="font-medium">{formatCurrency(payment.paid_value)}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Crediário Installments */}
          {crediarioInstallments.length > 0 && (() => {
            const totalParcelas = crediarioInstallments.reduce((s, i) => s + Number(i.amount || 0), 0);
            const entrada = Number(sale?.total || 0) - totalParcelas;
            const qtd = crediarioInstallments.length;
            const valorParcela = qtd > 0 ? totalParcelas / qtd : 0;
            const todasIguais = crediarioInstallments.every(i => Math.abs(Number(i.amount) - valorParcela) < 0.01);
            const ordenadas = [...crediarioInstallments].sort((a, b) => a.due_date.localeCompare(b.due_date));
            const primeiro = ordenadas[0];
            const ultimo = ordenadas[ordenadas.length - 1];
            const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
            const hoje = new Date(); hoje.setHours(0, 0, 0, 0);

            return (
              <Card className="border-primary/30">
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 text-primary" /> Parcelamento (Crediário)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0 space-y-3">
                  {/* Resumo */}
                  <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                    {entrada > 0.009 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Entrada paga</span>
                        <span className="font-medium">{formatCurrency(entrada)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Parcelamento</span>
                      <span className="font-medium">
                        {todasIguais ? `${qtd}x de ${formatCurrency(valorParcela)}` : `${qtd} parcelas`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total parcelado</span>
                      <span className="font-medium">{formatCurrency(totalParcelas)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-1">
                      <span className="text-muted-foreground">1º vencimento</span>
                      <span>{fmtDate(primeiro.due_date)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Último vencimento</span>
                      <span>{fmtDate(ultimo.due_date)}</span>
                    </div>
                  </div>

                  {/* Tabela de parcelas */}
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">Parcela</th>
                          <th className="text-left px-3 py-2 font-medium">Vencimento</th>
                          <th className="text-right px-3 py-2 font-medium">Valor</th>
                          <th className="text-center px-3 py-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {crediarioInstallments.map((p) => {
                          const due = new Date(p.due_date + 'T12:00:00');
                          const isPaid = p.status === 'paid';
                          const isCanceled = p.status === 'canceled';
                          const isOverdue = !isPaid && !isCanceled && due < hoje;
                          return (
                            <tr key={p.number} className="border-t">
                              <td className="px-3 py-2">{p.number}/{qtd}</td>
                              <td className="px-3 py-2">{fmtDate(p.due_date)}</td>
                              <td className="px-3 py-2 text-right font-medium">{formatCurrency(p.amount)}</td>
                              <td className="px-3 py-2 text-center">
                                {isPaid && <Badge variant="default" className="bg-green-600 hover:bg-green-700">Paga</Badge>}
                                {isCanceled && <Badge variant="secondary">Cancelada</Badge>}
                                {!isPaid && !isCanceled && isOverdue && <Badge variant="destructive">Vencida</Badge>}
                                {!isPaid && !isCanceled && !isOverdue && <Badge variant="outline">Em aberto</Badge>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Commission */}
          {commission && (
            <Card className="border-primary/30">
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-primary" /> Comissão da Venda
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0 space-y-3">
                {/* Net value explanation */}
                {sale && (() => {
                  const cardFees = (sale.payments || [])
                    .filter((p: any) => p.method === 'card')
                    .reduce((sum: number, p: any) => sum + (p.card_fee_value || 0), 0);
                  const netValue = sale.total - cardFees;
                  if (cardFees > 0) {
                    return (
                      <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Valor bruto da venda</span>
                          <span>{formatCurrency(sale.total)}</span>
                        </div>
                        <div className="flex justify-between text-destructive">
                          <span>(-) Taxa do cartão</span>
                          <span>- {formatCurrency(cardFees)}</span>
                        </div>
                        <div className="flex justify-between font-semibold border-t pt-1">
                          <span>Valor líquido (base da comissão)</span>
                          <span>{formatCurrency(netValue)}</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Percentual</p>
                    <p className="text-lg sm:text-2xl font-bold text-primary">{commission.percent}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Valor Comissão</p>
                    <p className="text-lg sm:text-2xl font-bold">{formatCurrency(commission.value)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <Badge className={commission.status === 'paid' ? 'bg-green-500 text-white' : 'bg-yellow-500 text-white'}>
                      {commission.status === 'paid' ? 'Paga' : 'Pendente'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Delivery */}
          {delivery ? (
            <Card>
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Truck className="h-4 w-4 sm:h-5 sm:w-5" /> Entrega
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Tipo</span>
                  <span className="font-medium">{delivery.delivery_type === 'pickup' ? 'Retirada' : 'Entrega'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Status</span>
                  <Badge variant="secondary">{deliveryStatusLabels[delivery.status as DeliveryStatus]}</Badge>
                </div>
                {delivery.drivers && (
                  <div className="flex justify-between"><span>Entregador</span><span>{delivery.drivers.name}</span></div>
                )}
              </CardContent>
            </Card>
          ) : sale.status === 'paid' && canEdit && (
            <Card>
              <CardContent className="p-3 sm:p-6">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={async () => {
                    try {
                      const { error } = await supabase.from('deliveries').insert({
                        sale_id: sale.id,
                        account_id: sale.account_id,
                        store_id: sale.store_id,
                        status: 'pending',
                        delivery_type: 'delivery',
                      });
                      if (error) throw error;
                      toast({ title: 'Entrega criada com sucesso!' });
                      loadSale();
                    } catch (err: any) {
                      toast({ title: 'Erro ao criar entrega', description: err.message, variant: 'destructive' });
                    }
                  }}
                >
                  <Truck className="mr-2 h-4 w-4" /> Criar Pedido de Entrega
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Assembly */}
          {sale.status === 'paid' && !isModuleDisabled(currentAccount, 'assemblies') && (
            <Card>
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Wrench className="h-4 w-4 sm:h-5 sm:w-5" /> Montagem
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                {assembly ? (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Status</span>
                      <Badge variant="secondary">{
                        { pending: 'Pendente', scheduled: 'Agendada', in_progress: 'Em Andamento', completed: 'Concluída', canceled: 'Cancelada' }[assembly.status as string] || assembly.status
                      }</Badge>
                    </div>
                    {assembly.assemblers && (
                      <div className="flex justify-between text-sm"><span>Montador</span><span>{assembly.assemblers.name}</span></div>
                    )}
                    {assembly.scheduled_date && (
                      <div className="flex justify-between text-sm">
                        <span>Agendamento</span>
                        <span>{new Date(assembly.scheduled_date + 'T12:00:00').toLocaleDateString('pt-BR')}{assembly.scheduled_time ? ` às ${assembly.scheduled_time}` : ''}</span>
                      </div>
                    )}
                    {canEdit && (
                      <Button variant="outline" size="sm" className="w-full mt-2" onClick={openAssemblyDialog}>
                        <CalendarDays className="mr-2 h-4 w-4" /> Gerenciar Montagem
                      </Button>
                    )}
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="w-full" onClick={createAssembly} disabled={creatingAssembly}>
                    {creatingAssembly ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wrench className="mr-2 h-4 w-4" />}
                    Solicitar Montagem
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4 sm:space-y-6">
          {/* Customer */}
          <Card>
            <CardHeader className="p-3 sm:p-6"><CardTitle className="text-base">Cliente</CardTitle></CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              {sale.customers ? (
                <div className="space-y-1.5 text-sm">
                  <p className="font-medium text-base">{sale.customers.name}</p>
                  {(sale.customers as any).document && <p className="text-muted-foreground">CPF/CNPJ: {(sale.customers as any).document}</p>}
                  {(sale.customers as any).email && <p className="text-muted-foreground">E-mail: {(sale.customers as any).email}</p>}
                  {(sale.customers as any).phone && <p className="text-muted-foreground">Tel: {(sale.customers as any).phone}</p>}
                  {(sale.customers as any).address_json && (() => {
                    const addr = (sale.customers as any).address_json;
                    const parts = [
                      addr.logradouro || addr.street,
                      addr.numero || addr.number,
                      addr.complemento || addr.complement,
                      addr.bairro || addr.neighborhood,
                      [addr.cidade || addr.city, addr.uf || addr.state].filter(Boolean).join('/'),
                      addr.cep || addr.zipcode,
                    ].filter(Boolean);
                    return parts.length > 0 ? (
                      <div className="border-t pt-1.5 mt-1.5">
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-0.5">Endereço</p>
                        <p className="text-muted-foreground text-xs">{parts.join(', ')}</p>
                      </div>
                    ) : null;
                  })()}
                  {(sale.customers as any).credit_authorized && (
                    <div className="border-t pt-1.5 mt-1.5">
                      <p className="text-xs text-green-600">Crediário autorizado — Limite: {formatCurrency((sale.customers as any).credit_limit || 0)}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Consumidor Final</p>
              )}
            </CardContent>
          </Card>

          {/* Order Info */}
          <Card>
            <CardHeader className="p-3 sm:p-6"><CardTitle className="text-base">Informações do Pedido</CardTitle></CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Nº Pedido</span><span className="font-medium">#{(sale as any).order_number || '—'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge className={`${statusColors[sale.status]} text-white`}>{statusLabels[sale.status]}</Badge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Loja</span><span className="font-medium">{(sale as any).stores?.name}</span></div>
              {(sale as any).stores?.cnpj && <div className="flex justify-between"><span className="text-muted-foreground">CNPJ</span><span className="text-xs">{(sale as any).stores.cnpj}</span></div>}
              {sellerName && <div className="flex justify-between"><span className="text-muted-foreground">Vendedor</span><span className="font-medium">{sellerName}</span></div>}
              {(sale as any).source && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Origem</span>
                  <span className="font-medium capitalize">
                    {{ pdv: 'PDV', pdv_rapido: 'PDV Rápido', ecommerce: 'E-commerce', quote: 'Orçamento', meli: 'Mercado Livre', shopee: 'Shopee', whatsapp: 'WhatsApp' }[(sale as any).source as string] || (sale as any).source}
                  </span>
                </div>
              )}
              <div className="flex justify-between"><span className="text-muted-foreground">Criada em</span><span>{formatDate(sale.created_at)}</span></div>
              {(sale as any).updated_at && (sale as any).updated_at !== sale.created_at && (
                <div className="flex justify-between"><span className="text-muted-foreground">Atualizada em</span><span>{formatDate((sale as any).updated_at)}</span></div>
              )}
              <div className="flex justify-between border-t pt-1.5 mt-1.5"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(sale.subtotal)}</span></div>
              {sale.discount > 0 && (
                <div className="flex justify-between text-destructive"><span>Desconto</span><span>-{formatCurrency(sale.discount)}</span></div>
              )}
              {Number((sale as any).delivery_fee || 0) > 0 && (
                <div className="flex justify-between text-blue-600"><span>Entrega</span><span>+{formatCurrency(Number((sale as any).delivery_fee))}</span></div>
              )}
              {Number((sale as any).assembly_fee || 0) > 0 && (
                <div className="flex justify-between text-purple-600"><span>Montagem</span><span>+{formatCurrency(Number((sale as any).assembly_fee))}</span></div>
              )}
              <div className="flex justify-between border-t pt-1.5 mt-1"><span className="text-muted-foreground">Total</span><span className="font-bold">{formatCurrency(sale.total)}</span></div>
              {(() => {
                const cardFees = (sale.payments || [])
                  .filter((p: any) => p.method === 'card')
                  .reduce((s: number, p: any) => s + Number(p.card_fee_value || 0), 0);
                if (cardFees > 0) {
                  return (
                    <>
                      <div className="flex justify-between text-destructive"><span>(-) Taxas cartão</span><span>-{formatCurrency(cardFees)}</span></div>
                      <div className="flex justify-between font-semibold"><span>Líquido</span><span>{formatCurrency(sale.total - cardFees)}</span></div>
                    </>
                  );
                }
                return null;
              })()}
            </CardContent>
          </Card>

          {/* Cancellation Info */}
          {sale.status === 'canceled' && (
            <Card className="border-destructive/40">
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="text-base flex items-center gap-2 text-destructive">
                  <XCircle className="h-4 w-4" /> Cancelamento
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0 space-y-1.5 text-sm">
                {(sale as any).canceled_at && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Cancelada em</span><span>{formatDate((sale as any).canceled_at)}</span></div>
                )}
                {(sale as any).cancel_reason && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-0.5">Motivo</p>
                    <p className="whitespace-pre-wrap">{(sale as any).cancel_reason}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Mark as Paid */}
          {canMarkPaid && (
            <Card className="border-green-500/30">
              <CardContent className="p-3 sm:p-6">
                <Button
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={handleMarkPaid}
                  disabled={markingPaid}
                >
                  {markingPaid ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : payments.length > 0 ? (
                    <CheckCircle className="mr-2 h-4 w-4" />
                  ) : (
                    <CreditCard className="mr-2 h-4 w-4" />
                  )}
                  {payments.length > 0 ? 'Confirmar Pagamento' : 'Registrar Pagamento'}
                </Button>
                {payments.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Pagamento já registrado. Clique para confirmar.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Edit Sale */}
          {sale.status !== 'canceled' && canEdit && (
            <Card className="border-primary/30">
              <CardContent className="p-3 sm:p-6">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    if (sale.status === 'paid') {
                      setShowEditPinModal(true);
                    } else {
                      setShowEditModal(true);
                    }
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" /> Editar Venda
                </Button>
                {sale.status === 'paid' && (
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Requer PIN do dono para vendas pagas
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Cancel Sale - admin/owner only */}
          {isOwnerOrAdmin && sale.status !== 'canceled' && (
            <Card className="border-destructive/30">
              <CardContent className="p-3 sm:p-6">
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => setShowCancelPinModal(true)}
                  disabled={cancelling}
                >
                  <XCircle className="mr-2 h-4 w-4" /> Cancelar Venda
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Cancellation info */}
          {sale.status === 'canceled' && (sale as any).canceled_at && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="p-3 sm:p-6 space-y-1 text-sm">
                <p className="font-medium text-destructive">Venda Cancelada</p>
                <p className="text-muted-foreground">Em: {formatDate((sale as any).canceled_at)}</p>
                {(sale as any).cancel_reason && <p className="text-muted-foreground">Motivo: {(sale as any).cancel_reason}</p>}
              </CardContent>
            </Card>
          )}

          {/* Fiscal Documents Actions */}
          {canEmitFiscal && (
            <Card>
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4" /> Documentos Fiscais
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0 space-y-2">
                {!sale.customers && (
                  <p className="text-xs text-destructive mb-2">NF-e requer um cliente vinculado.</p>
                )}
                <Button className="w-full" size="sm" onClick={() => emitFiscalDocument('nfe')} disabled={emittingFiscal || !sale.customers}>
                  {emittingFiscal ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                  Emitir NF-e
                </Button>
                <Button variant="outline" className="w-full" size="sm" onClick={() => emitFiscalDocument('nfce')} disabled={emittingFiscal}>
                  {emittingFiscal ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                  Emitir NFC-e
                </Button>
                <Button variant="outline" className="w-full" size="sm" onClick={emitNfse} disabled={emittingNfse || !sale.customers}>
                  {emittingNfse ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                  Emitir NFS-e (Serviço)
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Fiscal Docs List */}
          {fiscalDocs.length > 0 && (
            <Card>
              <CardHeader className="p-3 sm:p-6"><CardTitle className="text-base">Notas Emitidas</CardTitle></CardHeader>
              <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0 space-y-3">
                {fiscalDocs.map((doc) => {
                  const docStatusLabels: Record<string, string> = {
                    processing: 'Processando', issued: 'Autorizada', cancelled: 'Cancelada', denied: 'Rejeitada', error: 'Erro SEFAZ',
                  };
                  const docStatusColors: Record<string, string> = {
                    processing: 'bg-yellow-500', issued: 'bg-green-500', cancelled: 'bg-red-500', denied: 'bg-red-500', error: 'bg-orange-500',
                  };
                  return (
                    <div key={doc.id} className="rounded-lg border p-2 sm:p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{doc.type.toUpperCase()}</p>
                          <Badge className={`${docStatusColors[doc.status] || 'bg-muted'} text-white text-xs`}>
                            {docStatusLabels[doc.status] || doc.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {['processing', 'error'].includes(doc.status) && (
                          <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => checkFiscalStatus(doc.id)} disabled={checkingStatus === doc.id}>
                            {checkingStatus === doc.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />} Consultar
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => openFiscalPdf(doc.id)}>
                          <Download className="mr-1 h-3 w-3" /> PDF
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => downloadFiscalFile(doc.id, 'xml').then(r => r && triggerBlobDownload(r.blobUrl, `nota-fiscal-${doc.id.substring(0, 8)}.xml`))}>
                          <Download className="mr-1 h-3 w-3" /> XML
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => shareFiscalViaEmail(doc.id)} disabled={sendingEmailDocId === doc.id}>
                          {sendingEmailDocId === doc.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Mail className="mr-1 h-3 w-3" />}
                          {sendingEmailDocId === doc.id ? 'Enviando...' : 'Email'}
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => shareFiscalViaWhatsApp(doc.id)}>
                          <MessageCircle className="mr-1 h-3 w-3" /> WhatsApp
                        </Button>
                        {doc.status === 'issued' && (
                          <Button size="sm" variant="destructive" className="h-7 text-xs px-2" onClick={() => cancelFiscalDocument(doc.id)} disabled={cancellingDoc === doc.id}>
                            {cancellingDoc === doc.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <XCircle className="mr-1 h-3 w-3" />} Cancelar
                          </Button>
                        )}
                        {doc.status === 'issued' && doc.type === 'nfe' && (
                          <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => { setCceDocId(doc.id); setCceText(''); }}>
                            <Pencil className="mr-1 h-3 w-3" /> Carta de Correção
                          </Button>
                        )}
                        {doc.status === 'issued' && doc.type === 'nfe' && (
                          <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => { setComplRefDocId(doc.id); setComplValor(''); setComplMotivo(''); }}>
                            <FileText className="mr-1 h-3 w-3" /> NF-e Complementar
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Export / Print PDF */}
          <Card>
            <CardContent className="p-3 sm:p-6 space-y-2">
              <Button variant="outline" className="w-full" size="sm" onClick={() => generateSalePDF({ sale, type: 'pedido', assembly, sellerName, installments: crediarioInstallments })}>
                <Download className="mr-2 h-4 w-4" /> Baixar Pedido (PDF)
              </Button>
              <Button variant="outline" className="w-full" size="sm" onClick={() => generateSalePDF({ sale, type: 'orcamento', assembly, sellerName, installments: crediarioInstallments })}>
                <Download className="mr-2 h-4 w-4" /> Baixar Orçamento (PDF)
              </Button>
              <Button variant="outline" className="w-full" size="sm" onClick={() => generateSalePDF({ sale, type: 'entrega', sellerName })}>
                <Truck className="mr-2 h-4 w-4" /> Comprovante Entrega (PDF)
              </Button>
              {sale.payments?.some((p: any) => p.method === 'crediario') && (
                <Button variant="outline" className="w-full" size="sm" onClick={() => generateSalePDF({ sale, type: 'crediario', sellerName, installments: crediarioInstallments })}>
                  <Download className="mr-2 h-4 w-4" /> Comprovante Crediário
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Payment Modal (only when no payments exist) */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
            <DialogDescription>Total: {formatCurrency(sale.total)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <div className="grid grid-cols-3 gap-2">
                {([['pix', Smartphone, 'Pix'], ['cash', Banknote, 'Dinheiro'], ['card', CreditCard, 'Cartão']] as const).map(([method, Icon, label]) => (
                  <Button
                    key={method}
                    variant={paymentMethod === method ? 'default' : 'outline'}
                    className="flex flex-col gap-1 h-auto py-3"
                    onClick={() => setPaymentMethod(method as PaymentMethod)}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs">{label}</span>
                  </Button>
                ))}
              </div>
            </div>
            {paymentMethod === 'card' && (
              <>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant={cardType === 'debit' ? 'default' : 'outline'} onClick={() => { setCardType('debit'); setInstallments(1); }}>Débito</Button>
                    <Button variant={cardType === 'credit' ? 'default' : 'outline'} onClick={() => setCardType('credit')}>Crédito</Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Bandeira</Label>
                  <Select value={cardBrand} onValueChange={setCardBrand}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>{cardBrands.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {cardType === 'credit' && (
                  <div className="space-y-2">
                    <Label>Parcelas</Label>
                    <Select value={String(installments)} onValueChange={(v) => setInstallments(Number(v))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 20 }, (_, i) => i + 1).map(n => (
                          <SelectItem key={n} value={String(n)}>{n}x de {formatCurrency(sale.total / n)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Taxa do Cartão (%)</Label>
                  <Input type="number" value={cardFeePercent} onChange={(e) => setCardFeePercent(Number(e.target.value))} min={0} max={100} step={0.01} />
                </div>
                {cardFeePercent > 0 && (
                  <div className="rounded-lg bg-muted p-3 space-y-1 text-sm">
                    <div className="flex justify-between"><span>Bruto</span><span>{formatCurrency(sale.total)}</span></div>
                    <div className="flex justify-between text-destructive"><span>Taxa ({cardFeePercent}%)</span><span>-{formatCurrency(cardFeeValue)}</span></div>
                    <div className="flex justify-between font-medium border-t pt-1"><span>Líquido</span><span>{formatCurrency(sale.total - cardFeeValue)}</span></div>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentModal(false)}>Cancelar</Button>
            <Button onClick={markAsPaidWithPayment} disabled={markingPaid}>
              {markingPaid && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assembly Dialog */}
      <Dialog open={showAssemblyDialog} onOpenChange={setShowAssemblyDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciar Montagem</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Montador</Label>
              <Select value={asmAssemblerId || '__none__'} onValueChange={v => setAsmAssemblerId(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {assemblers.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={asmDate} onChange={e => setAsmDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Horário</Label>
                <Input type="time" value={asmTime} onChange={e => setAsmTime(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={asmNotes} onChange={e => setAsmNotes(e.target.value)} placeholder="Observações..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssemblyDialog(false)}>Cancelar</Button>
            <Button onClick={saveAssembly} disabled={savingAssembly}>
              {savingAssembly && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PIN Auth for Cancel */}
      <PinAuthModal
        open={showCancelPinModal}
        onOpenChange={setShowCancelPinModal}
        title="Cancelar Venda"
        description="Digite o PIN do dono para autorizar o cancelamento desta venda."
        onAuthorized={() => setShowCancelDialog(true)}
      />

      {/* PIN Auth for Edit (paid sales) */}
      <PinAuthModal
        open={showEditPinModal}
        onOpenChange={setShowEditPinModal}
        title="Editar Venda Paga"
        description="Digite o PIN do dono para autorizar a edição desta venda paga."
        onAuthorized={() => setShowEditModal(true)}
      />

      {/* Sale Edit Modal */}
      <SaleEditModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        sale={sale}
        onSaved={loadSale}
      />

      {/* Cancel Sale Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Venda</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá cancelar a venda, estornar estoque, comissões, parcelas do crediário e lançamentos financeiros vinculados. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label>Motivo (opcional)</Label>
            <Textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Motivo do cancelamento..." rows={2} className="mt-2" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setCancelReason(''); }}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!id || !user) return;
                setCancelling(true);
                try {
                  const { error } = await supabase.rpc('cancel_sale' as any, {
                    _sale_id: id,
                    _user_id: user.id,
                    _reason: cancelReason || null,
                  });
                   if (error) throw error;
                   await logActivity({
                     accountId: sale!.account_id,
                     userId: user.id,
                     userName: user.email,
                     action: 'cancel',
                     entityType: 'sale',
                     entityId: id,
                     details: { reason: cancelReason || 'Sem motivo', total: sale?.total },
                   });
                   toast({ title: 'Venda cancelada', description: 'Todos os estornos foram aplicados.' });
                   setShowCancelDialog(false);
                   setCancelReason('');
                   loadSale();
                } catch (e: any) {
                  toast({ variant: 'destructive', title: 'Erro ao cancelar', description: e.message });
                } finally { setCancelling(false); }
              }}
              disabled={cancelling}
            >
              {cancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirmar Cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* CC-e — Carta de Correção Eletrônica */}
      <Dialog open={!!cceDocId} onOpenChange={(o) => { if (!o) { setCceDocId(null); setCceText(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Carta de Correção (CC-e)</DialogTitle>
            <DialogDescription>
              Use para corrigir pequenos erros na NF-e (descrição, transportadora, datas, etc.).
              Não pode alterar valores, CNPJ, NCM ou destinatário. Limite: 30 dias e 20 cartas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Texto da correção</Label>
            <Textarea
              value={cceText}
              onChange={(e) => setCceText(e.target.value.slice(0, 1000))}
              rows={5}
              placeholder="Descreva claramente o que está sendo corrigido (mín. 15, máx. 1000 caracteres)..."
            />
            <p className="text-xs text-muted-foreground text-right">{cceText.length}/1000</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCceDocId(null); setCceText(''); }} disabled={emittingCce}>
              Cancelar
            </Button>
            <Button onClick={emitCarta} disabled={emittingCce || cceText.trim().length < 15}>
              {emittingCce ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Enviar Correção
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* NF-e Complementar */}
      <Dialog open={!!complRefDocId} onOpenChange={(o) => { if (!o) { setComplRefDocId(null); setComplValor(''); setComplMotivo(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>NF-e Complementar</DialogTitle>
            <DialogDescription>
              Use para complementar valor ou imposto de uma NF-e já autorizada (ex.: diferença de preço, ICMS-ST, frete cobrado depois). Será emitida uma nova NF-e com finalidade "Complementar" referenciando a original.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Valor complementar (R$)</Label>
              <Input type="number" step="0.01" value={complValor} onChange={(e) => setComplValor(e.target.value)} placeholder="0,00" />
            </div>
            <div className="space-y-1">
              <Label>Motivo / Justificativa</Label>
              <Textarea value={complMotivo} onChange={(e) => setComplMotivo(e.target.value.slice(0, 500))} rows={4} placeholder="Descreva o motivo da complementação (mín. 15 caracteres)" />
              <p className="text-xs text-muted-foreground text-right">{complMotivo.length}/500</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setComplRefDocId(null); setComplValor(''); setComplMotivo(''); }} disabled={emittingCompl}>Cancelar</Button>
            <Button onClick={emitComplementar} disabled={emittingCompl || !complValor || complMotivo.trim().length < 15}>
              {emittingCompl ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Emitir Complementar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
