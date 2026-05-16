import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/utils/activityLog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Wrench, Clock, CheckCircle, XCircle, CalendarDays, Edit2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type AssemblyStatus = 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

interface Assembly {
  id: string;
  sale_id: string;
  account_id: string;
  store_id: string;
  assembler_id: string | null;
  status: AssemblyStatus;
  scheduled_date: string | null;
  scheduled_time: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  assemblers?: { name: string; phone?: string | null } | null;
}

interface Assembler {
  id: string;
  name: string;
  phone?: string | null;
}

const STATUS_LABELS: Record<AssemblyStatus, string> = {
  pending: 'Pendente',
  scheduled: 'Agendada',
  in_progress: 'Em Andamento',
  completed: 'Concluída',
  cancelled: 'Cancelada',
};

const STATUS_ICONS: Record<AssemblyStatus, React.ReactNode> = {
  pending: <Clock className="h-4 w-4" />,
  scheduled: <CalendarDays className="h-4 w-4" />,
  in_progress: <Wrench className="h-4 w-4" />,
  completed: <CheckCircle className="h-4 w-4" />,
  cancelled: <XCircle className="h-4 w-4" />,
};

const STATUS_COLORS: Record<AssemblyStatus, string> = {
  pending: 'bg-yellow-500',
  scheduled: 'bg-blue-500',
  in_progress: 'bg-purple-500',
  completed: 'bg-green-500',
  cancelled: 'bg-red-500',
};

export default function Assemblies() {
  const { user, currentAccount, currentStore, canManage } = useAuth();
  const { toast } = useToast();

  const [assemblies, setAssemblies] = useState<Assembly[]>([]);
  const [assemblers, setAssemblers] = useState<Assembler[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<AssemblyStatus | 'all'>('all');

  const [selectedAssembly, setSelectedAssembly] = useState<Assembly | null>(null);
  const [selectedAssembler, setSelectedAssembler] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<AssemblyStatus>('pending');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (currentAccount) loadData();
  }, [currentAccount, currentStore]);

  const loadData = async () => {
    if (!currentAccount) return;
    setLoading(true);
    try {
      let asmQuery = supabase
        .from('assemblies')
        .select('*, assemblers(name, phone)')
        .eq('account_id', currentAccount.id)
        .order('created_at', { ascending: false });
      if (currentStore) asmQuery = asmQuery.eq('store_id', currentStore.id);
      const { data: asmData, error: asmError } = await asmQuery;
      if (asmError) throw asmError;

      const { data: assemblersData } = await supabase
        .from('assemblers')
        .select('id, name, phone')
        .eq('account_id', currentAccount.id)
        .eq('is_active', true)
        .order('name');

      setAssemblies((asmData || []) as any);
      setAssemblers(assemblersData || []);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const openDialog = (assembly: Assembly) => {
    setSelectedAssembly(assembly);
    setSelectedAssembler(assembly.assembler_id || '');
    setSelectedStatus(assembly.status);
    setScheduledDate(assembly.scheduled_date || '');
    setScheduledTime(assembly.scheduled_time || '');
    setNotes(assembly.notes || '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedAssembly) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('assemblies')
        .update({
          assembler_id: selectedAssembler || null,
          status: selectedStatus,
          scheduled_date: scheduledDate || null,
          scheduled_time: scheduledTime || null,
          notes: notes || null,
        })
        .eq('id', selectedAssembly.id);
      if (error) throw error;
      await logActivity({ accountId: currentAccount!.id, userId: user!.id, userName: user!.email, action: 'update', entityType: 'assembly', entityId: selectedAssembly.id, details: { status: selectedStatus } });
      toast({ title: 'Montagem atualizada' });
      setDialogOpen(false);
      loadData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const filteredAssemblies = statusFilter === 'all' ? assemblies : assemblies.filter(a => a.status === statusFilter);

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Montagens</h1>
        <p className="text-muted-foreground">Acompanhe as montagens agendadas</p>
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {(['all', 'pending', 'scheduled', 'in_progress', 'completed'] as const).map(status => (
          <Card key={status} className="cursor-pointer" onClick={() => setStatusFilter(status)}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">
                {status === 'all' ? 'Todas' : STATUS_LABELS[status]}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {status === 'all' ? assemblies.length : assemblies.filter(a => a.status === status).length}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Cards layout (responsive) */}
      <div className="space-y-3">
        {filteredAssemblies.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma montagem encontrada</CardContent></Card>
        ) : filteredAssemblies.map(assembly => (
          <Card key={assembly.id}>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={`${STATUS_COLORS[assembly.status]} text-white`}>
                      {STATUS_ICONS[assembly.status]}
                      <span className="ml-1">{STATUS_LABELS[assembly.status]}</span>
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono">
                      Venda: {assembly.sale_id.slice(0, 8)}...
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <span>
                      <strong>Montador:</strong> {assembly.assemblers?.name || 'Não atribuído'}
                    </span>
                    {assembly.scheduled_date && (
                      <span>
                        <strong>Data:</strong> {format(new Date(assembly.scheduled_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                        {assembly.scheduled_time && ` às ${assembly.scheduled_time}`}
                      </span>
                    )}
                  </div>
                  {assembly.notes && <p className="text-xs text-muted-foreground truncate">{assembly.notes}</p>}
                </div>
                {canManage && (
                  <Button variant="ghost" size="icon" onClick={() => openDialog(assembly)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Gerenciar Montagem</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Montador</Label>
              <Select value={selectedAssembler || '__none__'} onValueChange={v => setSelectedAssembler(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {assemblers.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={selectedStatus} onValueChange={v => setSelectedStatus(v as AssemblyStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_LABELS) as AssemblyStatus[]).map(s => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Horário</Label>
                <Input type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observações..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
