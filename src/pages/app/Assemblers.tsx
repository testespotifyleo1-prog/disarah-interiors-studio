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
import { Loader2, Plus, Wrench, Edit2 } from 'lucide-react';

interface Assembler {
  id: string;
  account_id: string;
  store_id?: string | null;
  name: string;
  phone?: string | null;
  is_active: boolean;
  created_at: string;
}

export default function Assemblers() {
  const { user, currentAccount, currentStore, canManage } = useAuth();
  const { toast } = useToast();

  const [assemblers, setAssemblers] = useState<Assembler[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingAssembler, setEditingAssembler] = useState<Assembler | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (currentAccount) loadAssemblers();
  }, [currentAccount, currentStore]);

  const loadAssemblers = async () => {
    if (!currentAccount) return;
    setLoading(true);
    try {
      let query = supabase
        .from('assemblers')
        .select('*')
        .eq('account_id', currentAccount.id)
        .order('name');
      if (currentStore) {
        query = query.or(`store_id.eq.${currentStore.id},store_id.is.null`);
      }
      const { data, error } = await query;
      if (error) throw error;
      setAssemblers(data || []);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro ao carregar montadores', description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').substring(0, 15);
  };

  const openDialog = (assembler?: Assembler) => {
    if (assembler) {
      setEditingAssembler(assembler);
      setName(assembler.name);
      setPhone(assembler.phone || '');
    } else {
      setEditingAssembler(null);
      setName('');
      setPhone('');
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!currentAccount || !name.trim()) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Preencha o nome do montador' });
      return;
    }
    setSaving(true);
    try {
      if (editingAssembler) {
        const { error } = await supabase
          .from('assemblers')
          .update({ name: name.trim(), phone: phone.replace(/\D/g, '') || null })
          .eq('id', editingAssembler.id);
        if (error) throw error;
        await logActivity({ accountId: currentAccount.id, userId: user!.id, userName: user!.email, action: 'update', entityType: 'assembler', entityId: editingAssembler.id, details: { nome: name.trim() } });
        toast({ title: 'Montador atualizado' });
      } else {
        const { error } = await supabase
          .from('assemblers')
          .insert({
            account_id: currentAccount.id,
            store_id: currentStore?.id || null,
            name: name.trim(),
            phone: phone.replace(/\D/g, '') || null,
          });
        if (error) throw error;
        await logActivity({ accountId: currentAccount.id, userId: user!.id, userName: user!.email, action: 'create', entityType: 'assembler', details: { nome: name.trim() } });
        toast({ title: 'Montador cadastrado' });
      }
      setDialogOpen(false);
      loadAssemblers();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (assembler: Assembler) => {
    try {
      const { error } = await supabase.from('assemblers').update({ is_active: !assembler.is_active }).eq('id', assembler.id);
      if (error) throw error;
      loadAssemblers();
      toast({ title: assembler.is_active ? 'Montador desativado' : 'Montador ativado' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Montadores</h1>
          <p className="text-muted-foreground">Gerencie os montadores</p>
        </div>
        {canManage && (
          <Button onClick={() => openDialog()}>
            <Plus className="mr-2 h-4 w-4" /> Novo Montador
          </Button>
        )}
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{assemblers.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ativos</CardTitle>
            <Wrench className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{assemblers.filter(a => a.is_active).length}</div></CardContent>
        </Card>
        <Card className="col-span-2 md:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Inativos</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{assemblers.filter(a => !a.is_active).length}</div></CardContent>
        </Card>
      </div>

      {/* Mobile cards */}
      <div className="space-y-2 sm:hidden">
        {assemblers.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhum montador cadastrado</p>
        ) : assemblers.map(a => (
          <Card key={a.id}>
            <CardContent className="p-3 flex items-center justify-between">
              <div>
                <p className="font-medium">{a.name}</p>
                <p className="text-xs text-muted-foreground">{a.phone ? formatPhone(a.phone) : 'Sem telefone'}</p>
              </div>
              <div className="flex items-center gap-2">
                {canManage && <Switch checked={a.is_active} onCheckedChange={() => toggleActive(a)} />}
                {canManage && (
                  <Button variant="ghost" size="icon" onClick={() => openDialog(a)}><Edit2 className="h-4 w-4" /></Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop table */}
      <Card className="hidden sm:block">
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
              {assemblers.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum montador cadastrado</TableCell></TableRow>
              ) : assemblers.map(a => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell>{a.phone ? formatPhone(a.phone) : '-'}</TableCell>
                  <TableCell>
                    {canManage ? <Switch checked={a.is_active} onCheckedChange={() => toggleActive(a)} /> : (
                      <Badge variant={a.is_active ? 'default' : 'secondary'}>{a.is_active ? 'Ativo' : 'Inativo'}</Badge>
                    )}
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openDialog(a)}><Edit2 className="h-4 w-4" /></Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingAssembler ? 'Editar Montador' : 'Novo Montador'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="asm-name">Nome</Label>
              <Input id="asm-name" value={name} onChange={e => setName(e.target.value)} placeholder="Nome do montador" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="asm-phone">Telefone</Label>
              <Input id="asm-phone" value={phone} onChange={e => setPhone(formatPhone(e.target.value))} placeholder="(00) 00000-0000" maxLength={15} />
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
