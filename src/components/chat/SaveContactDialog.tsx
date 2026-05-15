import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  accountId: string;
  phone: string;
  initialName?: string | null;
  onSaved: () => void;
}

export default function SaveContactDialog({ open, onClose, conversationId, accountId, phone, initialName, onSaved }: Props) {
  const { toast } = useToast();
  const [name, setName] = useState(initialName || '');
  const [mode, setMode] = useState<'erp' | 'chat'>('erp');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ variant: 'destructive', title: 'Informe um nome' });
      return;
    }
    setSaving(true);
    try {
      if (mode === 'erp') {
        // Verifica se já existe cliente com esse telefone
        const { data: existing } = await supabase
          .from('customers')
          .select('id')
          .eq('account_id', accountId)
          .or(`phone.eq.${phone},phone.ilike.%${phone.slice(-9)}%`)
          .limit(1)
          .maybeSingle();

        let customerId = existing?.id;
        if (!customerId) {
          const { data: created, error } = await supabase
            .from('customers')
            .insert({ account_id: accountId, name: name.trim(), phone })
            .select('id')
            .single();
          if (error) throw error;
          customerId = created.id;
        } else {
          await supabase.from('customers').update({ name: name.trim() }).eq('id', customerId);
        }
        await supabase
          .from('chat_conversations')
          .update({ customer_id: customerId, customer_name: name.trim() })
          .eq('id', conversationId);
        toast({ title: 'Cliente salvo no ERP', description: 'Vinculado a esta conversa.' });
      } else {
        await supabase
          .from('chat_conversations')
          .update({ customer_name: name.trim() })
          .eq('id', conversationId);
        toast({ title: 'Contato salvo no chat' });
      }
      onSaved();
      onClose();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4" /> Salvar contato
          </DialogTitle>
          <DialogDescription className="text-xs">
            {phone}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nome do contato</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: João Silva" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs mb-2 block">Onde salvar?</Label>
            <RadioGroup value={mode} onValueChange={v => setMode(v as 'erp' | 'chat')}>
              <label className="flex items-start gap-2 p-2.5 border rounded-lg cursor-pointer hover:bg-accent/40">
                <RadioGroupItem value="erp" className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Cliente do ERP</p>
                  <p className="text-[11px] text-muted-foreground">
                    Cria/atualiza no cadastro de Clientes. Permite vincular vendas, crediário, etc.
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-2 p-2.5 border rounded-lg cursor-pointer hover:bg-accent/40">
                <RadioGroupItem value="chat" className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Só no chat</p>
                  <p className="text-[11px] text-muted-foreground">
                    Apenas atualiza o nome exibido nesta conversa.
                  </p>
                </div>
              </label>
            </RadioGroup>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
