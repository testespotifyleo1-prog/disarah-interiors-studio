import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, Copy, QrCode } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  storeId: string;
  amount: number;
  description?: string;
  saleId?: string;
  payerEmail?: string;
  source?: 'pdv' | 'ecommerce';
  onApproved?: (paymentId: string) => void;
}

interface MpPayment {
  id: string;
  status: string;
  pix_qr_code?: string | null;
  pix_qr_code_base64?: string | null;
  pix_copy_paste?: string | null;
  mp_payment_id?: string | null;
  amount: number;
}

export function MercadoPagoPixDialog({ open, onClose, storeId, amount, description, saleId, payerEmail, source = 'pdv', onApproved }: Props) {
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [payment, setPayment] = useState<MpPayment | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Cria a cobrança ao abrir
  useEffect(() => {
    if (!open || !storeId || amount <= 0) return;
    let cancelled = false;
    (async () => {
      setCreating(true); setError(null); setPayment(null);
      const { data, error } = await supabase.functions.invoke('mp-create-pix', {
        body: { store_id: storeId, amount, description, sale_id: saleId, payer_email: payerEmail, source },
      });
      if (cancelled) return;
      setCreating(false);
      if (error || (data as any)?.error) {
        const msg = (data as any)?.error || error?.message || 'Erro ao gerar PIX';
        setError(msg);
        toast({ variant: 'destructive', title: 'Erro Mercado Pago', description: msg });
      } else {
        setPayment((data as any).payment);
      }
    })();
    return () => { cancelled = true; };
  }, [open, storeId, amount, description, saleId, payerEmail, source, toast]);

  // Realtime: aguarda aprovação
  useEffect(() => {
    if (!payment?.id) return;
    const channel = supabase
      .channel(`mp-pay-${payment.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'mp_payments', filter: `id=eq.${payment.id}`,
      }, (payload: any) => {
        const updated = payload.new as MpPayment;
        setPayment(updated);
        if (updated.status === 'approved') {
          toast({ title: '✅ Pagamento aprovado!', description: `R$ ${Number(updated.amount).toFixed(2)} recebido via PIX.` });
          onApproved?.(updated.id);
          setTimeout(onClose, 1200);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [payment?.id, onApproved, onClose, toast]);

  const copyCode = () => {
    if (!payment?.pix_copy_paste) return;
    navigator.clipboard.writeText(payment.pix_copy_paste);
    toast({ title: 'Código copiado!' });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" /> Cobrança PIX · Mercado Pago
          </DialogTitle>
          <DialogDescription>
            R$ {Number(amount).toFixed(2)} · O pagamento será confirmado automaticamente.
          </DialogDescription>
        </DialogHeader>

        {creating && (
          <div className="flex flex-col items-center py-10 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
          </div>
        )}

        {error && !creating && (
          <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 p-3 rounded">
            {error}
          </div>
        )}

        {payment && payment.status === 'approved' && (
          <div className="flex flex-col items-center py-10 gap-3">
            <CheckCircle2 className="h-16 w-16 text-emerald-500" />
            <p className="font-semibold text-lg">Pagamento aprovado!</p>
          </div>
        )}

        {payment && payment.status !== 'approved' && payment.pix_qr_code_base64 && (
          <div className="space-y-3">
            <div className="flex justify-center bg-white p-4 rounded-lg border">
              <img
                src={`data:image/png;base64,${payment.pix_qr_code_base64}`}
                alt="QR Code PIX"
                className="w-56 h-56"
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground text-center">Ou copie o código PIX:</p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={payment.pix_copy_paste || ''}
                  className="flex-1 px-2 py-1.5 text-xs border rounded bg-muted/50 font-mono truncate"
                />
                <Button size="sm" variant="outline" onClick={copyCode} className="gap-1.5">
                  <Copy className="h-3.5 w-3.5" /> Copiar
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Aguardando pagamento...
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
