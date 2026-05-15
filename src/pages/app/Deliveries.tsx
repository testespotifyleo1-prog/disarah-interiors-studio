import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/utils/activityLog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Truck, Package, Clock, CheckCircle, XCircle, Edit2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Delivery, Driver, DeliveryStatus } from '@/types/database';

const STATUS_LABELS: Record<DeliveryStatus, string> = {
  pending: 'Pendente',
  assigned: 'Atribuída',
  out_for_delivery: 'Em Rota',
  delivered: 'Entregue',
  cancelled: 'Cancelada',
};

const STATUS_COLORS: Record<DeliveryStatus, string> = {
  pending: 'bg-yellow-500',
  assigned: 'bg-blue-500',
  out_for_delivery: 'bg-purple-500',
  delivered: 'bg-green-500',
  cancelled: 'bg-red-500',
};

export default function Deliveries() {
  const { user, currentAccount, currentStore, canManage } = useAuth();
  const { toast } = useToast();

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | 'all'>('all');
  
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<DeliveryStatus>('pending');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (currentAccount) {
      loadData();
    }
  }, [currentAccount, currentStore]);

  const loadData = async () => {
    if (!currentAccount) return;
    setLoading(true);

    try {
      // Load deliveries
      let deliveriesQuery = supabase
        .from('deliveries')
        .select('*, drivers(name, phone), sales(sale_number, total, remaining_balance, payment_on_delivery, down_payment)')
        .eq('account_id', currentAccount.id)
        .order('created_at', { ascending: false });

      if (currentStore) {
        deliveriesQuery = deliveriesQuery.eq('store_id', currentStore.id);
      }

      const { data: deliveriesData, error: deliveriesError } = await deliveriesQuery;
      if (deliveriesError) throw deliveriesError;

      // Load drivers
      let driversQuery = supabase
        .from('drivers')
        .select('*')
        .eq('account_id', currentAccount.id)
        .eq('is_active', true)
        .order('name');

      if (currentStore) {
        driversQuery = driversQuery.or(`store_id.eq.${currentStore.id},store_id.is.null`);
      }

      const { data: driversData, error: driversError } = await driversQuery;
      if (driversError) throw driversError;

      setDeliveries(deliveriesData || []);
      setDrivers(driversData || []);
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const openDialog = (delivery: Delivery) => {
    setSelectedDelivery(delivery);
    setSelectedDriver(delivery.driver_id || '');
    setSelectedStatus(delivery.status);
    setNotes(delivery.notes || '');
    setScheduledDate((delivery as any).scheduled_date || '');
    setScheduledTime((delivery as any).scheduled_time || '');
    setDialogOpen(true);
  };

  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  const handleSave = async () => {
    if (!selectedDelivery) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('deliveries')
        .update({
          driver_id: selectedDriver || null,
          status: selectedStatus,
          notes: notes || null,
          scheduled_date: scheduledDate || null,
          scheduled_time: scheduledTime || null,
        })
        .eq('id', selectedDelivery.id);

      if (error) throw error;

      await logActivity({ accountId: currentAccount!.id, userId: user!.id, userName: user!.email, action: 'update', entityType: 'delivery', entityId: selectedDelivery.id, details: { status: selectedStatus } });
      toast({ title: 'Entrega atualizada' });
      setDialogOpen(false);
      loadData();
    } catch (error: any) {
      console.error('Error updating delivery:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar',
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredDeliveries = statusFilter === 'all'
    ? deliveries
    : deliveries.filter(d => d.status === statusFilter);

  const getStatusIcon = (status: DeliveryStatus) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'assigned':
        return <Package className="h-4 w-4" />;
      case 'out_for_delivery':
        return <Truck className="h-4 w-4" />;
      case 'delivered':
        return <CheckCircle className="h-4 w-4" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Entregas</h1>
          <p className="text-muted-foreground">Gerencie as entregas das vendas</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Card className="cursor-pointer" onClick={() => setStatusFilter('all')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deliveries.length}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer" onClick={() => setStatusFilter('pending')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {deliveries.filter(d => d.status === 'pending').length}
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer" onClick={() => setStatusFilter('out_for_delivery')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Em Rota</CardTitle>
            <Truck className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {deliveries.filter(d => d.status === 'out_for_delivery').length}
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer" onClick={() => setStatusFilter('delivered')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Entregues</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {deliveries.filter(d => d.status === 'delivered').length}
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer" onClick={() => setStatusFilter('cancelled')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Canceladas</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {deliveries.filter(d => d.status === 'cancelled').length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Venda</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Agendamento</TableHead>
                <TableHead>Entregador</TableHead>
                <TableHead>A Receber</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead className="w-[80px]">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDeliveries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canManage ? 8 : 7} className="text-center text-muted-foreground py-8">
                    Nenhuma entrega encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredDeliveries.map((delivery) => {
                  const saleInfo = (delivery as any).sales as { sale_number?: number; total?: number; remaining_balance?: number; payment_on_delivery?: boolean; down_payment?: number } | null;
                  const remaining = Number(saleInfo?.remaining_balance || 0);
                  const isPaymentOnDelivery = !!saleInfo?.payment_on_delivery && remaining > 0;
                  return (
                    <TableRow key={delivery.id} className={isPaymentOnDelivery ? 'bg-status-warning/5' : ''}>
                      <TableCell>
                        {format(new Date(delivery.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {saleInfo?.sale_number ? `#${saleInfo.sale_number}` : `${delivery.sale_id.slice(0, 8)}...`}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {delivery.delivery_type === 'delivery' ? 'Entrega' : 'Retirada'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {(delivery as any).scheduled_date
                          ? `${new Date((delivery as any).scheduled_date + 'T12:00:00').toLocaleDateString('pt-BR')}${(delivery as any).scheduled_time ? ' ' + (delivery as any).scheduled_time : ''}`
                          : <span className="text-muted-foreground text-xs">Não agendada</span>}
                      </TableCell>
                      <TableCell>
                        {delivery.drivers?.name || '-'}
                      </TableCell>
                      <TableCell>
                        {isPaymentOnDelivery ? (
                          <Badge className="bg-status-warning text-status-warning-foreground font-bold">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(remaining)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[delivery.status]}>
                          {getStatusIcon(delivery.status)}
                          <span className="ml-1">{STATUS_LABELS[delivery.status]}</span>
                        </Badge>
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDialog(delivery)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerenciar Entrega</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Entregador</Label>
              <Select value={selectedDriver || "__none__"} onValueChange={(v) => setSelectedDriver(v === "__none__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um entregador" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {drivers.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as DeliveryStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_LABELS) as DeliveryStatus[]).map((status) => (
                    <SelectItem key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observações sobre a entrega..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Agendada</Label>
                <Input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Horário</Label>
                <Input type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
