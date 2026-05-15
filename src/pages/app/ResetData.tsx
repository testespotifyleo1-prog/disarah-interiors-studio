import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function ResetData() {
  const { currentAccount, isOwnerOrAdmin } = useAuth();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [resetting, setResetting] = useState(false);

  const CONFIRM_TEXT = 'RESETAR TUDO';

  const handleReset = async () => {
    if (!currentAccount || confirmation !== CONFIRM_TEXT) return;
    setResetting(true);
    try {
      const { error } = await supabase.rpc('reset_account_data', {
        _account_id: currentAccount.id,
      });
      if (error) throw error;
      toast({ title: 'Dados resetados com sucesso!', description: 'Todos os dados operacionais foram removidos.' });
      setDialogOpen(false);
      setConfirmation('');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro ao resetar', description: error.message });
    } finally {
      setResetting(false);
    }
  };

  if (!isOwnerOrAdmin) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Apenas o proprietário pode acessar esta página.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Resetar Dados</h1>
        <p className="text-muted-foreground">Limpe todos os dados operacionais para começar do zero</p>
      </div>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" /> Zona de Perigo
          </CardTitle>
          <CardDescription>
            Esta ação irá remover permanentemente todos os dados operacionais da sua conta.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-destructive/10 p-4 space-y-2 text-sm">
            <p className="font-medium text-destructive">Os seguintes dados serão removidos:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Todas as vendas, itens e pagamentos</li>
              <li>Todas as comissões</li>
              <li>Todas as entregas e montagens</li>
              <li>Todos os documentos fiscais</li>
              <li>Todo o estoque</li>
              <li>Todos os produtos e clientes</li>
              <li>Todos os motoristas e montadores</li>
              <li>Todos os jobs de importação</li>
            </ul>
            <p className="font-medium mt-2">NÃO serão removidos:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Conta e perfil do usuário</li>
              <li>Lojas cadastradas</li>
              <li>Vendedores/membros da equipe</li>
              <li>Configurações fiscais</li>
            </ul>
          </div>
          <Button variant="destructive" onClick={() => setDialogOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" /> Resetar Todos os Dados
          </Button>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Confirmar Reset</DialogTitle>
            <DialogDescription>
              Esta ação é irreversível. Digite <strong>{CONFIRM_TEXT}</strong> para confirmar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label>Confirmação</Label>
            <Input
              value={confirmation}
              onChange={e => setConfirmation(e.target.value)}
              placeholder={CONFIRM_TEXT}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setConfirmation(''); }}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleReset}
              disabled={resetting || confirmation !== CONFIRM_TEXT}
            >
              {resetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
