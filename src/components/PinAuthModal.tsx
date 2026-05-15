import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, KeyRound, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PinAuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  onAuthorized: () => void;
}

export default function PinAuthModal({ open, onOpenChange, title, description, onAuthorized }: PinAuthModalProps) {
  const { currentAccount } = useAuth();
  const { toast } = useToast();
  const [pin, setPin] = useState('');
  const [checking, setChecking] = useState(false);

  const handleSubmit = async () => {
    if (!pin.trim() || !currentAccount) return;
    setChecking(true);
    try {
      const { data, error } = await supabase.rpc('verify_account_pin' as any, {
        _account_id: currentAccount.id,
        _pin: pin.trim(),
      });

      if (error) throw error;

      if (!data) {
        toast({ variant: 'destructive', title: 'PIN incorreto', description: 'Verifique o PIN com o dono ou gerente da loja.' });
        setPin('');
        return;
      }

      // Authorized (data = user_id of authorizer)
      setPin('');
      onOpenChange(false);
      onAuthorized();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
      setChecking(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setPin(''); onOpenChange(v); }}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-2">
            <Label className="text-sm">PIN de Autorização</Label>
            <Input
              type="password"
              value={pin}
              onChange={e => setPin(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="PIN do dono ou gerente"
              maxLength={10}
              autoFocus
              className="text-center text-lg tracking-widest"
            />
          </div>
          <p className="text-[11px] text-muted-foreground text-center">
            Solicite o PIN ao dono ou gerente para autorizar esta operação
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} size="sm">Cancelar</Button>
          <Button onClick={handleSubmit} disabled={checking || !pin.trim()} size="sm">
            {checking ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <KeyRound className="mr-1 h-4 w-4" />}
            Autorizar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
