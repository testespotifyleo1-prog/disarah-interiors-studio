import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ShoppingCart, Link as LinkIcon, Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  storeId: string;
  conversationId: string;
  customerName: string | null;
  phone: string;
  onSentLink: () => void;
}

export default function CreateOrderDialog({ open, onClose, storeId, conversationId, customerName, phone, onSentLink }: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [sendingLink, setSendingLink] = useState(false);

  const goToPDV = () => {
    onClose();
    navigate('/app/pdv-rapido');
  };

  const sendStoreLink = async () => {
    setSendingLink(true);
    try {
      const { data: ecom } = await supabase
        .from('store_ecommerce_settings')
        .select('slug, is_enabled')
        .eq('store_id', storeId)
        .maybeSingle();

      if (!ecom?.is_enabled || !ecom.slug) {
        toast({ variant: 'destructive', title: 'E-commerce não habilitado', description: 'Configure a vitrine para esta loja.' });
        return;
      }
      const url = `https://typoserp.com.br/loja/${ecom.slug}`;
      const greeting = customerName ? `Olá, ${customerName}! ` : 'Olá! ';
      const message = `${greeting}Você pode finalizar seu pedido direto pela nossa loja online:\n\n${url}\n\nQualquer dúvida estou aqui! 😊`;

      const { error } = await supabase.functions.invoke('send-whatsapp', {
        body: { conversation_id: conversationId, message },
      });
      if (error) throw error;
      toast({ title: 'Link enviado', description: 'Cliente recebeu o link da loja.' });
      onSentLink();
      onClose();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
      setSendingLink(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Criar pedido para {customerName || phone}</DialogTitle>
          <DialogDescription className="text-xs">Escolha como deseja registrar o pedido.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <button
            onClick={goToPDV}
            className="w-full flex items-start gap-3 p-3 border rounded-lg hover:bg-accent/40 text-left transition-colors"
          >
            <ShoppingCart className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Lançar no PDV Rápido</p>
              <p className="text-[11px] text-muted-foreground">
                Monta a venda no caixa, recebe pagamento e gera comprovante.
              </p>
            </div>
          </button>
          <button
            onClick={sendStoreLink}
            disabled={sendingLink}
            className="w-full flex items-start gap-3 p-3 border rounded-lg hover:bg-accent/40 text-left transition-colors disabled:opacity-50"
          >
            {sendingLink ? <Loader2 className="h-5 w-5 animate-spin mt-0.5 shrink-0" /> : <LinkIcon className="h-5 w-5 text-primary mt-0.5 shrink-0" />}
            <div>
              <p className="text-sm font-medium">Enviar link da loja online</p>
              <p className="text-[11px] text-muted-foreground">
                Cliente finaliza o pedido sozinho pelo e-commerce (PIX/cartão).
              </p>
            </div>
          </button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
