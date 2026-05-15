import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/utils/activityLog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, Search, AlertTriangle, Clock, CheckCircle, Users,
  DollarSign, CalendarDays, Phone, MessageSquare, Eye, ChevronDown, ChevronUp,
  Banknote, Smartphone, CreditCard, BookOpen, Building2,
} from 'lucide-react';
import { format, differenceInDays, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { isModuleEnabled, MODULE_BLOCKED_MESSAGE } from '@/utils/accountModules';

interface CustomerDebt {
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  customerDocument: string | null;
  creditLimit: number;
  totalOpen: number;
  totalOverdue: number;
  overdueCount: number;
  nextDueDate: string | null;
  installments: InstallmentRow[];
}

interface InstallmentRow {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  status: string;
  paid_at: string | null;
  installment_number: number | null;
  total_installments: number | null;
  sale_id: string | null;
  store_id: string | null;
  customer_id: string | null;
}

export default function Crediario() {
  const { user, currentAccount, currentStore, userRole, stores } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const canCollect = userRole === 'owner' || userRole === 'admin' || userRole === 'manager';

  const [loading, setLoading] = useState(true);
  const [receivables, setReceivables] = useState<InstallmentRow[]>([]);
  const [customers, setCustomers] = useState<Record<string, any>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('open');
  const [filterStore, setFilterStore] = useState(currentStore?.id || 'all');
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [confirmPayDialog, setConfirmPayDialog] = useState<InstallmentRow | null>(null);
  const [paying, setPaying] = useState(false);
  const [payMethod, setPayMethod] = useState<'cash' | 'pix' | 'card' | 'crediario' | 'financeira'>('cash');
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payNotes, setPayNotes] = useState('');

  const today = new Date().toISOString().split('T')[0];

  // Sync com a loja ativa global
  useEffect(() => { setFilterStore(currentStore?.id || 'all'); }, [currentStore?.id]);

  useEffect(() => {
    if (currentAccount) loadData();
  }, [currentAccount, filterStore]);

  const loadData = async () => {
    if (!currentAccount) return;
    setLoading(true);
    try {
      // Crediário: traz parcelas em aberto/pagas (com ou sem cliente vinculado)
      let query = supabase
        .from('accounts_receivable')
        .select('*')
        .eq('account_id', currentAccount.id)
        .in('status', ['open', 'paid'])
        .or('category.eq.crediário,sale_id.not.is.null')
        .order('due_date', { ascending: true });

      if (filterStore !== 'all') query = query.eq('store_id', filterStore);

      const { data: recData, error: recError } = await query;
      if (recError) throw recError;
      setReceivables(recData || []);

      // Carrega clientes vinculados
      const customerIds = [...new Set((recData || []).map(r => r.customer_id).filter(Boolean))];
      if (customerIds.length > 0) {
        const { data: custData } = await supabase
          .from('customers')
          .select('id, name, phone, document, credit_limit, credit_authorized')
          .in('id', customerIds);

        const custMap: Record<string, any> = {};
        (custData || []).forEach(c => { custMap[c.id] = c; });
        setCustomers(custMap);
      } else {
        setCustomers({});
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao carregar dados', description: e.message });
    } finally {
      setLoading(false);
    }
  };

  // Build customer debt summaries
  const customerDebts = useMemo(() => {
    const map = new Map<string, CustomerDebt>();

    receivables.forEach(r => {
      const key = r.customer_id || '__no_customer__';
      const cust = r.customer_id ? customers[r.customer_id] : null;
      const name = cust?.name || (r.customer_id ? 'Cliente removido' : 'Sem cliente identificado');

      if (!map.has(key)) {
        map.set(key, {
          customerId: key,
          customerName: name,
          customerPhone: cust?.phone || null,
          customerDocument: cust?.document || null,
          creditLimit: cust?.credit_limit || 0,
          totalOpen: 0,
          totalOverdue: 0,
          overdueCount: 0,
          nextDueDate: null,
          installments: [],
        });
      }

      const debt = map.get(key)!;
      debt.installments.push(r as InstallmentRow);

      if (r.status === 'open') {
        debt.totalOpen += r.amount;
        if (r.due_date < today) {
          debt.totalOverdue += r.amount;
          debt.overdueCount++;
        }
        if (!debt.nextDueDate || r.due_date < debt.nextDueDate) {
          debt.nextDueDate = r.due_date;
        }
      }
    });

    return Array.from(map.values());
  }, [receivables, customers, today]);

  // Filter and sort
  const filteredDebts = useMemo(() => {
    let result = customerDebts;

    // Filter by status
    if (filterStatus === 'overdue') {
      result = result.filter(d => d.totalOverdue > 0);
    } else if (filterStatus === 'open') {
      result = result.filter(d => d.totalOpen > 0);
    } else if (filterStatus === 'all') {
      // show all including paid-off
    }

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(d =>
        d.customerName.toLowerCase().includes(term) ||
        d.customerDocument?.toLowerCase().includes(term) ||
        d.customerPhone?.toLowerCase().includes(term)
      );
    }

    // Sort: overdue first, then by total overdue desc
    result.sort((a, b) => {
      if (a.totalOverdue > 0 && b.totalOverdue === 0) return -1;
      if (a.totalOverdue === 0 && b.totalOverdue > 0) return 1;
      return b.totalOverdue - a.totalOverdue || b.totalOpen - a.totalOpen;
    });

    return result;
  }, [customerDebts, filterStatus, searchTerm]);

  // Stats
  const stats = useMemo(() => {
    const allOpen = customerDebts.reduce((s, d) => s + d.totalOpen, 0);
    const allOverdue = customerDebts.reduce((s, d) => s + d.totalOverdue, 0);
    const overdueCustomers = customerDebts.filter(d => d.totalOverdue > 0).length;
    const upcomingWeek = receivables.filter(r => {
      if (r.status !== 'open') return false;
      const weekFromNow = format(addDays(new Date(), 7), 'yyyy-MM-dd');
      return r.due_date >= today && r.due_date <= weekFromNow;
    }).reduce((s, r) => s + r.amount, 0);

    return { allOpen, allOverdue, overdueCustomers, upcomingWeek };
  }, [customerDebts, receivables, today]);

  const openPayDialog = (inst: InstallmentRow) => {
    setConfirmPayDialog(inst);
    setPayMethod('cash');
    setPayAmount(Number(inst.amount));
    setPayNotes('');
  };

  const markPaid = async (installment: InstallmentRow) => {
    if (!payAmount || payAmount <= 0) {
      toast({ variant: 'destructive', title: 'Informe o valor recebido' });
      return;
    }
    setPaying(true);
    try {
      const { data, error } = await supabase.rpc('receive_crediario_installment', {
        _receivable_id: installment.id,
        _payment_method: payMethod,
        _amount: payAmount,
        _store_id: installment.store_id,
        _notes: payNotes || null,
      });
      if (error) throw error;

      const cust = customers[installment.customer_id!];
      await logActivity({
        accountId: currentAccount!.id,
        userId: user!.id,
        userName: user!.email,
        action: 'pay',
        entityType: 'crediario',
        entityId: installment.id,
        details: {
          amount: payAmount,
          method: payMethod,
          customer: cust?.name,
          description: installment.description,
          sale_finalized: (data as any)?.sale_finalized,
        },
      });
      const methodLabel = payMethod === 'cash' ? 'Dinheiro'
        : payMethod === 'pix' ? 'PIX'
        : payMethod === 'card' ? 'Cartão'
        : payMethod === 'crediario' ? 'Crediário'
        : 'Financeira';
      toast({
        title: 'Recebimento registrado!',
        description: (data as any)?.sale_finalized
          ? 'Última parcela paga — venda finalizada.'
          : 'Lançado no caixa como ' + methodLabel,
      });
      setConfirmPayDialog(null);
      loadData();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
      setPaying(false);
    }
  };

  const fc = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const getDaysOverdue = (dueDate: string) => {
    const diff = differenceInDays(new Date(), new Date(dueDate + 'T12:00:00'));
    return diff;
  };

  const getStatusBadge = (dueDate: string, status: string) => {
    if (status === 'paid') return <Badge className="bg-green-600 text-white text-xs">Pago</Badge>;
    if (status === 'cancelled') return <Badge variant="outline" className="text-xs">Cancelado</Badge>;
    const days = getDaysOverdue(dueDate);
    if (days > 30) return <Badge className="bg-red-700 text-white text-xs">Atrasado {days}d</Badge>;
    if (days > 0) return <Badge className="bg-red-500 text-white text-xs">Atrasado {days}d</Badge>;
    if (days >= -7) return <Badge className="bg-yellow-500 text-white text-xs">Vence em {Math.abs(days)}d</Badge>;
    return <Badge variant="secondary" className="text-xs">Em dia</Badge>;
  };

  const openWhatsApp = (phone: string, customerName: string, amount: number) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const fullPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
    const msg = encodeURIComponent(
      `Olá ${customerName}, tudo bem? 😊\n\nGostaríamos de lembrar sobre a parcela em aberto no valor de ${fc(amount)}.\n\nPor favor, entre em contato para regularizar. Obrigado!`
    );
    const url = `https://wa.me/${fullPhone}?text=${msg}`;
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const openWhatsAppForInstallment = (inst: InstallmentRow) => {
    const cust = customers[inst.customer_id!];
    if (!cust?.phone) {
      toast({ variant: 'destructive', title: 'Sem telefone', description: 'Cliente sem telefone cadastrado.' });
      return;
    }
    const days = getDaysOverdue(inst.due_date);
    const parcelaTxt = inst.total_installments && inst.total_installments > 1
      ? `parcela ${inst.installment_number}/${inst.total_installments}`
      : 'parcela';
    const msg = days > 0
      ? `Olá ${cust.name}, tudo bem? 😊\n\nLembrete: a ${parcelaTxt} do seu crediário no valor de ${fc(inst.amount)}, com vencimento em ${format(new Date(inst.due_date + 'T12:00:00'), 'dd/MM/yyyy')}, está em atraso há ${days} dia${days > 1 ? 's' : ''}.\n\nPodemos ajudar a regularizar? Obrigado!`
      : `Olá ${cust.name}, tudo bem? 😊\n\nLembrete: a ${parcelaTxt} do seu crediário no valor de ${fc(inst.amount)} vence em ${format(new Date(inst.due_date + 'T12:00:00'), 'dd/MM/yyyy')}.\n\nQualquer dúvida, estamos à disposição!`;
    const cleanPhone = cust.phone.replace(/\D/g, '');
    const fullPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
    const url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;
    const a = document.createElement('a');
    a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  if (!canCollect) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">Acesso restrito a donos, administradores e gerentes</p>
      </div>
    );
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Crediário</h1>
        <p className="text-sm text-muted-foreground">Gerencie parcelas em aberto, cobranças e vencimentos dos clientes</p>
      </div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2 p-3">
            <CardTitle className="text-xs flex items-center gap-1">
              <DollarSign className="h-3 w-3 text-muted-foreground" /> Total em Aberto
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold">{fc(stats.allOpen)}</div>
          </CardContent>
        </Card>
        <Card className={stats.allOverdue > 0 ? 'border-destructive/50' : ''}>
          <CardHeader className="pb-2 p-3">
            <CardTitle className="text-xs flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-destructive" /> Total Vencido
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold text-destructive">{fc(stats.allOverdue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 p-3">
            <CardTitle className="text-xs flex items-center gap-1">
              <Users className="h-3 w-3 text-muted-foreground" /> Clientes em Atraso
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold">{stats.overdueCustomers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 p-3">
            <CardTitle className="text-xs flex items-center gap-1">
              <CalendarDays className="h-3 w-3 text-muted-foreground" /> Vencendo (7 dias)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold text-yellow-600">{fc(stats.upcomingWeek)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CPF/CNPJ ou telefone..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="overdue">Vencidos</SelectItem>
            <SelectItem value="open">Em aberto</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
        {stores.length > 1 && (
          <Select value={filterStore} onValueChange={setFilterStore}>
            <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas lojas</SelectItem>
              {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Customer List */}
      {filteredDebts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500/50 mb-4" />
            <p className="text-muted-foreground">
              {filterStatus === 'overdue' ? 'Nenhum cliente com parcelas vencidas! 🎉' : 'Nenhum resultado encontrado.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredDebts.map(debt => {
            const isExpanded = expandedCustomer === debt.customerId;
            const openInstallments = debt.installments.filter(i => i.status === 'open').sort((a, b) => a.due_date.localeCompare(b.due_date));
            const paidInstallments = debt.installments.filter(i => i.status === 'paid');

            return (
              <Card key={debt.customerId} className={debt.totalOverdue > 0 ? 'border-destructive/30' : ''}>
                <CardContent className="p-4">
                  {/* Customer Summary */}
                  <div
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                    onClick={() => setExpandedCustomer(isExpanded ? null : debt.customerId)}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 shrink-0">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground truncate">{debt.customerName}</span>
                          {debt.totalOverdue > 0 && (
                            <Badge className="bg-red-500 text-white text-xs">
                              {debt.overdueCount} vencida{debt.overdueCount > 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                          {debt.customerDocument && <span>{debt.customerDocument}</span>}
                          {debt.customerPhone && <span>{debt.customerPhone}</span>}
                          <span>Limite: {fc(debt.creditLimit)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Em aberto</p>
                        <p className="font-bold text-foreground">{fc(debt.totalOpen)}</p>
                      </div>
                      {debt.totalOverdue > 0 && (
                        <div className="text-right">
                          <p className="text-xs text-destructive">Vencido</p>
                          <p className="font-bold text-destructive">{fc(debt.totalOverdue)}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        {debt.customerPhone && (
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8 text-green-600"
                            onClick={e => { e.stopPropagation(); openWhatsApp(debt.customerPhone!, debt.customerName, debt.totalOverdue || debt.totalOpen); }}
                            title="Enviar cobrança via WhatsApp"
                          >
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        )}
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded: Installments */}
                  {isExpanded && (
                    <div className="mt-4 space-y-2 border-t pt-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Parcelas em aberto ({openInstallments.length})</p>
                      {openInstallments.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">Nenhuma parcela em aberto</p>
                      ) : (
                        openInstallments.map(inst => (
                          <div key={inst.id} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border p-3 ${inst.due_date < today ? 'border-destructive/40 bg-destructive/5' : ''}`}>
                            <div className="space-y-0.5 min-w-0">
                              <p className="text-sm font-medium truncate">{inst.description}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                <span className="flex items-center gap-1">
                                  <CalendarDays className="h-3 w-3" />
                                  {format(new Date(inst.due_date + 'T12:00:00'), 'dd/MM/yyyy')}
                                </span>
                                {inst.total_installments && inst.total_installments > 1 && (
                                  <span>Parcela {inst.installment_number}/{inst.total_installments}</span>
                                )}
                                {getStatusBadge(inst.due_date, inst.status)}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-foreground whitespace-nowrap">{fc(inst.amount)}</span>
                              {inst.due_date < today && customers[inst.customer_id!]?.phone && (
                                <Button
                                  variant="ghost" size="icon" className="h-7 w-7 text-green-600"
                                  onClick={() => openWhatsAppForInstallment(inst)}
                                  title="Cobrar via WhatsApp"
                                >
                                  <MessageSquare className="h-3 w-3" />
                                </Button>
                              )}
                              {inst.sale_id && (
                                <Button variant="ghost" size="icon" className="h-7 w-7"
                                  onClick={() => navigate(`/app/sales/${inst.sale_id}`)}
                                  title="Ver venda"
                                >
                                  <Eye className="h-3 w-3" />
                                </Button>
                              )}
                              <Button size="sm" variant="outline" className="h-7 text-xs"
                                onClick={() => openPayDialog(inst)}
                              >
                                <CheckCircle className="mr-1 h-3 w-3" /> Receber
                              </Button>
                            </div>
                          </div>
                        ))
                      )}

                      {paidInstallments.length > 0 && (
                        <>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-4">Parcelas pagas ({paidInstallments.length})</p>
                          {paidInstallments.slice(0, 5).map(inst => (
                            <div key={inst.id} className="flex items-center justify-between rounded-lg border p-3 opacity-60">
                              <div className="space-y-0.5">
                                <p className="text-sm truncate">{inst.description}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>{format(new Date(inst.due_date + 'T12:00:00'), 'dd/MM/yyyy')}</span>
                                  {inst.paid_at && <span>• Pago em {format(new Date(inst.paid_at), 'dd/MM/yyyy')}</span>}
                                </div>
                              </div>
                              <span className="text-sm text-muted-foreground">{fc(inst.amount)}</span>
                            </div>
                          ))}
                          {paidInstallments.length > 5 && (
                            <p className="text-xs text-muted-foreground text-center">+{paidInstallments.length - 5} parcelas pagas</p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Receive Installment Dialog */}
      <Dialog open={!!confirmPayDialog} onOpenChange={() => !paying && setConfirmPayDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Receber Parcela</DialogTitle>
          </DialogHeader>
          {confirmPayDialog && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                <p className="text-sm font-medium">{confirmPayDialog.description}</p>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Vencimento: {format(new Date(confirmPayDialog.due_date + 'T12:00:00'), 'dd/MM/yyyy')}</span>
                  <span>Valor original: {fc(confirmPayDialog.amount)}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium">Forma de pagamento</label>
                <div className="grid grid-cols-5 gap-1.5 mt-1.5">
                  {([
                    ['cash', Banknote, 'Dinheiro'],
                    ['pix', Smartphone, 'PIX'],
                    ['card', CreditCard, 'Cartão'],
                    ['crediario', BookOpen, 'Crediário'],
                    ['financeira', Building2, 'Financ.'],
                  ] as const).map(([m, Icon, label]) => {
                    const isCredBlocked = m === 'crediario' && !isModuleEnabled(currentAccount, 'crediario');
                    return (
                      <Button
                        key={m}
                        type="button"
                        variant={payMethod === m ? 'default' : 'outline'}
                        size="sm"
                        disabled={isCredBlocked}
                        onClick={() => {
                          if (isCredBlocked) {
                            toast({ variant: 'destructive', title: 'Crediário bloqueado', description: MODULE_BLOCKED_MESSAGE });
                            return;
                          }
                          setPayMethod(m as any);
                        }}
                        className="h-auto py-2 px-1 flex flex-col gap-1"
                        title={isCredBlocked ? MODULE_BLOCKED_MESSAGE : ''}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="text-[10px]">{label}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium">Valor recebido</label>
                <Input
                  type="number"
                  step="0.01"
                  min={0.01}
                  value={payAmount}
                  onChange={e => setPayAmount(Number(e.target.value))}
                  className="mt-1.5"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Pode ser diferente do valor original (pagamento parcial gera diferença em outra parcela manualmente).
                </p>
              </div>

              <div>
                <label className="text-xs font-medium">Observação (opcional)</label>
                <Input
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                  placeholder="Ex: pagou em espécie no balcão"
                  className="mt-1.5"
                />
              </div>

              <div className="rounded-md bg-primary/5 border border-primary/20 p-2 text-[11px] text-muted-foreground">
                💡 O valor entra no caixa aberto desta loja como{' '}
                <strong>{payMethod === 'cash' ? 'Dinheiro' : payMethod === 'pix' ? 'PIX' : payMethod === 'card' ? 'Cartão' : payMethod === 'crediario' ? 'Crediário' : 'Financeira'}</strong>{' '}
                com a descrição "Recebimento Crediário - Parcela X - Cliente".
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmPayDialog(null)} disabled={paying}>Cancelar</Button>
            <Button onClick={() => confirmPayDialog && markPaid(confirmPayDialog)} disabled={paying || payAmount <= 0}>
              {paying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <CheckCircle className="mr-1 h-4 w-4" /> Confirmar Recebimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
