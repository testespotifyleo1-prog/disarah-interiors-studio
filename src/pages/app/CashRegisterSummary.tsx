import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/utils/activityLog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, DollarSign, Banknote, CreditCard, Smartphone, TrendingUp, Clock, Lock, Unlock, Receipt, ArrowUpDown, FileDown } from 'lucide-react';
import { generateDailyReportPDF } from '@/utils/generateDailyReport';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface RegisterSummary {
  totalSales: number;
  totalRevenue: number;
  totalCash: number;
  totalCard: number;
  totalPix: number;
  totalCrediario: number;
  totalFinanceira: number;
  avgTicket: number;
  salesByStatus: Record<string, number>;
  totalSangria: number;
  totalReforco: number;
}

export default function CashRegisterSummary() {
  const { user, currentStore, currentAccount } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [register, setRegister] = useState<any>(null);
  const [closedRegisters, setClosedRegisters] = useState<any[]>([]);
  const [summary, setSummary] = useState<RegisterSummary | null>(null);
  const [crediarioReceipts, setCrediarioReceipts] = useState<Array<{ id: string; method: string; paid_value: number; created_at: string; notes: string | null; sale_id: string; customer_name: string | null; order_number: number | null }>>([]);
  const [manualEntries, setManualEntries] = useState<Array<{ id: string; method: string; paid_value: number; created_at: string; notes: string | null; sale_notes: string | null; order_number: number | null }>>([]);
  const [showClose, setShowClose] = useState(false);
  const [showOpen, setShowOpen] = useState(false);
  const [closingAmount, setClosingAmount] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [openingAmount, setOpeningAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const fc = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  useEffect(() => {
    if (currentStore && currentAccount) loadData();
  }, [currentStore, currentAccount]);

  const loadData = async () => {
    if (!currentStore || !currentAccount) return;
    setLoading(true);

    // Get open register
    const { data: openReg } = await supabase
      .from('cash_registers')
      .select('*')
      .eq('store_id', currentStore.id)
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    setRegister(openReg);

    // Get recent closed registers
    const { data: closed } = await supabase
      .from('cash_registers')
      .select('*')
      .eq('store_id', currentStore.id)
      .eq('status', 'closed')
      .order('closed_at', { ascending: false })
      .limit(10);

    setClosedRegisters(closed || []);

    // Load summary for open register
    if (openReg) {
      await loadSummary(openReg);
    } else {
      setSummary(null);
    }

    setLoading(false);
  };

  const loadSummary = async (reg: any) => {
    if (!currentStore) return;

    const openedAt = reg.opened_at;

    // Vendas iniciadas durante o caixa (para contagem e para considerar entradas/parcelas)
    // Inclui status 'paid' e 'crediario' (vendas com entrada + parcelas).
    const { data: sales } = await supabase
      .from('sales')
      .select('id, total, status')
      .eq('store_id', currentStore.id)
      .in('status', ['paid', 'crediario'])
      .gte('created_at', openedAt);

    let totalCash = 0, totalCard = 0, totalPix = 0, totalCrediario = 0, totalFinanceira = 0;

    // Buscar TODOS os pagamentos criados no período do caixa (independente da data da venda),
    // para que recebimentos de parcelas de crediário de vendas antigas também apareçam aqui.
    // Filtramos por loja via JOIN implícito buscando primeiro IDs das vendas da loja envolvidas.
    const { data: storePayments } = await supabase
      .from('payments')
      .select('method, paid_value, sale_id, created_at, notes, sales!inner(store_id)')
      .eq('sales.store_id', currentStore.id)
      .gte('created_at', openedAt);

    for (const p of (storePayments || []) as any[]) {
      const v = Number(p.paid_value) || 0;
      switch (p.method) {
        case 'cash': totalCash += v; break;
        case 'card': totalCard += v; break;
        case 'pix': totalPix += v; break;
        case 'crediario': totalCrediario += v; break;
        case 'financeira': totalFinanceira += v; break;
      }
    }

    // Lista detalhada de RECEBIMENTOS DE CREDIÁRIO no caixa (baixas de parcelas).
    // A função receive_crediario_installment grava em payments.notes algo como
    // "Recebimento Crediário - Parcela X/Y". Filtramos por isso.
    const credReceipts = ((storePayments || []) as any[])
      .filter(p => typeof p.notes === 'string' && p.notes.startsWith('Recebimento Crediário'));

    if (credReceipts.length > 0) {
      const saleIds = Array.from(new Set(credReceipts.map(p => p.sale_id))).filter(Boolean);
      const { data: salesInfo } = await supabase
        .from('sales')
        .select('id, order_number, customer_id, customers(name)')
        .in('id', saleIds);
      const saleMap = new Map<string, any>();
      for (const s of (salesInfo || []) as any[]) saleMap.set(s.id, s);

      setCrediarioReceipts(credReceipts.map((p: any) => ({
        id: `${p.sale_id}-${p.created_at}-${p.paid_value}`,
        method: p.method,
        paid_value: Number(p.paid_value) || 0,
        created_at: p.created_at,
        notes: p.notes,
        sale_id: p.sale_id,
        customer_name: saleMap.get(p.sale_id)?.customers?.name || null,
        order_number: saleMap.get(p.sale_id)?.order_number ?? null,
      })));
    } else {
      setCrediarioReceipts([]);
    }

    // Recebimentos Manuais (entradas avulsas) lançadas neste caixa
    const { data: manualSales } = await supabase
      .from('sales')
      .select('id, order_number, notes, created_at')
      .eq('store_id', currentStore.id)
      .eq('source', 'manual_entry')
      .gte('created_at', openedAt);

    if (manualSales && manualSales.length > 0) {
      const ids = manualSales.map(s => s.id);
      const { data: manualPays } = await supabase
        .from('payments')
        .select('sale_id, method, paid_value, created_at, notes')
        .in('sale_id', ids);
      const saleMap = new Map<string, any>();
      for (const s of manualSales) saleMap.set(s.id, s);
      setManualEntries((manualPays || []).map((p: any) => ({
        id: `${p.sale_id}-${p.created_at}`,
        method: p.method,
        paid_value: Number(p.paid_value) || 0,
        created_at: p.created_at,
        notes: p.notes,
        sale_notes: saleMap.get(p.sale_id)?.notes || null,
        order_number: saleMap.get(p.sale_id)?.order_number ?? null,
      })));
    } else {
      setManualEntries([]);
    }

    // Get cash movements (sangria/reforço)
    const { data: movements } = await supabase
      .from('cash_movements' as any)
      .select('type, amount')
      .eq('cash_register_id', reg.id);

    let totalSangria = 0, totalReforco = 0;
    for (const m of (movements || []) as any[]) {
      if (m.type === 'sangria') totalSangria += Number(m.amount) || 0;
      if (m.type === 'reforco') totalReforco += Number(m.amount) || 0;
    }

    // Receita do caixa = soma efetivamente recebida (payments), não o total da venda.
    const totalRevenue = totalCash + totalCard + totalPix + totalCrediario + totalFinanceira;
    const totalSales = (sales || []).length;

    setSummary({
      totalSales,
      totalRevenue,
      totalCash,
      totalCard,
      totalPix,
      totalCrediario,
      totalFinanceira,
      avgTicket: totalSales > 0 ? totalRevenue / totalSales : 0,
      salesByStatus: {},
      totalSangria,
      totalReforco,
    });
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
      setRegister(data);
      setSummary({ totalSales: 0, totalRevenue: 0, totalCash: 0, totalCard: 0, totalPix: 0, totalCrediario: 0, totalFinanceira: 0, avgTicket: 0, salesByStatus: {}, totalSangria: 0, totalReforco: 0 });
      setShowOpen(false);
      setOpeningAmount('');
      await logActivity({ accountId: currentAccount!.id, userId: user!.id, userName: user!.email, action: 'create', entityType: 'cash_register', details: { acao: 'abertura', valor_abertura: Number(openingAmount) || 0 } });
      toast({ title: 'Caixa aberto com sucesso!' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally { setSaving(false); }
  };

  const closeCashRegister = async () => {
    if (!register || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('cash_registers').update({
        status: 'closed',
        closed_by: user.id,
        closed_at: new Date().toISOString(),
        closing_amount: Number(closingAmount) || 0,
        total_sales: summary?.totalRevenue || 0,
        total_cash: summary?.totalCash || 0,
        total_card: summary?.totalCard || 0,
        total_pix: summary?.totalPix || 0,
        notes: closingNotes || null,
      }).eq('id', register.id);
      if (error) throw error;
      await logActivity({ accountId: currentAccount!.id, userId: user!.id, userName: user!.email, action: 'update', entityType: 'cash_register', details: { acao: 'fechamento', total_vendas: summary?.totalRevenue || 0, valor_fechamento: Number(closingAmount) || 0 } });
      toast({ title: 'Caixa fechado com sucesso!' });
      setShowClose(false);
      setClosingAmount('');
      setClosingNotes('');
      await loadData();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally { setSaving(false); }
  };

  const formatDate = (d: string) => new Date(d).toLocaleString('pt-BR');

  const handleDownloadReport = async () => {
    if (!register || !summary || !currentStore) return;
    setGeneratingPdf(true);
    try {
      await generateDailyReportPDF({
        storeName: currentStore.name || 'Loja',
        storeId: currentStore.id,
        accountId: currentAccount!.id,
        register,
        summary,
        expectedCash,
        closingAmount: register.status === 'closed' ? Number(register.closing_amount) : undefined,
      });
      toast({ title: 'Relatório gerado com sucesso!' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao gerar relatório', description: e.message });
    } finally {
      setGeneratingPdf(false);
    }
  };

  const expectedCash = register ? (Number(register.opening_amount) || 0) + (summary?.totalCash || 0) + (summary?.totalReforco || 0) - (summary?.totalSangria || 0) : 0;
  const difference = Number(closingAmount || 0) - expectedCash;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Caixa</h1>
        <p className="text-sm text-muted-foreground">Abertura, fechamento e resumo do caixa</p>
      </div>

      {/* Status do caixa */}
      {register ? (
        <>
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-green-500/20 p-2">
                    <Unlock className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-green-700">Caixa Aberto</p>
                    <p className="text-xs text-muted-foreground">Aberto em {formatDate(register.opened_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Troco inicial</p>
                    <p className="text-lg font-bold text-foreground">{fc(register.opening_amount || 0)}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => loadData()}>
                    <ArrowUpDown className="mr-1 h-4 w-4" /> Atualizar
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownloadReport} disabled={generatingPdf}>
                    {generatingPdf ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileDown className="mr-1 h-4 w-4" />}
                    Relatório PDF
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setShowClose(true)}>
                    <Lock className="mr-1 h-4 w-4" /> Fechar Caixa
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          {summary && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="p-4 text-center">
                    <Receipt className="mx-auto h-5 w-5 text-primary mb-1" />
                    <p className="text-2xl font-bold text-foreground">{summary.totalSales}</p>
                    <p className="text-xs text-muted-foreground">Vendas Realizadas</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <TrendingUp className="mx-auto h-5 w-5 text-green-600 mb-1" />
                    <p className="text-xl font-bold text-green-600">{fc(summary.totalRevenue)}</p>
                    <p className="text-xs text-muted-foreground">Faturamento Total</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <DollarSign className="mx-auto h-5 w-5 text-blue-600 mb-1" />
                    <p className="text-xl font-bold text-foreground">{fc(summary.avgTicket)}</p>
                    <p className="text-xs text-muted-foreground">Ticket Médio</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <Banknote className="mx-auto h-5 w-5 text-amber-600 mb-1" />
                    <p className="text-xl font-bold text-amber-600">{fc(expectedCash)}</p>
                    <p className="text-xs text-muted-foreground">Dinheiro Esperado</p>
                  </CardContent>
                </Card>
              </div>

              {/* Payment Breakdown */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Resumo por Forma de Pagamento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { icon: Banknote, label: 'Dinheiro', value: summary.totalCash, color: 'text-green-600', bg: 'bg-green-500/10' },
                    { icon: CreditCard, label: 'Cartão', value: summary.totalCard, color: 'text-blue-600', bg: 'bg-blue-500/10' },
                    { icon: Smartphone, label: 'Pix', value: summary.totalPix, color: 'text-purple-600', bg: 'bg-purple-500/10' },
                    { icon: Receipt, label: 'Crediário', value: summary.totalCrediario, color: 'text-orange-600', bg: 'bg-orange-500/10' },
                    { icon: DollarSign, label: 'Financeira', value: summary.totalFinanceira, color: 'text-red-600', bg: 'bg-red-500/10' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <div className={`rounded-full p-2 ${item.bg}`}>
                          <item.icon className={`h-4 w-4 ${item.color}`} />
                        </div>
                        <span className="font-medium text-sm">{item.label}</span>
                      </div>
                      <span className={`font-bold text-lg ${item.color}`}>{fc(item.value)}</span>
                    </div>
                  ))}

                  <div className="border-t pt-3 mt-3 space-y-2">
                    <div className="flex items-center justify-between rounded-lg bg-muted p-3">
                      <span className="font-semibold">Troco Inicial (Abertura)</span>
                      <span className="font-bold text-lg">{fc(register.opening_amount || 0)}</span>
                    </div>
                    {(summary.totalReforco > 0 || summary.totalSangria > 0) && (
                      <>
                        {summary.totalReforco > 0 && (
                          <div className="flex items-center justify-between rounded-lg border border-green-300 bg-green-50 dark:bg-green-950/30 p-3">
                            <span className="font-medium text-sm text-green-700 dark:text-green-400">+ Reforço</span>
                            <span className="font-bold text-green-600">+{fc(summary.totalReforco)}</span>
                          </div>
                        )}
                        {summary.totalSangria > 0 && (
                          <div className="flex items-center justify-between rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/30 p-3">
                            <span className="font-medium text-sm text-red-700 dark:text-red-400">- Sangria</span>
                            <span className="font-bold text-red-600">-{fc(summary.totalSangria)}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-primary/10 p-3">
                    <span className="font-semibold text-primary">Dinheiro Esperado no Caixa</span>
                    <span className="font-bold text-xl text-primary">{fc(expectedCash)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Recebimentos de Crediário (baixas de parcelas) feitos neste caixa */}
              {crediarioReceipts.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Receipt className="h-4 w-4 text-orange-600" />
                      Recebimentos de Crediário neste caixa ({crediarioReceipts.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {crediarioReceipts
                        .slice()
                        .sort((a, b) => b.created_at.localeCompare(a.created_at))
                        .map((r) => {
                          const methodLabel = r.method === 'cash' ? 'Dinheiro' : r.method === 'pix' ? 'Pix' : r.method === 'card' ? 'Cartão' : r.method;
                          const time = new Date(r.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                          return (
                            <div key={r.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {r.customer_name || 'Cliente'}
                                  {r.order_number ? ` · Venda #${r.order_number}` : ''}
                                </span>
                                <span className="text-xs text-muted-foreground">{r.notes}</span>
                                <span className="text-[11px] text-muted-foreground">Recebido às {time} · {methodLabel}</span>
                              </div>
                              <span className="font-bold text-green-600">{fc(r.paid_value)}</span>
                            </div>
                          );
                        })}
                    </div>
                  </CardContent>
                </Card>
              )}
              {/* Recebimentos Manuais (entradas avulsas) lançados via Financeiro */}
              {manualEntries.length > 0 && (
                <Card className="border-blue-500/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-blue-600" />
                      Recebimentos Manuais neste caixa ({manualEntries.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {manualEntries
                        .slice()
                        .sort((a, b) => b.created_at.localeCompare(a.created_at))
                        .map((r) => {
                          const methodLabel = r.method === 'cash' ? 'Dinheiro' : r.method === 'pix' ? 'Pix' : r.method === 'card' ? 'Cartão' : r.method === 'crediario' ? 'Crediário' : r.method === 'financeira' ? 'Financeira' : r.method === 'store_credit' ? 'Crédito de loja' : r.method;
                          const time = new Date(r.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                          const desc = r.notes || r.sale_notes || 'Entrada manual';
                          return (
                            <div key={r.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                              <div className="flex flex-col">
                                <span className="font-medium">{desc}</span>
                                <span className="text-[11px] text-muted-foreground">Lançado às {time} · {methodLabel}{r.order_number ? ` · #${r.order_number}` : ''}</span>
                              </div>
                              <span className="font-bold text-blue-600">{fc(r.paid_value)}</span>
                            </div>
                          );
                        })}
                      <div className="flex items-center justify-between rounded-lg bg-blue-500/10 p-3 mt-2">
                        <span className="font-semibold text-blue-700">Total de Entradas Manuais</span>
                        <span className="font-bold text-lg text-blue-700">{fc(manualEntries.reduce((s, m) => s + m.paid_value, 0))}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </>
      ) : (
        <Card className="border-muted">
          <CardContent className="p-8 text-center">
            <Lock className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Caixa Fechado</h3>
            <p className="text-sm text-muted-foreground mb-4">Abra o caixa para iniciar as vendas</p>
            <Button onClick={() => setShowOpen(true)}>
              <Unlock className="mr-2 h-4 w-4" /> Abrir Caixa
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Histórico de caixas fechados */}
      {closedRegisters.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Histórico de Caixas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {closedRegisters.map(reg => {
                const diff = (Number(reg.closing_amount) || 0) - ((Number(reg.opening_amount) || 0) + (Number(reg.total_cash) || 0));
                return (
                  <div key={reg.id} className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border p-3 gap-2">
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium">
                          {new Date(reg.opened_at).toLocaleDateString('pt-BR')} — {new Date(reg.opened_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} a {reg.closed_at ? new Date(reg.closed_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Abertura: {fc(reg.opening_amount || 0)} | Fechamento: {fc(reg.closing_amount || 0)}
                          {reg.notes && ` | ${reg.notes}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Vendas</p>
                        <p className="text-sm font-bold">{fc(reg.total_sales || 0)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Din.</p>
                        <p className="text-sm font-medium">{fc(reg.total_cash || 0)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Cartão</p>
                        <p className="text-sm font-medium">{fc(reg.total_card || 0)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Pix</p>
                        <p className="text-sm font-medium">{fc(reg.total_pix || 0)}</p>
                      </div>
                      <Badge variant={diff >= 0 ? 'default' : 'destructive'} className="text-xs">
                        {diff >= 0 ? '+' : ''}{fc(diff)}
                      </Badge>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Baixar Relatório"
                        onClick={async () => {
                          try {
                            await generateDailyReportPDF({
                              storeName: currentStore?.name || 'Loja',
                              storeId: currentStore!.id,
                              accountId: currentAccount!.id,
                              register: reg,
                              summary: {
                                totalSales: 0, totalRevenue: Number(reg.total_sales) || 0,
                                totalCash: Number(reg.total_cash) || 0, totalCard: Number(reg.total_card) || 0,
                                totalPix: Number(reg.total_pix) || 0, totalCrediario: 0, totalFinanceira: 0,
                                avgTicket: 0, totalSangria: 0, totalReforco: 0,
                              },
                              expectedCash: (Number(reg.opening_amount) || 0) + (Number(reg.total_cash) || 0),
                              closingAmount: Number(reg.closing_amount) || 0,
                            });
                          } catch {}
                        }}>
                        <FileDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Open Register Dialog */}
      <Dialog open={showOpen} onOpenChange={setShowOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Abrir Caixa</DialogTitle>
            <DialogDescription>Informe o valor de troco inicial</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Valor de abertura / troco (R$)</Label>
              <Input type="number" value={openingAmount} onChange={e => setOpeningAmount(e.target.value)} placeholder="0,00" className="text-lg" autoFocus />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOpen(false)}>Cancelar</Button>
            <Button onClick={openCashRegister} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Unlock className="mr-1 h-4 w-4" /> Abrir Caixa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Register Dialog */}
      <Dialog open={showClose} onOpenChange={setShowClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Fechar Caixa</DialogTitle>
            <DialogDescription>Confira os valores e informe o valor contado em caixa</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Summary in close dialog */}
            <div className="rounded-lg bg-muted p-3 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Troco Inicial:</span><span className="font-medium">{fc(register?.opening_amount || 0)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Vendas em Dinheiro:</span><span className="font-medium">{fc(summary?.totalCash || 0)}</span></div>
              <div className="flex justify-between border-t pt-2"><span className="font-semibold">Dinheiro Esperado:</span><span className="font-bold text-primary">{fc(expectedCash)}</span></div>
            </div>

            <div className="space-y-1">
              <Label>Valor contado em caixa (R$)</Label>
              <Input type="number" value={closingAmount} onChange={e => setClosingAmount(e.target.value)} placeholder="0,00" className="text-lg" autoFocus />
            </div>

            {closingAmount && (
              <div className={`rounded-lg p-3 text-center ${difference >= 0 ? 'bg-green-500/10' : 'bg-destructive/10'}`}>
                <p className="text-xs text-muted-foreground">Diferença</p>
                <p className={`text-xl font-bold ${difference >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                  {difference >= 0 ? '+' : ''}{fc(difference)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {difference === 0 ? 'Caixa conferido ✓' : difference > 0 ? 'Sobra no caixa' : 'Falta no caixa'}
                </p>
              </div>
            )}

            <div className="space-y-1">
              <Label>Observações</Label>
              <Textarea value={closingNotes} onChange={e => setClosingNotes(e.target.value)} rows={2} placeholder="Anotações sobre o fechamento..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClose(false)}>Cancelar</Button>
            <Button onClick={closeCashRegister} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Lock className="mr-1 h-4 w-4" /> Fechar Caixa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
