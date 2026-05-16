import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, DollarSign, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MonthFilter, getMonthRange } from '@/components/MonthFilter';
import type { Commission, Sale } from '@/types/database';

interface CommissionWithSale extends Commission {
  sales?: Sale;
}

interface CommissionStats {
  totalPending: number;
  totalPaid: number;
  countPending: number;
  countPaid: number;
}

export default function MyCommissions() {
  const { user, currentAccount } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<CommissionStats>({
    totalPending: 0,
    totalPaid: 0,
    countPending: 0,
    countPaid: 0,
  });
  const [commissions, setCommissions] = useState<CommissionWithSale[]>([]);
  const [activeTab, setActiveTab] = useState('all');
  const [month, setMonth] = useState(new Date());

  useEffect(() => {
    if (user) {
      loadCommissions();
    }
  }, [user, month]);

  const loadCommissions = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { startISO, endISO } = getMonthRange(month);
      const { data, error } = await supabase
        .from('commissions')
        .select('*, sales(id, total, created_at)')
        .eq('seller_id', user.id)
        .gte('created_at', startISO)
        .lte('created_at', endISO)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const commissionsData = data || [];
      setCommissions(commissionsData as unknown as CommissionWithSale[]);

      const pending = commissionsData.filter(c => c.status === 'pending');
      const paid = commissionsData.filter(c => c.status === 'paid');

      setStats({
        totalPending: pending.reduce((sum, c) => sum + (c.value || 0), 0),
        totalPaid: paid.reduce((sum, c) => sum + (c.value || 0), 0),
        countPending: pending.length,
        countPaid: paid.length,
      });
    } catch (error: any) {
      console.error('Error loading commissions:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar comissões',
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const filteredCommissions = activeTab === 'all'
    ? commissions
    : commissions.filter(c => c.status === activeTab);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Minhas Comissões</h1>
          <p className="text-muted-foreground">Acompanhe suas comissões de vendas</p>
        </div>
        <MonthFilter currentMonth={month} onChange={setMonth} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Pendente</CardTitle>
            <Clock className="h-4 w-4 text-status-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-status-warning">
              {formatCurrency(stats.totalPending)}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.countPending} comissões
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Recebido</CardTitle>
            <CheckCircle className="h-4 w-4 text-status-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-status-success">
              {formatCurrency(stats.totalPaid)}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.countPaid} comissões
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Geral</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats.totalPending + stats.totalPaid)}
            </div>
            <p className="text-xs text-muted-foreground">
              {commissions.length} comissões
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Média por Venda</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(
                commissions.length > 0
                  ? (stats.totalPending + stats.totalPaid) / commissions.length
                  : 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">média</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="pending">Pendentes ({stats.countPending})</TabsTrigger>
          <TabsTrigger value="paid">Pagas ({stats.countPaid})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Venda</TableHead>
                    <TableHead>Valor da Venda</TableHead>
                    <TableHead>%</TableHead>
                    <TableHead>Comissão</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCommissions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Nenhuma comissão encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCommissions.map((commission) => (
                      <TableRow key={commission.id}>
                        <TableCell>
                          {format(new Date(commission.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {commission.sale_id.slice(0, 8)}...
                        </TableCell>
                        <TableCell>
                          {commission.sales
                            ? formatCurrency(commission.sales.total)
                            : '-'}
                        </TableCell>
                        <TableCell>{commission.percent}%</TableCell>
                        <TableCell className="font-semibold">
                          {formatCurrency(commission.value)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={commission.status === 'paid' ? 'default' : 'secondary'}
                            className={
                              commission.status === 'paid'
                                ? 'bg-status-success'
                                : 'bg-status-warning'
                            }
                          >
                            {commission.status === 'paid' ? 'Paga' : 'Pendente'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
