import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Search, Activity, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ActivityLog {
  id: string;
  user_id: string;
  user_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, any> | null;
  created_at: string;
}

const actionColors: Record<string, string> = {
  create: 'bg-green-600',
  update: 'bg-blue-600',
  delete: 'bg-red-600',
  cancel: 'bg-red-500',
  confirm: 'bg-emerald-600',
  pay: 'bg-green-500',
  reverse: 'bg-orange-500',
  login: 'bg-slate-500',
};

const actionLabels: Record<string, string> = {
  create: 'Criou',
  update: 'Atualizou',
  delete: 'Excluiu',
  cancel: 'Cancelou',
  confirm: 'Confirmou',
  pay: 'Pagou',
  reverse: 'Estornou',
  finalize: 'Finalizou',
  login: 'Login',
};

const entityLabels: Record<string, string> = {
  sale: 'Venda',
  product: 'Produto',
  customer: 'Cliente',
  supplier: 'Fornecedor',
  payment: 'Pagamento',
  fiscal_entry: 'Entrada Fiscal',
  delivery: 'Entrega',
  assembly: 'Montagem',
  commission: 'Comissão',
  accounts_receivable: 'Conta a Receber',
  accounts_payable: 'Conta a Pagar',
  return_note: 'Devolução',
  store: 'Loja',
  seller: 'Vendedor',
  driver: 'Entregador',
  assembler: 'Montador',
  inventory: 'Estoque',
  crediario: 'Crediário',
  cash_register: 'Caixa',
  session: 'Sessão',
};

const PAGE_SIZE = 50;

export default function ActivityLogs() {
  const { currentAccount, isOwnerOrAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEntity, setFilterEntity] = useState('all');
  const [filterAction, setFilterAction] = useState('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    if (currentAccount) loadLogs();
  }, [currentAccount, filterEntity, filterAction, page]);

  const loadLogs = async () => {
    if (!currentAccount) return;
    setLoading(true);
    try {
      let query = supabase
        .from('activity_logs' as any)
        .select('*')
        .eq('account_id', currentAccount.id)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (filterEntity !== 'all') query = query.eq('entity_type', filterEntity);
      if (filterAction !== 'all') query = query.eq('action', filterAction);

      const { data, error } = await query;
      if (error) throw error;
      setLogs((data || []) as unknown as ActivityLog[]);
      setHasMore((data || []).length === PAGE_SIZE);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = searchTerm
    ? logs.filter(l =>
        l.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.entity_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        JSON.stringify(l.details || {}).toLowerCase().includes(searchTerm.toLowerCase())
      )
    : logs;

  if (!isOwnerOrAdmin) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">Acesso restrito a administradores</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Log de Atividades</h1>
        <p className="text-sm text-muted-foreground">Histórico de ações realizadas no sistema</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por usuário, ação..."
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); }}
            className="pl-9"
          />
        </div>
        <Select value={filterEntity} onValueChange={v => { setFilterEntity(v); setPage(0); }}>
          <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas entidades</SelectItem>
            {Object.entries(entityLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterAction} onValueChange={v => { setFilterAction(v); setPage(0); }}>
          <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas ações</SelectItem>
            {Object.entries(actionLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredLogs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Activity className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Nenhum registro encontrado</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-2">
            {filteredLogs.map(log => (
              <Card key={log.id}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 shrink-0 mt-0.5">
                        <Activity className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-foreground">
                            {log.user_name || 'Usuário'}
                          </span>
                          <Badge className={`${actionColors[log.action] || 'bg-slate-500'} text-white text-xs`}>
                            {actionLabels[log.action] || log.action}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {entityLabels[log.entity_type] || log.entity_type}
                          </Badge>
                        </div>
                        {log.details && (
                          <p className="text-xs text-muted-foreground mt-1 truncate max-w-md">
                            {Object.entries(log.details)
                              .filter(([_, v]) => v !== null && v !== undefined)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(' • ')}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
            </Button>
            <span className="text-sm text-muted-foreground">Página {page + 1}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasMore}
              onClick={() => setPage(p => p + 1)}
            >
              Próxima <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
