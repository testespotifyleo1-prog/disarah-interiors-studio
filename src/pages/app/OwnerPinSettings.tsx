import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, KeyRound, Save, ShieldCheck } from 'lucide-react';

export default function OwnerPinSettings() {
  const { currentAccount, userRole, user } = useAuth();
  const { toast } = useToast();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [hasPin, setHasPin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [managerStores, setManagerStores] = useState<{ id: string; store_id: string; store_name: string; manager_pin: string | null }[]>([]);

  const isOwner = userRole === 'owner';
  const isManager = userRole === 'manager';

  useEffect(() => {
    if (!currentAccount) { setLoading(false); return; }
    if (isOwner) loadOwnerPin();
    else if (isManager) loadManagerPins();
    else setLoading(false);
  }, [currentAccount, userRole]);

  const loadOwnerPin = async () => {
    if (!currentAccount) return;
    const { data } = await supabase.from('accounts').select('owner_pin').eq('id', currentAccount.id).single();
    setHasPin(!!data?.owner_pin);
    setLoading(false);
  };

  const loadManagerPins = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('store_memberships')
      .select('id, store_id, manager_pin, stores(name)')
      .eq('user_id', user.id)
      .eq('is_active', true);
    setManagerStores(
      (data || []).map((sm: any) => ({
        id: sm.id,
        store_id: sm.store_id,
        store_name: sm.stores?.name || 'Loja',
        manager_pin: sm.manager_pin,
      })),
    );
    setLoading(false);
  };

  const handleSavePin = async () => {
    if (!pin.trim() || pin.length < 4) {
      toast({ variant: 'destructive', title: 'PIN deve ter pelo menos 4 caracteres' });
      return;
    }
    if (pin !== confirmPin) {
      toast({ variant: 'destructive', title: 'PINs não conferem' });
      return;
    }
    if (!currentAccount) return;
    setSaving(true);
    try {
      if (isOwner) {
        const { error } = await supabase.from('accounts').update({ owner_pin: pin.trim() }).eq('id', currentAccount.id);
        if (error) throw error;
        setHasPin(true);
      } else if (isManager) {
        // Update manager_pin on all store_memberships of this manager
        const ids = managerStores.map(s => s.id);
        const { error } = await supabase.from('store_memberships').update({ manager_pin: pin.trim() }).in('id', ids);
        if (error) throw error;
        await loadManagerPins();
      }
      toast({ title: 'PIN salvo com sucesso!' });
      setPin(''); setConfirmPin('');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally { setSaving(false); }
  };

  if (!isOwner && !isManager) {
    return <p className="text-muted-foreground text-sm p-4">Somente o dono ou gerente pode configurar o PIN.</p>;
  }
  if (loading) return <div className="flex h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const managerHasPin = isManager && managerStores.some(s => !!s.manager_pin);
  const effectiveHasPin = isOwner ? hasPin : managerHasPin;

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">{isOwner ? 'PIN do Dono' : 'Meu PIN de Gerente'}</h1>
        <p className="text-sm text-muted-foreground">
          {isOwner
            ? 'Configure o PIN para autorizar excedentes no crediário e operações restritas no PDV.'
            : 'Configure seu PIN pessoal para autorizar operações restritas no PDV das suas lojas.'}
        </p>
      </div>

      {isManager && managerStores.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Lojas onde você é gerente</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {managerStores.map(s => (
              <Badge key={s.id} variant={s.manager_pin ? 'default' : 'outline'} className="text-xs">
                {s.store_name} {s.manager_pin ? '✓' : '(sem PIN)'}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><KeyRound className="h-4 w-4" /> Configurar PIN</CardTitle>
          <CardDescription>
            {effectiveHasPin ? 'PIN já configurado. Defina um novo para substituir.' : 'Nenhum PIN configurado ainda.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Novo PIN (mín. 4 caracteres)</Label>
            <Input type="password" value={pin} onChange={e => setPin(e.target.value)} placeholder="Digite o PIN" maxLength={10} />
          </div>
          <div className="space-y-2">
            <Label>Confirme o PIN</Label>
            <Input type="password" value={confirmPin} onChange={e => setConfirmPin(e.target.value)} placeholder="Confirme o PIN" maxLength={10} />
          </div>
          <Button onClick={handleSavePin} disabled={saving || !pin.trim() || (isManager && managerStores.length === 0)}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Salvar PIN
          </Button>
          {isManager && managerStores.length === 0 && (
            <p className="text-xs text-muted-foreground">Você ainda não foi atribuído a nenhuma loja. Solicite ao dono.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
