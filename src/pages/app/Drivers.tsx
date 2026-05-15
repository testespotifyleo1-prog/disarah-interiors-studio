import { useState, useEffect } from 'react';
import { logActivity } from '@/utils/activityLog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Truck, Edit2, Trash2 } from 'lucide-react';
import type { Driver } from '@/types/database';

export default function Drivers() {
  const { user, currentAccount, currentStore, canManage } = useAuth();
  const { toast } = useToast();

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (currentAccount) {
      loadDrivers();
    }
  }, [currentAccount, currentStore]);

  const loadDrivers = async () => {
    if (!currentAccount) return;
    setLoading(true);

    try {
      let query = supabase
        .from('drivers')
        .select('*')
        .eq('account_id', currentAccount.id)
        .order('name');

      if (currentStore) {
        query = query.or(`store_id.eq.${currentStore.id},store_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setDrivers(data || []);
    } catch (error: any) {
      console.error('Error loading drivers:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar entregadores',
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .substring(0, 15);
  };

  const openDialog = (driver?: Driver) => {
    if (driver) {
      setEditingDriver(driver);
      setName(driver.name);
      setPhone(driver.phone || '');
    } else {
      setEditingDriver(null);
      setName('');
      setPhone('');
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!currentAccount || !name.trim()) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Preencha o nome do entregador',
      });
      return;
    }

    setSaving(true);
    try {
      if (editingDriver) {
        const { error } = await supabase
          .from('drivers')
          .update({
            name: name.trim(),
            phone: phone.replace(/\D/g, '') || null,
          })
          .eq('id', editingDriver.id);

        if (error) throw error;
        await logActivity({ accountId: currentAccount.id, userId: user!.id, userName: user!.email, action: 'update', entityType: 'driver', entityId: editingDriver.id, details: { nome: name.trim() } });
        toast({ title: 'Entregador atualizado' });
      } else {
        const { error } = await supabase
          .from('drivers')
          .insert({
            account_id: currentAccount.id,
            store_id: currentStore?.id || null,
            name: name.trim(),
            phone: phone.replace(/\D/g, '') || null,
          });

        if (error) throw error;
        await logActivity({ accountId: currentAccount.id, userId: user!.id, userName: user!.email, action: 'create', entityType: 'driver', details: { nome: name.trim() } });
        toast({ title: 'Entregador cadastrado' });
      }

      setDialogOpen(false);
      loadDrivers();
    } catch (error: any) {
      console.error('Error saving driver:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleDriverActive = async (driver: Driver) => {
    try {
      const { error } = await supabase
        .from('drivers')
        .update({ is_active: !driver.is_active })
        .eq('id', driver.id);

      if (error) throw error;
      loadDrivers();
      toast({
        title: driver.is_active ? 'Entregador desativado' : 'Entregador ativado',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message,
      });
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
          <h1 className="text-2xl font-bold">Entregadores</h1>
          <p className="text-muted-foreground">Gerencie os entregadores</p>
        </div>
        {canManage && (
          <Button onClick={() => openDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Entregador
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{drivers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ativos</CardTitle>
            <Truck className="h-4 w-4 text-status-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{drivers.filter(d => d.is_active).length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Inativos</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{drivers.filter(d => !d.is_active).length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead className="w-[100px]">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {drivers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Nenhum entregador cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                drivers.map((driver) => (
                  <TableRow key={driver.id}>
                    <TableCell className="font-medium">{driver.name}</TableCell>
                    <TableCell>
                      {driver.phone ? formatPhone(driver.phone) : '-'}
                    </TableCell>
                    <TableCell>
                      {canManage ? (
                        <Switch
                          checked={driver.is_active}
                          onCheckedChange={() => toggleDriverActive(driver)}
                        />
                      ) : (
                        <Badge variant={driver.is_active ? 'default' : 'secondary'}>
                          {driver.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      )}
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDialog(driver)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDriver ? 'Editar Entregador' : 'Novo Entregador'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome do entregador"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                placeholder="(00) 00000-0000"
                maxLength={15}
              />
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
