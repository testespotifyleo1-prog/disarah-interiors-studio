import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/utils/activityLog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, DollarSign, CreditCard, TrendingUp, CheckCircle, Plus,
  AlertTriangle, Clock, ArrowDownCircle, ArrowUpCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import DateRangeFilter, { getCurrentMonthRange, type DateRangeValue } from '@/components/DateRangeFilter';
import { format as fmtDate } from 'date-fns';
import { Link } from 'react-router-dom';
import type { Commission, Sale, AccountPayable, AccountReceivable } from '@/types/database';
import { hasJpOrigin, isMirandaEFarias } from '@/lib/saleOrigin';
import { isModuleEnabled, MODULE_BLOCKED_MESSAGE } from '@/utils/accountModules';

interface CommissionWithSale extends Commission {
  sales?: Sale & { profiles?: { full_name: string }; customers?: { name: string } | null };
  seller_name?: string;
  customer_name?: string;
  order_number?: number | null;
}

const categories = ['geral', 'aluguel', 'salários', 'fornecedor', 'marketing', 'utilidades', 'manutenção', 'outros'];
const receivableCategories = ['venda', 'crediário', 'serviço', 'outros'];

export default function Finance() {
  const { user, currentAccount, currentStore, isOwnerOrAdmin, userRole, stores } = useAuth();
  const { toast } = useToast();
  const isSeller = userRole === 'seller';
  const isManager = userRole === 'manager';
  // Manager só pode ver dados das lojas atribuídas a ele
  const allowedStoreIds = stores.map(s => s.id);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('resumo');
  const [commissions, setCommissions] = useState<CommissionWithSale[]>([]);
  const [payables, setPayables] = useState<AccountPayable[]>([]);
  const [receivables, setReceivables] = useState<AccountReceivable[]>([]);

  // Filters
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterStore, setFilterStore] = useState<string>(currentStore?.id || 'all');
  const [dateRange, setDateRange] = useState<DateRangeValue>(getCurrentMonthRange());
  const [commissionSellerFilter, setCommissionSellerFilter] = useState<string>('all');
  const [commissionStatusFilter, setCommissionStatusFilter] = useState<string>('all');
  const [commissionInnerTab, setCommissionInnerTab] = useState<string>('resumo-com');

  // Sync filterStore with global currentStore selector — each store has its own data
  useEffect(() => {
    setFilterStore(currentStore?.id || 'all');
  }, [currentStore?.id]);

  // Payable dialog
  const [showPayableDialog, setShowPayableDialog] = useState(false);
  const [payableForm, setPayableForm] = useState({ description: '', category: 'geral', amount: '', due_date: '', supplier_name: '', notes: '', store_id: '' });
  const [savingPayable, setSavingPayable] = useState(false);

  // Receive (a receber) dialog
  const [receiveDialog, setReceiveDialog] = useState<AccountReceivable | null>(null);
  const [receiveForm, setReceiveForm] = useState<{ method: 'cash' | 'pix' | 'card' | 'crediario' | 'financeira'; amount: string; notes: string }>({ method: 'cash', amount: '', notes: '' });
  const [receiving, setReceiving] = useState(false);

  // Manual receivable entry dialog (entrada avulsa que cai no caixa do dia)
  const [showManualReceiveDialog, setShowManualReceiveDialog] = useState(false);
  const [manualForm, setManualForm] = useState<{
    type: string; customer_name: string; amount: string;
    method: 'cash' | 'pix' | 'card' | 'crediario' | 'financeira' | 'store_credit'; notes: string; store_id: string;
  }>({ type: 'venda_antiga', customer_name: '', amount: '', method: 'cash', notes: '', store_id: '' });
  const [savingManual, setSavingManual] = useState(false);

  // Stats
  const [totalBruto, setTotalBruto] = useState(0);
  const [totalTaxas, setTotalTaxas] = useState(0);
  const [comissoesPendentes, setComissoesPendentes] = useState(0);
  const [comissoesPagas, setComissoesPagas] = useState(0);
  const [totalDespesasPagas, setTotalDespesasPagas] = useState(0);
  const [totalRecebido, setTotalRecebido] = useState(0);

  // Breakdown: caixa real vs crediário
  const [entradaCaixa, setEntradaCaixa] = useState(0);          // pagamentos efetivos (dinheiro/pix/cartão/etc.)
  const [crediarioGerado, setCrediarioGerado] = useState(0);    // valor lançado como crediário no ato da venda
  const [crediarioAberto, setCrediarioAberto] = useState(0);    // parcelas em aberto (a receber)
  const [crediarioRecebido, setCrediarioRecebido] = useState(0);// parcelas recebidas no período
  const [crediarioAtrasado, setCrediarioAtrasado] = useState(0);// parcelas vencidas em aberto

  // Recorte JP MOVEIS (somente quando a loja Miranda e Farias está envolvida)
  const [jpBruto, setJpBruto] = useState(0);
  const [jpEntradaCaixa, setJpEntradaCaixa] = useState(0);
  const [jpCrediario, setJpCrediario] = useState(0);
  const [jpQtdVendas, setJpQtdVendas] = useState(0);
  const [proprioBruto, setProprioBruto] = useState(0);
  const [proprioQtdVendas, setProprioQtdVendas] = useState(0);
  const [showJpSplit, setShowJpSplit] = useState(false);

  useEffect(() => {
    if (currentAccount) loadFinanceData();
  }, [currentAccount, currentStore, user, filterStatus, filterStore, dateRange]);

  const loadFinanceData = async () => {
    if (!currentAccount || !user) return;
    setLoading(true);
    const startISO = dateRange.startDate.toISOString();
    const endISO = dateRange.endDate.toISOString();
    const startDate = fmtDate(dateRange.startDate, 'yyyy-MM-dd');
    const endDate = fmtDate(dateRange.endDate, 'yyyy-MM-dd');
    try {
      if (isSeller) {
        const { data } = await supabase.from('commissions').select('*, sales(id, total, created_at)')
          .eq('seller_user_id', user.id)
          .gte('created_at', startISO).lte('created_at', endISO)
          .order('created_at', { ascending: false });
        setCommissions((data || []) as CommissionWithSale[]);
        const pending = (data || []).filter(c => c.status === 'pending');
        const paid = (data || []).filter(c => c.status === 'paid');
        setComissoesPendentes(pending.reduce((s, c) => s + (c.value || 0), 0));
        setComissoesPagas(paid.reduce((s, c) => s + (c.value || 0), 0));
      } else {
        // Manager: força filtro por lojas permitidas
        if (isManager && allowedStoreIds.length === 0) {
          setTotalBruto(0); setTotalTaxas(0);
          setCommissions([]); setComissoesPendentes(0); setComissoesPagas(0);
          setPayables([]); setReceivables([]);
          setTotalDespesasPagas(0); setTotalRecebido(0);
          setLoading(false);
          return;
        }

        // Sales stats — inclui status 'crediario' para que entradas em dinheiro/pix/cartão
        // dadas no ato da venda (e recebimentos de parcelas) entrem no Faturamento Bruto.
        let sq = supabase.from('sales').select('id, total, store_id, notes, status').eq('account_id', currentAccount.id).in('status', ['paid', 'crediario'])
          .gte('created_at', startISO).lte('created_at', endISO);
        if (filterStore !== 'all') sq = sq.eq('store_id', filterStore);
        else if (isManager) sq = sq.in('store_id', allowedStoreIds);
        const { data: sales } = await sq;
        const saleIds = sales?.map(s => s.id) || [];
        let tb = 0, tt = 0, eCaixa = 0, cGerado = 0;
        let jpB = 0, jpC = 0, jpEC = 0, jpQ = 0, prB = 0, prQ = 0;
        const jpSet = new Set<string>();
        const storesInResult = new Set<string>();
        (sales || []).forEach(s => {
          storesInResult.add(s.store_id);
          if (hasJpOrigin(s.notes)) {
            jpSet.add(s.id);
            jpB += Number(s.total) || 0;
            jpQ += 1;
          } else {
            // Só conta como "próprio Miranda e Farias" se a loja for, de fato, Miranda e Farias
            const storeObj = stores.find(st => st.id === s.store_id);
            if (isMirandaEFarias(storeObj?.name)) {
              prB += Number(s.total) || 0;
              prQ += 1;
            }
          }
        });

        // Verifica se exibe split JP (loja filtrada é Miranda e Farias OU está em "todas" e existe Miranda e Farias)
        const mirandaInScope = Array.from(storesInResult).some(id => {
          const st = stores.find(x => x.id === id);
          return isMirandaEFarias(st?.name);
        });
        setShowJpSplit(mirandaInScope && jpQ + prQ > 0);

        if (saleIds.length > 0) {
          // Busca paginada para evitar limite de 1000
          const allPayments: any[] = [];
          for (let i = 0; i < saleIds.length; i += 200) {
            const chunk = saleIds.slice(i, i + 200);
            const { data: pp } = await supabase.from('payments').select('sale_id, method, paid_value, card_fee_value').in('sale_id', chunk);
            if (pp) allPayments.push(...pp);
          }
          allPayments.forEach(p => {
            const v = Number(p.paid_value) || 0;
            tb += v;
            tt += Number(p.card_fee_value) || 0;
            if (p.method === 'crediario') {
              cGerado += v;
              if (jpSet.has(p.sale_id)) jpC += v;
            } else {
              eCaixa += v;
              if (jpSet.has(p.sale_id)) jpEC += v;
            }
          });
        }
        setTotalBruto(tb); setTotalTaxas(tt);
        setEntradaCaixa(eCaixa); setCrediarioGerado(cGerado);
        setJpBruto(jpB); setJpCrediario(jpC); setJpEntradaCaixa(jpEC); setJpQtdVendas(jpQ);
        setProprioBruto(prB); setProprioQtdVendas(prQ);

        // Commissions — busca paginada com filtro de data (corrige limite de 1000 linhas
        // que ocultava comissões de meses anteriores)
        const fetchAllCommissions = async () => {
          const all: any[] = [];
          const PAGE = 1000;
          let from = 0;
          while (true) {
            let q = supabase
              .from('commissions')
              .select('*, sales!inner(id, total, order_number, customer_id, created_at, account_id, store_id, customers(name))')
              .eq('sales.account_id', currentAccount.id)
              .gte('created_at', startISO)
              .lte('created_at', endISO)
              .order('created_at', { ascending: false })
              .range(from, from + PAGE - 1);
            const { data, error } = await q;
            if (error) throw error;
            const batch = data || [];
            all.push(...batch);
            if (batch.length < PAGE) break;
            from += PAGE;
          }
          return all;
        };
        const cd = await fetchAllCommissions();
        let fc = cd || [];
        if (filterStore !== 'all') fc = fc.filter((c: any) => c.sales?.store_id === filterStore);
        else if (isManager) fc = fc.filter((c: any) => allowedStoreIds.includes(c.sales?.store_id));

        // Enrich with seller name
        const sellerIds = Array.from(new Set(fc.map((c: any) => c.seller_user_id).filter(Boolean)));
        let nameMap: Record<string, string> = {};
        if (sellerIds.length > 0) {
          const { data: profs } = await supabase.from('profiles').select('user_id, full_name').in('user_id', sellerIds);
          (profs || []).forEach((p: any) => { nameMap[p.user_id] = p.full_name || 'Sem nome'; });
        }
        const enriched = fc.map((c: any) => ({
          ...c,
          seller_name: nameMap[c.seller_user_id] || 'Vendedor',
          customer_name: c.sales?.customers?.name || 'Consumidor',
          order_number: c.sales?.order_number ?? null,
        }));
        setCommissions(enriched as CommissionWithSale[]);
        setComissoesPendentes(enriched.filter(c => c.status === 'pending').reduce((s, c) => s + (c.value || 0), 0));
        setComissoesPagas(enriched.filter(c => c.status === 'paid').reduce((s, c) => s + (c.value || 0), 0));

        // Payables (filtered for display)
        let pq = supabase.from('accounts_payable').select('*').eq('account_id', currentAccount.id).order('due_date')
          .gte('due_date', startDate).lte('due_date', endDate);
        if (filterStore !== 'all') pq = pq.eq('store_id', filterStore);
        else if (isManager) pq = pq.in('store_id', allowedStoreIds);
        if (filterStatus !== 'all') pq = pq.eq('status', filterStatus);
        const { data: pd } = await pq;
        setPayables(pd || []);

        // Total paid payables (unfiltered by status for balance calc)
        let pqAll = supabase.from('accounts_payable').select('amount').eq('account_id', currentAccount.id).eq('status', 'paid');
        if (filterStore !== 'all') pqAll = pqAll.eq('store_id', filterStore);
        else if (isManager) pqAll = pqAll.in('store_id', allowedStoreIds);
        const { data: paidPayables } = await pqAll;
        setTotalDespesasPagas((paidPayables || []).reduce((s, p) => s + (p.amount || 0), 0));

        // Receivables (filtered for display) — inclui em aberto pelo VENCIMENTO no período
        // OU pagos pelo RECEBIMENTO no período (para que parcelas marcadas como pagas
        // apareçam no mês em que foram recebidas, e não só no de vencimento).
        const buildRq = (status: 'open' | 'paid') => {
          let q = supabase.from('accounts_receivable').select('*')
            .eq('account_id', currentAccount.id).eq('status', status);
          if (status === 'open') q = q.gte('due_date', startDate).lte('due_date', endDate);
          else q = q.gte('paid_at', startISO).lte('paid_at', endISO);
          if (filterStore !== 'all') q = q.eq('store_id', filterStore);
          else if (isManager) q = q.in('store_id', allowedStoreIds);
          return q;
        };
        const [openRes, paidRes] = await Promise.all([buildRq('open'), buildRq('paid')]);
        let merged = [...(openRes.data || []), ...(paidRes.data || [])];
        if (filterStatus === 'open') merged = merged.filter((r: any) => r.status === 'open');
        else if (filterStatus === 'paid') merged = merged.filter((r: any) => r.status === 'paid');
        // Enrich with customer name
        const rCustIds = Array.from(new Set(merged.map((r: any) => r.customer_id).filter(Boolean)));
        const rCustMap: Record<string, string> = {};
        if (rCustIds.length > 0) {
          const { data: rcs } = await supabase.from('customers').select('id, name').in('id', rCustIds);
          (rcs || []).forEach((c: any) => { rCustMap[c.id] = c.name; });
        }
        merged = merged.map((r: any) => ({ ...r, customer_name: r.customer_id ? rCustMap[r.customer_id] || null : null }));
        merged.sort((a: any, b: any) => {
          const da = a.status === 'paid' ? a.paid_at || a.due_date : a.due_date;
          const db = b.status === 'paid' ? b.paid_at || b.due_date : b.due_date;
          return da < db ? 1 : -1;
        });
        setReceivables(merged as any);

        // Total received (unfiltered by status for balance calc)
        let rqAll = supabase.from('accounts_receivable').select('amount').eq('account_id', currentAccount.id).eq('status', 'paid');
        if (filterStore !== 'all') rqAll = rqAll.eq('store_id', filterStore);
        else if (isManager) rqAll = rqAll.in('store_id', allowedStoreIds);
        const { data: paidReceivables } = await rqAll;
        setTotalRecebido((paidReceivables || []).reduce((s, r) => s + (r.amount || 0), 0));

        // Crediário aggregates — separa o que é crediário do que é caixa de fato
        const todayStr = new Date().toISOString().split('T')[0];
        let crq = supabase.from('accounts_receivable').select('amount, status, due_date, paid_at')
          .eq('account_id', currentAccount.id).eq('category', 'crediário');
        if (filterStore !== 'all') crq = crq.eq('store_id', filterStore);
        else if (isManager) crq = crq.in('store_id', allowedStoreIds);
        const { data: crData } = await crq;
        let cAberto = 0, cAtrasado = 0, cRecebidoNoPeriodo = 0;
        (crData || []).forEach(r => {
          const amt = Number(r.amount) || 0;
          if (r.status === 'open') {
            cAberto += amt;
            if (r.due_date && r.due_date < todayStr) cAtrasado += amt;
          } else if (r.status === 'paid' && r.paid_at) {
            const paid = new Date(r.paid_at);
            if (paid >= dateRange.startDate && paid <= dateRange.endDate) cRecebidoNoPeriodo += amt;
          }
        });
        setCrediarioAberto(cAberto);
        setCrediarioAtrasado(cAtrasado);
        setCrediarioRecebido(cRecebidoNoPeriodo);
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally { setLoading(false); }
  };

  const markCommissionPaid = async (id: string) => {
    await supabase.from('commissions').update({ status: 'paid' }).eq('id', id);
    await logActivity({ accountId: currentAccount!.id, userId: user!.id, userName: user!.email, action: 'pay', entityType: 'commission', entityId: id });
    toast({ title: 'Comissão marcada como paga' }); loadFinanceData();
  };

  const savePayable = async () => {
    if (!currentAccount || !payableForm.description || !payableForm.amount || !payableForm.due_date) {
      toast({ variant: 'destructive', title: 'Preencha todos os campos obrigatórios' }); return;
    }
    setSavingPayable(true);
    try {
      await supabase.from('accounts_payable').insert({
        account_id: currentAccount.id,
        store_id: payableForm.store_id || null,
        description: payableForm.description,
        category: payableForm.category,
        amount: Number(payableForm.amount),
        due_date: payableForm.due_date,
        supplier_name: payableForm.supplier_name || null,
        notes: payableForm.notes || null,
      });
      await logActivity({ accountId: currentAccount.id, userId: user!.id, userName: user!.email, action: 'create', entityType: 'accounts_payable', details: { descricao: payableForm.description, valor: payableForm.amount } });
      toast({ title: 'Conta a pagar criada!' });
      setShowPayableDialog(false);
      setPayableForm({ description: '', category: 'geral', amount: '', due_date: '', supplier_name: '', notes: '', store_id: '' });
      loadFinanceData();
    } catch (e: any) { toast({ variant: 'destructive', title: 'Erro', description: e.message }); }
    finally { setSavingPayable(false); }
  };

  const markPayablePaid = async (id: string) => {
    await supabase.from('accounts_payable').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', id);
    await logActivity({ accountId: currentAccount!.id, userId: user!.id, userName: user!.email, action: 'pay', entityType: 'accounts_payable', entityId: id });
    toast({ title: 'Conta marcada como paga' }); loadFinanceData();
  };

  const openReceiveDialog = (r: AccountReceivable) => {
    setReceiveDialog(r);
    setReceiveForm({ method: 'cash', amount: String(r.amount), notes: '' });
  };

  const confirmReceive = async () => {
    if (!receiveDialog) return;
    const amt = Number(receiveForm.amount);
    if (!amt || amt <= 0) {
      toast({ variant: 'destructive', title: 'Informe o valor recebido' });
      return;
    }
    setReceiving(true);
    try {
      const r = receiveDialog;
      const isCrediario = r.category === 'crediário' || !!r.sale_id;
      if (isCrediario) {
        // Usa a função do banco — registra payment, lança no caixa do dia e finaliza venda
        const { data, error } = await supabase.rpc('receive_crediario_installment', {
          _receivable_id: r.id,
          _payment_method: receiveForm.method,
          _amount: amt,
          _store_id: r.store_id,
          _notes: receiveForm.notes || null,
        });
        if (error) throw error;
        await logActivity({
          accountId: currentAccount!.id, userId: user!.id, userName: user!.email,
          action: 'pay', entityType: 'accounts_receivable', entityId: r.id,
          details: { amount: amt, method: receiveForm.method, sale_finalized: (data as any)?.sale_finalized },
        });
        const methodLabel = receiveForm.method === 'cash' ? 'Dinheiro'
          : receiveForm.method === 'pix' ? 'PIX'
          : receiveForm.method === 'card' ? 'Cartão'
          : receiveForm.method === 'crediario' ? 'Crediário'
          : 'Financeira';
        toast({
          title: 'Recebimento registrado!',
          description: (data as any)?.sale_finalized
            ? 'Última parcela paga — venda finalizada e lançada no caixa.'
            : `Lançado no caixa como ${methodLabel}.`,
        });
      } else {
        // Recebimento avulso (sem venda vinculada) — apenas marca como pago
        const { error } = await supabase.from('accounts_receivable')
          .update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', r.id);
        if (error) throw error;
        await logActivity({
          accountId: currentAccount!.id, userId: user!.id, userName: user!.email,
          action: 'pay', entityType: 'accounts_receivable', entityId: r.id,
          details: { amount: amt, method: receiveForm.method },
        });
        toast({ title: 'Conta marcada como recebida' });
      }
      setReceiveDialog(null);
      loadFinanceData();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao registrar', description: e.message });
    } finally {
      setReceiving(false);
    }
  };

  const MANUAL_TYPES: Record<string, string> = {
    venda_antiga: 'Venda antiga',
    parcela_antiga: 'Parcela antiga',
    acerto_cliente: 'Acerto de cliente',
    sinal_pedido: 'Sinal de pedido',
    outros: 'Outros',
  };

  const saveManualReceivable = async () => {
    if (!currentAccount || !user) return;
    const amt = Number(manualForm.amount);
    const storeId = manualForm.store_id || currentStore?.id;
    if (!manualForm.customer_name.trim()) {
      toast({ variant: 'destructive', title: 'Informe o nome do cliente' }); return;
    }
    if (!amt || amt <= 0) {
      toast({ variant: 'destructive', title: 'Informe um valor válido' }); return;
    }
    if (!storeId) {
      toast({ variant: 'destructive', title: 'Selecione uma loja' }); return;
    }
    setSavingManual(true);
    try {
      const typeLabel = MANUAL_TYPES[manualForm.type] || 'Outros';
      const description = `${typeLabel} — ${manualForm.customer_name.trim()}`;
      const fullNotes = manualForm.notes
        ? `Entrada manual (${typeLabel}) - Cliente: ${manualForm.customer_name.trim()} - ${manualForm.notes}`
        : `Entrada manual (${typeLabel}) - Cliente: ${manualForm.customer_name.trim()}`;
      const nowISO = new Date().toISOString();

      // 1) Cria venda "fantasma" para o caixa registrar como entrada do dia
      const { data: sale, error: saleErr } = await supabase.from('sales').insert({
        account_id: currentAccount.id,
        store_id: storeId,
        seller_user_id: user.id,
        status: 'paid',
        source: 'manual_entry',
        subtotal: amt,
        total: amt,
        remaining_balance: 0,
        notes: fullNotes,
      }).select('id').single();
      if (saleErr) throw saleErr;

      // 2) Pagamento — alimenta caixa do dia
      const { error: payErr } = await supabase.from('payments').insert({
        sale_id: sale.id,
        method: manualForm.method,
        paid_value: amt,
        notes: `Entrada manual (${typeLabel}) - ${manualForm.customer_name.trim()}`,
      });
      if (payErr) throw payErr;

      // 3) Receivable já marcado como recebido — registro auditável em "A Receber"
      await supabase.from('accounts_receivable').insert({
        account_id: currentAccount.id,
        store_id: storeId,
        sale_id: sale.id,
        description,
        category: 'outros',
        amount: amt,
        due_date: nowISO.slice(0, 10),
        status: 'paid',
        paid_at: nowISO,
      });

      await logActivity({
        accountId: currentAccount.id, userId: user.id, userName: user.email,
        action: 'create', entityType: 'manual_receivable',
        details: { tipo: typeLabel, cliente: manualForm.customer_name, valor: amt, metodo: manualForm.method },
      });

      toast({ title: 'Entrada lançada no caixa do dia!', description: `${typeLabel} — ${fc(amt)}` });
      setShowManualReceiveDialog(false);
      setManualForm({ type: 'venda_antiga', customer_name: '', amount: '', method: 'cash', notes: '', store_id: '' });
      loadFinanceData();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao lançar', description: e.message });
    } finally {
      setSavingManual(false);
    }
  };

  const fc = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  const today = new Date().toISOString().split('T')[0];
  const isOverdue = (d: string) => d < today;

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (isSeller) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl sm:text-2xl font-bold">Minhas Comissões</h1>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
          <Card><CardHeader className="pb-2 p-3"><CardTitle className="text-xs">Pendentes</CardTitle></CardHeader><CardContent className="p-3 pt-0"><div className="text-xl font-bold text-yellow-600">{fc(comissoesPendentes)}</div></CardContent></Card>
          <Card><CardHeader className="pb-2 p-3"><CardTitle className="text-xs">Pagas</CardTitle></CardHeader><CardContent className="p-3 pt-0"><div className="text-xl font-bold text-green-600">{fc(comissoesPagas)}</div></CardContent></Card>
          <Card><CardHeader className="pb-2 p-3"><CardTitle className="text-xs">Total</CardTitle></CardHeader><CardContent className="p-3 pt-0"><div className="text-xl font-bold">{fc(comissoesPendentes + comissoesPagas)}</div></CardContent></Card>
        </div>
        <div className="space-y-2">
          {commissions.map(c => (
            <div key={c.id} className="flex items-center justify-between border rounded-lg p-3">
              <div><p className="text-sm font-medium">{format(new Date(c.created_at), 'dd/MM/yyyy', { locale: ptBR })}</p><p className="text-xs text-muted-foreground">{c.percent}% = {fc(c.value)}</p></div>
              <Badge variant={c.status === 'paid' ? 'default' : 'secondary'}>{c.status === 'paid' ? 'Paga' : 'Pendente'}</Badge>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Financeiro</h1>
          <p className="text-sm text-muted-foreground">Visão geral, contas a pagar e a receber</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
          <Select value={filterStore} onValueChange={setFilterStore}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Loja" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas lojas</SelectItem>
              {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="open">Aberto</SelectItem>
              <SelectItem value="paid">Pago</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      {(() => {
        const liquido = totalBruto - totalTaxas;
        const saldo = liquido - comissoesPagas - totalDespesasPagas;
        return (
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-6">
            <Card><CardHeader className="pb-2 p-3"><CardTitle className="text-xs">Bruto</CardTitle><DollarSign className="h-3 w-3 text-muted-foreground" /></CardHeader><CardContent className="p-3 pt-0"><div className="text-lg font-bold">{fc(totalBruto)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2 p-3"><CardTitle className="text-xs">Taxas Cartão</CardTitle><CreditCard className="h-3 w-3 text-yellow-500" /></CardHeader><CardContent className="p-3 pt-0"><div className="text-lg font-bold text-yellow-600">-{fc(totalTaxas)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2 p-3"><CardTitle className="text-xs">Despesas Pagas</CardTitle><ArrowUpCircle className="h-3 w-3 text-red-500" /></CardHeader><CardContent className="p-3 pt-0"><div className="text-lg font-bold text-red-600">-{fc(totalDespesasPagas)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2 p-3"><CardTitle className="text-xs">Com. Pagas</CardTitle></CardHeader><CardContent className="p-3 pt-0"><div className="text-lg font-bold text-red-600">-{fc(comissoesPagas)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2 p-3"><CardTitle className="text-xs">Com. Pendentes</CardTitle></CardHeader><CardContent className="p-3 pt-0"><div className="text-lg font-bold text-yellow-600">{fc(comissoesPendentes)}</div></CardContent></Card>
            <Card className={saldo < 0 ? 'border-destructive' : 'border-green-500'}><CardHeader className="pb-2 p-3"><CardTitle className="text-xs">Saldo</CardTitle><TrendingUp className={`h-3 w-3 ${saldo < 0 ? 'text-destructive' : 'text-green-500'}`} /></CardHeader><CardContent className="p-3 pt-0"><div className={`text-lg font-bold ${saldo < 0 ? 'text-destructive' : 'text-green-600'}`}>{fc(saldo)}</div></CardContent></Card>
          </div>
        );
      })()}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="resumo" className="text-xs">Resumo</TabsTrigger>
          <TabsTrigger value="receber" className="text-xs">A Receber ({receivables.filter(r => r.status === 'open').length})</TabsTrigger>
          <TabsTrigger value="pagar" className="text-xs">A Pagar ({payables.filter(p => p.status === 'open').length})</TabsTrigger>
          <TabsTrigger value="comissoes" className="text-xs">Comissões</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="space-y-4">
          <Card>
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-sm">Resumo do Período</CardTitle>
              <p className="text-[11px] text-muted-foreground">Crediário aparece separado de tudo que entrou de fato no caixa.</p>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-2">
              <div className="flex justify-between border-b pb-2"><span>Faturamento Bruto (vendas)</span><span className="font-semibold">{fc(totalBruto)}</span></div>
              <div className="flex justify-between border-b pb-2 text-blue-700">
                <span className="flex flex-col">
                  <span>(=) Entrada efetiva no caixa</span>
                  <span className="text-[10px] text-muted-foreground font-normal">Dinheiro, Pix, Cartão, Crédito de loja — pagos no ato</span>
                </span>
                <span className="font-semibold">{fc(entradaCaixa)}</span>
              </div>
              <div className="flex justify-between border-b pb-2 text-emerald-700 bg-emerald-50/40 -mx-2 px-2 rounded">
                <span className="flex flex-col">
                  <span>(+) Recebimentos de Crediário (parcelas pagas no período)</span>
                  <span className="text-[10px] text-muted-foreground font-normal">Parcelas que clientes pagaram neste período — entram no caixa do dia</span>
                </span>
                <span className="font-semibold">{fc(crediarioRecebido)}</span>
              </div>
              <div className="flex justify-between border-b pb-2 text-purple-700">
                <span className="flex flex-col">
                  <span>(+) Crediário gerado no período</span>
                  <span className="text-[10px] text-muted-foreground font-normal">Vendas a prazo — ainda não entrou no caixa</span>
                </span>
                <span className="font-semibold">{fc(crediarioGerado)}</span>
              </div>
              <div className="flex justify-between border-b pb-2 text-yellow-600"><span>(-) Taxas de Cartão</span><span>{fc(totalTaxas)}</span></div>
              <div className="flex justify-between border-b pb-2 text-green-600 font-semibold"><span>= Líquido (Bruto − Taxas)</span><span className="text-lg">{fc(totalBruto - totalTaxas)}</span></div>
              <div className="flex justify-between border-b pb-2 text-red-600"><span>(-) Comissões Pagas</span><span>{fc(comissoesPagas)}</span></div>
              <div className="flex justify-between border-b pb-2 text-yellow-600"><span>(-) Comissões Pendentes</span><span>{fc(comissoesPendentes)}</span></div>
              <div className="flex justify-between border-b pb-2 text-red-600"><span>(-) Despesas Pagas</span><span>{fc(totalDespesasPagas)}</span></div>
              {(() => {
                const saldo = (totalBruto - totalTaxas) - comissoesPagas - totalDespesasPagas;
                return (
                  <div className={`flex justify-between font-bold text-lg ${saldo < 0 ? 'text-destructive' : 'text-green-600'}`}>
                    <span>= Saldo Contábil</span><span>{fc(saldo)}</span>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Card específico de Crediário */}
          <Card className="border-purple-200">
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-sm flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-purple-600" /> Crediário (vendas a prazo)
              </CardTitle>
              <p className="text-[11px] text-muted-foreground">Esses valores NÃO entraram no caixa — são parcelas a receber dos clientes.</p>
            </CardHeader>
            <CardContent className="p-3 pt-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="border rounded-lg p-2 bg-purple-50/50">
                  <p className="text-[10px] text-muted-foreground">Gerado no período</p>
                  <p className="text-base font-bold text-purple-700">{fc(crediarioGerado)}</p>
                </div>
                <div className="border rounded-lg p-2 bg-green-50/50">
                  <p className="text-[10px] text-muted-foreground">Recebido no período</p>
                  <p className="text-base font-bold text-green-700">{fc(crediarioRecebido)}</p>
                </div>
                <div className="border rounded-lg p-2 bg-yellow-50/50">
                  <p className="text-[10px] text-muted-foreground">Em aberto (total)</p>
                  <p className="text-base font-bold text-yellow-700">{fc(crediarioAberto)}</p>
                </div>
                <div className="border rounded-lg p-2 bg-red-50/50">
                  <p className="text-[10px] text-muted-foreground">Atrasado</p>
                  <p className="text-base font-bold text-red-700">{fc(crediarioAtrasado)}</p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                Para detalhar parcela a parcela, acesse a aba <button type="button" className="underline text-primary" onClick={() => setActiveTab('receber')}>"A Receber"</button> ou o menu Crediário.
              </p>
            </CardContent>
          </Card>

          {/* Recorte JP MOVEIS dentro de Miranda e Farias */}
          {showJpSplit && (
            <Card className="border-orange-300">
              <CardHeader className="p-3 pb-1">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600" /> Separação JP MOVEIS × Miranda e Farias
                </CardTitle>
                <p className="text-[11px] text-muted-foreground">
                  Ajuste temporário: vendas marcadas como <strong>JP MOVEIS</strong> estão sendo faturadas dentro da loja Miranda e Farias.
                  Aqui mostramos o que é de cada uma.
                </p>
              </CardHeader>
              <CardContent className="p-3 pt-2 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="border-2 border-orange-300 rounded-lg p-3 bg-orange-50/40">
                    <p className="text-xs font-semibold text-orange-700 mb-2">JP MOVEIS ({jpQtdVendas} vendas)</p>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between"><span>Faturamento Bruto</span><span className="font-semibold">{fc(jpBruto)}</span></div>
                      <div className="flex justify-between text-blue-700"><span>Entrada no caixa</span><span className="font-semibold">{fc(jpEntradaCaixa)}</span></div>
                      <div className="flex justify-between text-purple-700"><span>Crediário gerado</span><span className="font-semibold">{fc(jpCrediario)}</span></div>
                    </div>
                  </div>
                  <div className="border-2 border-primary/40 rounded-lg p-3 bg-primary/5">
                    <p className="text-xs font-semibold text-primary mb-2">Miranda e Farias (próprio) ({proprioQtdVendas} vendas)</p>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between"><span>Faturamento Bruto</span><span className="font-semibold">{fc(proprioBruto)}</span></div>
                      <div className="flex justify-between text-blue-700"><span>Entrada no caixa</span><span className="font-semibold">{fc(entradaCaixa - jpEntradaCaixa)}</span></div>
                      <div className="flex justify-between text-purple-700"><span>Crediário gerado</span><span className="font-semibold">{fc(crediarioGerado - jpCrediario)}</span></div>
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Quando a regularização fiscal da JP MOVEIS for concluída, este recorte deixa de aparecer automaticamente.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="receber">
          <Card>
            <CardHeader className="p-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2"><ArrowDownCircle className="h-4 w-4 text-green-500" /> Contas a Receber</CardTitle>
              <Button size="sm" className="h-7 text-xs" onClick={() => {
                setManualForm(f => ({ ...f, store_id: currentStore?.id || '' }));
                setShowManualReceiveDialog(true);
              }}>
                <Plus className="mr-1 h-3 w-3" /> Novo recebimento
              </Button>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              {receivables.length === 0 ? <p className="text-center text-muted-foreground py-8 text-sm">Nenhuma conta a receber</p> : (
                <div className="space-y-2">
                  {receivables.map((r: any) => (
                    <div key={r.id} className={`border rounded-lg p-3 space-y-1 ${r.status === 'open' && isOverdue(r.due_date) ? 'border-destructive/50 bg-destructive/5' : r.status === 'paid' ? 'bg-green-50/40 border-green-200' : ''}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{r.description}</p>
                          {r.customer_name && (
                            <p className="text-xs text-muted-foreground truncate">Cliente: <span className="font-medium text-foreground">{r.customer_name}</span></p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {r.status === 'open' && isOverdue(r.due_date) && <AlertTriangle className="h-3 w-3 text-destructive" />}
                          {r.category === 'crediário' && <Badge variant="outline" className="text-[10px] border-purple-300 text-purple-700">Crediário</Badge>}
                          {r.category === 'outros' && r.description?.includes(' — ') && <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-700">Entrada Manual</Badge>}
                          <Badge variant={r.status === 'paid' ? 'default' : 'secondary'} className="text-xs">{r.status === 'paid' ? 'Recebido' : isOverdue(r.due_date) ? 'Atrasado' : 'Aberto'}</Badge>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          Vence: {format(new Date(r.due_date + 'T12:00:00'), 'dd/MM/yyyy')}
                          {r.total_installments && r.total_installments > 1 ? ` (parcela ${r.installment_number}/${r.total_installments})` : ''}
                          {r.status === 'paid' && r.paid_at && (
                            <span className="ml-2 text-green-700">• Recebido em {format(new Date(r.paid_at), 'dd/MM/yyyy')}</span>
                          )}
                        </span>
                        <span className="font-semibold text-foreground">{fc(r.amount)}</span>
                      </div>
                      {r.status === 'open' && (
                        <Button size="sm" variant="outline" className="h-7 text-xs mt-1" onClick={() => openReceiveDialog(r)}>
                          <CheckCircle className="mr-1 h-3 w-3" /> Marcar recebido
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pagar">
          <Card>
            <CardHeader className="p-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2"><ArrowUpCircle className="h-4 w-4 text-red-500" /> Contas a Pagar</CardTitle>
              <Button size="sm" className="h-7 text-xs" onClick={() => setShowPayableDialog(true)}><Plus className="mr-1 h-3 w-3" /> Nova</Button>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              {payables.length === 0 ? <p className="text-center text-muted-foreground py-8 text-sm">Nenhuma conta a pagar</p> : (
                <div className="space-y-2">
                  {payables.map(p => (
                    <div key={p.id} className={`border rounded-lg p-3 space-y-1 ${p.status === 'open' && isOverdue(p.due_date) ? 'border-destructive/50 bg-destructive/5' : ''}`}>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{p.description}</p>
                        <Badge variant={p.status === 'paid' ? 'default' : 'secondary'} className="text-xs">{p.status === 'paid' ? 'Pago' : isOverdue(p.due_date) ? 'Atrasado' : 'Aberto'}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{p.supplier_name && `${p.supplier_name} • `}Vence: {format(new Date(p.due_date + 'T12:00:00'), 'dd/MM/yyyy')}</span>
                        <span className="font-semibold text-foreground">{fc(p.amount)}</span>
                      </div>
                      {p.status === 'open' && isOwnerOrAdmin && (
                        <Button size="sm" variant="outline" className="h-7 text-xs mt-1" onClick={() => markPayablePaid(p.id)}>
                          <CheckCircle className="mr-1 h-3 w-3" /> Marcar pago
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comissoes">
          <Card>
            <CardContent className="p-3 space-y-3">
              {/* Filtros internos da aba de Comissões */}
              <div className="flex flex-wrap items-center gap-2">
                <Select value={commissionSellerFilter} onValueChange={setCommissionSellerFilter}>
                  <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue placeholder="Vendedor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos vendedores</SelectItem>
                    {Array.from(new Map(commissions.map(c => [c.seller_user_id, c.seller_name || 'Vendedor'])).entries()).map(([id, name]) => (
                      <SelectItem key={id} value={id}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={commissionStatusFilter} onValueChange={setCommissionStatusFilter}>
                  <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos status</SelectItem>
                    <SelectItem value="pending">Pendentes</SelectItem>
                    <SelectItem value="paid">Pagas</SelectItem>
                  </SelectContent>
                </Select>
                {(commissionSellerFilter !== 'all' || commissionStatusFilter !== 'all') && (
                  <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setCommissionSellerFilter('all'); setCommissionStatusFilter('all'); }}>
                    Limpar filtros
                  </Button>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  Total carregado: {commissions.length} comissões
                </span>
              </div>

              {commissions.length === 0 ? <p className="text-center text-muted-foreground py-8 text-sm">Nenhuma comissão no período</p> : (() => {
                const filtered = commissions.filter(c =>
                  (commissionSellerFilter === 'all' || c.seller_user_id === commissionSellerFilter) &&
                  (commissionStatusFilter === 'all' || c.status === commissionStatusFilter)
                );
                return (
                <Tabs value={commissionInnerTab} onValueChange={setCommissionInnerTab} className="w-full">
                  <TabsList className="h-auto">
                    <TabsTrigger value="resumo-com" className="text-xs">Resumo por vendedor</TabsTrigger>
                    <TabsTrigger value="detalhado-com" className="text-xs">Detalhado ({filtered.length})</TabsTrigger>
                  </TabsList>

                  <TabsContent value="resumo-com" className="mt-3">
                    {(() => {
                      const groups = new Map<string, { id: string; name: string; pending: number; paid: number; count: number }>();
                      commissions.forEach(c => {
                        if (commissionStatusFilter !== 'all' && c.status !== commissionStatusFilter) return;
                        const key = c.seller_user_id;
                        const cur = groups.get(key) || { id: key, name: c.seller_name || 'Vendedor', pending: 0, paid: 0, count: 0 };
                        if (c.status === 'paid') cur.paid += c.value || 0;
                        else if (c.status === 'pending') cur.pending += c.value || 0;
                        cur.count += 1;
                        groups.set(key, cur);
                      });
                      const rows = Array.from(groups.values()).sort((a, b) => (b.pending + b.paid) - (a.pending + a.paid));
                      if (rows.length === 0) return <p className="text-center text-muted-foreground py-6 text-sm">Sem dados para este filtro</p>;
                      return (
                        <div className="space-y-2">
                          {rows.map((g) => (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => { setCommissionSellerFilter(g.id); setCommissionInnerTab('detalhado-com'); }}
                              className="w-full text-left border rounded-lg p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 items-center hover:bg-muted/50 transition-colors"
                              title="Clique para ver as comissões deste vendedor"
                            >
                              <div className="col-span-2 sm:col-span-1">
                                <p className="text-sm font-semibold truncate text-primary">{g.name}</p>
                                <p className="text-[10px] text-muted-foreground">{g.count} comissões</p>
                              </div>
                              <div className="text-xs">
                                <span className="text-muted-foreground">Pendente</span>
                                <p className="font-semibold text-yellow-600">{fc(g.pending)}</p>
                              </div>
                              <div className="text-xs">
                                <span className="text-muted-foreground">Pago</span>
                                <p className="font-semibold text-green-600">{fc(g.paid)}</p>
                              </div>
                              <div className="text-xs">
                                <span className="text-muted-foreground">Total</span>
                                <p className="font-bold">{fc(g.pending + g.paid)}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </TabsContent>

                  <TabsContent value="detalhado-com" className="mt-3">
                    {filtered.length === 0 ? (
                      <p className="text-center text-muted-foreground py-6 text-sm">Nenhuma comissão para este filtro</p>
                    ) : (
                      <div className="space-y-2">
                        {filtered.map(c => (
                          <div key={c.id} className="flex items-center justify-between border rounded-lg p-3 gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{c.seller_name || 'Vendedor'}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {c.order_number ? <Link to={`/app/sales/${c.sale_id}`} className="text-primary hover:underline font-medium">Pedido #{c.order_number}</Link> : <span className="font-mono">#{c.sale_id.slice(0, 8)}</span>}
                                {c.customer_name && <> • {c.customer_name}</>}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(c.created_at), 'dd/MM/yyyy', { locale: ptBR })} • {c.percent}% = {fc(c.value)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Badge variant={c.status === 'paid' ? 'default' : 'secondary'}>{c.status === 'paid' ? 'Paga' : 'Pendente'}</Badge>
                              {c.status === 'pending' && isOwnerOrAdmin && (
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => markCommissionPaid(c.id)}>
                                  <CheckCircle className="mr-1 h-3 w-3" /> Pagar
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Manual Receivable Entry Dialog */}
      <Dialog open={showManualReceiveDialog} onOpenChange={setShowManualReceiveDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo recebimento (entrada no caixa)</DialogTitle>
            <p className="text-xs text-muted-foreground">
              Lança um valor diretamente no caixa do dia. Aparece em Vendas, Caixa e Financeiro com o tipo e o cliente identificados.
            </p>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Tipo da entrada *</Label>
              <Select value={manualForm.type} onValueChange={v => setManualForm({ ...manualForm, type: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(MANUAL_TYPES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cliente *</Label>
              <Input
                placeholder="Nome do cliente"
                value={manualForm.customer_name}
                onChange={e => setManualForm({ ...manualForm, customer_name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Valor *</Label>
              <Input type="number" step="0.01" value={manualForm.amount}
                onChange={e => setManualForm({ ...manualForm, amount: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Forma de pagamento *</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { v: 'cash', label: 'Dinheiro' },
                  { v: 'pix', label: 'PIX' },
                  { v: 'card', label: 'Cartão' },
                  { v: 'financeira', label: 'Financeira' },
                  { v: 'store_credit', label: 'Crédito de loja' },
                  { v: 'crediario', label: 'Crediário' },
                ].map(opt => {
                  const blocked = opt.v === 'crediario' && !isModuleEnabled(currentAccount, 'crediario');
                  const active = manualForm.method === opt.v;
                  return (
                    <button
                      type="button"
                      key={opt.v}
                      disabled={blocked}
                      onClick={() => {
                        if (blocked) {
                          toast({ variant: 'destructive', title: 'Crediário bloqueado', description: MODULE_BLOCKED_MESSAGE });
                          return;
                        }
                        setManualForm({ ...manualForm, method: opt.v as any });
                      }}
                      className={`h-10 rounded-md border text-xs font-medium transition ${
                        active
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background hover:bg-muted'
                      } ${blocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {opt.label}{blocked ? ' (bloq.)' : ''}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Loja *</Label>
              <Select value={manualForm.store_id} onValueChange={v => setManualForm({ ...manualForm, store_id: v })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecione a loja" /></SelectTrigger>
                <SelectContent>{stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Observações</Label>
              <Textarea value={manualForm.notes} rows={2}
                placeholder="Ex.: referente ao pedido #123 / parcela 3 de 5..."
                onChange={e => setManualForm({ ...manualForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManualReceiveDialog(false)}>Cancelar</Button>
            <Button onClick={saveManualReceivable} disabled={savingManual}>
              {savingManual && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Lançar no caixa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Payable Dialog */}
      <Dialog open={showPayableDialog} onOpenChange={setShowPayableDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Conta a Pagar</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs">Descrição *</Label><Input value={payableForm.description} onChange={e => setPayableForm({ ...payableForm, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Valor *</Label><Input type="number" value={payableForm.amount} onChange={e => setPayableForm({ ...payableForm, amount: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">Vencimento *</Label><Input type="date" value={payableForm.due_date} onChange={e => setPayableForm({ ...payableForm, due_date: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Categoria</Label>
                <Select value={payableForm.category} onValueChange={v => setPayableForm({ ...payableForm, category: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Loja</Label>
                <Select value={payableForm.store_id} onValueChange={v => setPayableForm({ ...payableForm, store_id: v })}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>{stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1"><Label className="text-xs">Fornecedor</Label><Input value={payableForm.supplier_name} onChange={e => setPayableForm({ ...payableForm, supplier_name: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Obs</Label><Textarea value={payableForm.notes} onChange={e => setPayableForm({ ...payableForm, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayableDialog(false)}>Cancelar</Button>
            <Button onClick={savePayable} disabled={savingPayable}>{savingPayable && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receive Dialog */}
      <Dialog open={!!receiveDialog} onOpenChange={(o) => !o && setReceiveDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar recebimento</DialogTitle>
          </DialogHeader>
          {receiveDialog && (
            <div className="space-y-3">
              <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1">
                <p className="font-medium text-foreground">{receiveDialog.description}</p>
                <p className="text-muted-foreground">
                  Vence: {format(new Date(receiveDialog.due_date + 'T12:00:00'), 'dd/MM/yyyy')}
                  {receiveDialog.total_installments && receiveDialog.total_installments > 1 ? ` • Parcela ${receiveDialog.installment_number}/${receiveDialog.total_installments}` : ''}
                </p>
                <p className="text-muted-foreground">Valor da parcela: <span className="font-semibold text-foreground">{fc(receiveDialog.amount)}</span></p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Forma de pagamento *</Label>
                  <Select value={receiveForm.method} onValueChange={(v: any) => {
                    if (v === 'crediario' && !isModuleEnabled(currentAccount, 'crediario')) {
                      toast({ variant: 'destructive', title: 'Crediário bloqueado', description: MODULE_BLOCKED_MESSAGE });
                      return;
                    }
                    setReceiveForm({ ...receiveForm, method: v });
                  }}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Dinheiro</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="card">Cartão</SelectItem>
                      <SelectItem value="crediario" disabled={!isModuleEnabled(currentAccount, 'crediario')}>
                        Crediário {!isModuleEnabled(currentAccount, 'crediario') ? '(bloqueado)' : ''}
                      </SelectItem>
                      <SelectItem value="financeira">Financeira</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Valor recebido *</Label>
                  <Input type="number" step="0.01" value={receiveForm.amount} onChange={e => setReceiveForm({ ...receiveForm, amount: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Observações</Label>
                <Textarea rows={2} value={receiveForm.notes} onChange={e => setReceiveForm({ ...receiveForm, notes: e.target.value })} placeholder="Opcional — aparece na conferência de caixa" />
              </div>
              <p className="text-[11px] text-muted-foreground">
                O recebimento será lançado no <strong>caixa do dia</strong> e no <strong>financeiro</strong> com a forma de pagamento escolhida.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveDialog(null)} disabled={receiving}>Cancelar</Button>
            <Button onClick={confirmReceive} disabled={receiving}>
              {receiving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar recebimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
