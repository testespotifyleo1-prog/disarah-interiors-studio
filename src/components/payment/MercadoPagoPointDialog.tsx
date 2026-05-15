import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, Smartphone, X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  storeId: string;
  amount: number;
  saleId?: string;
  method: 'credit_card' | 'debit_card';
  onApproved?: (paymentId: string) => void;
}

export function MercadoPagoPointDialog({ open, onClose, storeId, amount, saleId, method, onApproved }: Props) {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [payment, setPayment] = useState<any>(null);
  const [installments, setInstallments] = useState(1);

  const sendToTerminal = async () => {
    setSending(true);
    const { data, error } = await supabase.functions.invoke('mp-point-charge', {
      body: { store_id: storeId, amount, sale_id: saleId, method, installments },
    });
    setSending(false);
    if (error || (data as any)?.error) {
      toast({ variant: 'destructive', title: 'Erro maquininha', description: (data as any)?.error || error?.message });
      return;
    }
    setPayment((data as any).payment);
    toast({ title: '📲 Enviado para a maquininha', description: 'Cliente pode aproximar/inserir o cartão.' });
  };

  useEffect(() => {
    if (!payment?.id) return;
    const channel = supabase
      .channel(`mp-point-${payment.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'mp_payments', filter: `id=eq.${payment.id}`,
      }, (payload: any) => {
        const updated = payload.new;
        setPayment(updated);
        if (updated.status === 'approved') {
          toast({ title: '✅ Pagamento aprovado!' });
          onApproved?.(updated.id);
          setTimeout(onClose, 1200);
        } else if (updated.status === 'rejected' || updated.status === 'cancelled') {
          toast({ variant: 'destructive', title: 'Pagamento não concluído' });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [payment?.id, onApproved, onClose, toast]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" /> Maquininha Point · {method === 'debit_card' ? 'Débito' : 'Crédito'}
          </DialogTitle>
          <DialogDescription>R$ {Number(amount).toFixed(2)}</DialogDescription>
        </DialogHeader>

        {!payment && (
          <div className="space-y-3">
            {method === 'credit_card' && (
              <div>
                <Label className="text-xs">Parcelas</Label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={installments}
                  onChange={e => setInstallments(Math.max(1, Math.min(12, parseInt(e.target.value) || 1)))}
                  className="mt-1 max-w-xs"
                />
              </div>
            )}
            <Button onClick={sendToTerminal} disabled={sending} className="w-full gap-1.5">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
              Enviar para a maquininha
            </Button>
          </div>
        )}

        {payment && payment.status === 'pending' && (
          <div className="flex flex-col items-center py-8 gap-3">
            <Smartphone className="h-12 w-12 text-primary animate-pulse" />
            <p className="font-medium text-center">Aguardando o cliente pagar na maquininha...</p>
            <p className="text-xs text-muted-foreground">A confirmação chega automaticamente.</p>
          </div>
        )}

        {payment?.status === 'approved' && (
          <div className="flex flex-col items-center py-8 gap-3">
            <CheckCircle2 className="h-16 w-16 text-emerald-500" />
            <p className="font-semibold text-lg">Pagamento aprovado!</p>
          </div>
        )}

        {(payment?.status === 'rejected' || payment?.status === 'cancelled') && (
          <div className="flex flex-col items-center py-8 gap-3">
            <X className="h-16 w-16 text-destructive" />
            <p className="font-semibold">Pagamento {payment.status === 'rejected' ? 'recusado' : 'cancelado'}</p>
            <Button variant="outline" onClick={() => setPayment(null)}>Tentar novamente</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
