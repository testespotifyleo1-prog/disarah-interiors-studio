import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, AlertCircle, CheckCircle2, RefreshCw, ShieldCheck, ShieldAlert } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  accountId: string;
  storeId: string;
  onCreated: (conversationId: string) => void;
}

interface HealthCheck {
  ok: boolean;
  configured?: boolean;
  error?: string;
  checks?: {
    connected: { ok: boolean; detail: string | null };
    phone_exists: { ok: boolean; detail: string | null };
    profile_lookup: { ok: boolean; detail: string | null };
  };
}

export default function NewContactDialog({ open, onClose, accountId, storeId, onCreated }: Props) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saveAsCustomer, setSaveAsCustomer] = useState(true);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [health, setHealth] = useState<HealthCheck | null>(null);
  const [checking, setChecking] = useState(false);

  const reset = () => {
    setName(''); setPhone(''); setSaveAsCustomer(true); setNotFound(false);
  };

  const runHealthCheck = async () => {
    if (!storeId) return;
    setChecking(true);
    setHealth(null);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-health-check', {
        body: { store_id: storeId },
      });
      if (error) {
        setHealth({ ok: false, error: error.message });
      } else {
        setHealth(data as HealthCheck);
      }
    } catch (e: any) {
      setHealth({ ok: false, error: e.message });
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (open) runHealthCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, storeId]);

  const handleClose = () => { if (!loading) { reset(); onClose(); } };

  const handleSubmit = async () => {
    if (!health?.ok) {
      toast({ variant: 'destructive', title: 'Z-API indisponível', description: 'Não é possível adicionar contatos enquanto a integração não estiver saudável.' });
      return;
    }
    if (!phone.trim()) {
      toast({ variant: 'destructive', title: 'Informe o telefone' });
      return;
    }
    setNotFound(false);
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-add-contact', {
        body: {
          account_id: accountId,
          store_id: storeId,
          phone: phone.trim(),
          name: name.trim() || null,
          save_as_customer: saveAsCustomer && !!name.trim(),
        },
      });
      if (error) {
        let payload: any = null;
        try { payload = await (error as any).context?.json?.(); } catch (_) {}
        if (payload?.error === 'not_on_whatsapp') { setNotFound(true); return; }
        throw new Error(payload?.error || error.message);
      }
      if (data?.error === 'not_on_whatsapp') { setNotFound(true); return; }
      toast({ title: 'Contato adicionado!', description: 'Conversa criada — pronto para enviar mensagem.' });
      onCreated(data.conversation.id);
      reset();
      onClose();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const renderHealth = () => {
    if (checking) {
      return (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 border text-xs">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Verificando integração WhatsApp…
        </div>
      );
    }
    if (!health) return null;
    if (health.ok) {
      return (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-500/10 border border-green-300 text-green-700 text-xs">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span className="flex-1">Z-API conectada e respondendo. Pronto para adicionar.</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={runHealthCheck} title="Revalidar">
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      );
    }
    return (
      <div className="space-y-1.5 p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span className="flex-1 font-medium">
            {health.configured === false ? 'Z-API não configurada' : 'Integração com problemas'}
          </span>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/20" onClick={runHealthCheck} title="Tentar novamente">
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
        {health.error && <p className="text-[11px] opacity-90">{health.error}</p>}
        {health.checks && (
          <ul className="text-[11px] space-y-0.5 mt-1">
            <li className="flex items-center gap-1.5">
              {health.checks.connected.ok ? <CheckCircle2 className="h-3 w-3 text-green-600" /> : <AlertCircle className="h-3 w-3" />}
              <span>Instância: {health.checks.connected.detail}</span>
            </li>
            <li className="flex items-center gap-1.5">
              {health.checks.phone_exists.ok ? <CheckCircle2 className="h-3 w-3 text-green-600" /> : <AlertCircle className="h-3 w-3" />}
              <span>Validação de número: {health.checks.phone_exists.detail}</span>
            </li>
            <li className="flex items-center gap-1.5">
              {health.checks.profile_lookup.ok ? <CheckCircle2 className="h-3 w-3 text-green-600" /> : <AlertCircle className="h-3 w-3" />}
              <span>Busca de perfil: {health.checks.profile_lookup.detail}</span>
            </li>
          </ul>
        )}
      </div>
    );
  };

  const disabled = loading || checking || !health?.ok;

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4" /> Novo contato
          </DialogTitle>
          <DialogDescription className="text-xs">
            Verificamos no WhatsApp se o número existe e já criamos a conversa para você enviar mensagem.
          </DialogDescription>
        </DialogHeader>

        {renderHealth()}

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nome (opcional)</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: João Silva" className="mt-1" disabled={!health?.ok} />
          </div>
          <div>
            <Label className="text-xs">Telefone com DDD</Label>
            <Input
              value={phone}
              onChange={e => { setPhone(e.target.value); setNotFound(false); }}
              placeholder="11999998888"
              inputMode="tel"
              className="mt-1"
              disabled={!health?.ok}
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Sem DDI: adicionamos +55 automaticamente. Com DDI: digite completo (ex: 5511999998888).
            </p>
          </div>
          {name.trim() && (
            <label className="flex items-start gap-2 p-2 border rounded-lg cursor-pointer hover:bg-accent/40">
              <Checkbox checked={saveAsCustomer} onCheckedChange={v => setSaveAsCustomer(!!v)} className="mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-medium">Salvar também como cliente do ERP</p>
                <p className="text-[10px] text-muted-foreground">Aparecerá em Vendas, Crediário, etc.</p>
              </div>
            </label>
          )}

          {notFound && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="text-xs">
                <p className="font-medium">Número não está no WhatsApp</p>
                <p className="text-[11px] opacity-80">Verifique se o número está correto ou se a pessoa usa WhatsApp.</p>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={disabled}>
            {loading ? (
              <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Verificando…</>
            ) : (
              <><CheckCircle2 className="h-4 w-4 mr-1" /> Adicionar</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
