import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Copy, Check, QrCode, Upload, ShieldAlert, Clock, CheckCircle2, FileImage, Sparkles } from 'lucide-react';
import { generatePixPayload, getPixQrCodeUrl } from '@/utils/pixUtils';

interface PixManualPaymentProps {
  planId: string;
  planName: string;
  amount: number;
  billingCycle: 'monthly' | 'yearly';
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function PixManualPayment({ planId, planName, amount, billingCycle, onSuccess, onCancel }: PixManualPaymentProps) {
  const { user, currentAccount } = useAuth();
  const { toast } = useToast();
  const [pixKey, setPixKey] = useState('');
  const [pixHolder, setPixHolder] = useState('Typos ERP');
  const [keyType, setKeyType] = useState('cnpj');
  const [loadingKey, setLoadingKey] = useState(true);
  const [copied, setCopied] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    supabase
      .from('site_settings')
      .select('key, value')
      .in('key', ['pix_key', 'pix_holder_name', 'pix_key_type'])
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {};
          data.forEach((r: any) => { map[r.key] = r.value; });
          setPixKey(map.pix_key || '');
          setPixHolder(map.pix_holder_name || 'Typos ERP');
          setKeyType(map.pix_key_type || 'cnpj');
        }
        setLoadingKey(false);
      });
  }, []);

  const pixPayload = pixKey
    ? generatePixPayload({
        pixKey,
        merchantName: pixHolder.substring(0, 25),
        merchantCity: 'BRASIL',
        amount,
        description: `Typos ${planName}`,
      })
    : '';
  const qrUrl = pixPayload ? getPixQrCodeUrl(pixPayload, 240) : '';

  const copyKey = () => {
    navigator.clipboard.writeText(pixKey);
    setCopied(true);
    toast({ title: 'Chave PIX copiada!' });
    setTimeout(() => setCopied(false), 2000);
  };

  const copyPayload = () => {
    navigator.clipboard.writeText(pixPayload);
    toast({ title: 'Código PIX copia e cola copiado!' });
  };

  const handleSubmit = async () => {
    if (!file || !user || !currentAccount) {
      toast({ variant: 'destructive', title: 'Anexe o comprovante para continuar.' });
      return;
    }
    setSubmitting(true);

    // 1. Upload proof
    const ext = file.name.split('.').pop();
    const path = `${currentAccount.id}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('payment-proofs')
      .upload(path, file, { upsert: false });

    if (uploadError) {
      toast({ variant: 'destructive', title: 'Erro ao enviar comprovante', description: uploadError.message });
      setSubmitting(false);
      return;
    }

    // 2. Create support ticket
    const subject = `Pagamento PIX — ${planName} (${billingCycle === 'yearly' ? 'Anual' : 'Mensal'})`;
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .insert({
        account_id: currentAccount.id,
        created_by: user.id,
        subject,
        priority: 'high',
      } as any)
      .select()
      .single();

    if (ticketError || !ticket) {
      toast({ variant: 'destructive', title: 'Erro ao criar chamado', description: ticketError?.message });
      setSubmitting(false);
      return;
    }

    // 3. Get signed URL for proof
    const { data: signed } = await supabase.storage
      .from('payment-proofs')
      .createSignedUrl(path, 60 * 60 * 24 * 30);

    // 4. Send message with proof
    await supabase.from('support_messages').insert({
      ticket_id: (ticket as any).id,
      sender_id: user.id,
      sender_name: user.user_metadata?.full_name || user.email,
      sender_type: 'client',
      content: `Olá! Acabei de realizar o pagamento PIX no valor de R$ ${amount.toFixed(2)} para o plano ${planName} (${billingCycle === 'yearly' ? '365 dias' : '30 dias'}). Segue o comprovante anexo. Aguardo a liberação. Obrigado!`,
      attachment_url: signed?.signedUrl || null,
      attachment_type: file.type,
    } as any);

    // 5. Create PIX payment request
    await supabase.from('pix_payment_requests').insert({
      account_id: currentAccount.id,
      requested_by: user.id,
      plan_id: planId,
      billing_cycle: billingCycle,
      amount,
      proof_url: signed?.signedUrl || null,
      support_ticket_id: (ticket as any).id,
    } as any);

    setSuccess(true);
    setSubmitting(false);
    toast({ title: 'Comprovante enviado!', description: 'Sua liberação será feita em até 1 hora.' });
    onSuccess?.();
  };

  if (loadingKey) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!pixKey) {
    return (
      <Card className="border-warning/40 bg-warning/5">
        <CardContent className="pt-6 text-center space-y-3">
          <ShieldAlert className="h-10 w-10 text-warning mx-auto" />
          <h3 className="font-semibold">PIX indisponível no momento</h3>
          <p className="text-sm text-muted-foreground">
            Nossa chave PIX ainda não foi configurada. Entre em contato com o suporte para receber as instruções de pagamento.
          </p>
          {onCancel && <Button variant="outline" onClick={onCancel}>Voltar</Button>}
        </CardContent>
      </Card>
    );
  }

  if (success) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-9 w-9 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold">Comprovante recebido!</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Seu pagamento será conferido em até <strong>1 hora</strong> e o plano ativado automaticamente.
              Você pode acompanhar a liberação pelo chat de suporte.
            </p>
          </div>
          {onCancel && (
            <Button onClick={onCancel} className="gap-2">
              Voltar para minha assinatura
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Critical warning */}
      <Card className="border-amber-500/40 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/10">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5 text-amber-600" />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-sm text-amber-900 dark:text-amber-200">
                💡 Pague antes do vencimento
              </h4>
              <p className="text-xs text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                Para evitar que sua conta fique <strong>inativa</strong>, realize o pagamento PIX antes do vencimento do seu plano.
                A liberação manual leva até <strong>1 hora</strong> em horário comercial. Se preferir liberação imediata, opte pelo cartão de crédito.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment summary */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Plano</p>
              <p className="font-bold">{planName}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{billingCycle === 'yearly' ? '365 dias' : '30 dias'}</p>
              <p className="text-2xl font-black text-primary">R$ {amount.toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* QR + Key */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-primary/10 to-transparent p-5">
          <div className="flex items-center gap-2 mb-3">
            <QrCode className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">1. Pague com PIX</h3>
          </div>
          <div className="grid sm:grid-cols-[auto_1fr] gap-4 items-center">
            {qrUrl && (
              <div className="bg-white rounded-xl p-3 border mx-auto">
                <img src={qrUrl} alt="QR Code PIX" className="w-[180px] h-[180px]" />
              </div>
            )}
            <div className="space-y-3">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Titular</p>
                <p className="font-medium text-sm">{pixHolder}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Tipo de chave</p>
                <p className="font-medium text-sm capitalize">{keyType}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Chave PIX</p>
                <div className="flex gap-1.5 mt-1">
                  <Input value={pixKey} readOnly className="font-mono text-xs" />
                  <Button size="icon" variant="outline" onClick={copyKey} className="shrink-0">
                    {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <Button onClick={copyPayload} variant="secondary" size="sm" className="w-full gap-1.5">
                <Copy className="h-3.5 w-3.5" /> Copiar PIX copia-e-cola
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Upload proof */}
      <Card>
        <CardContent className="pt-5 pb-5 space-y-3">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">2. Envie o comprovante</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Anexe o comprovante (PDF ou imagem) — vamos abrir um chamado de suporte automático para liberação.
          </p>
          <label className="block">
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="hidden"
              id="pix-proof-input"
            />
            <div className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${file ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'}`}>
              {file ? (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <FileImage className="h-5 w-5 text-primary" />
                  <span className="font-medium truncate max-w-[280px]">{file.name}</span>
                </div>
              ) : (
                <>
                  <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1.5" />
                  <p className="text-sm font-medium">Clique para anexar comprovante</p>
                  <p className="text-[11px] text-muted-foreground">PNG, JPG ou PDF</p>
                </>
              )}
            </div>
          </label>
          <Button
            onClick={() => document.getElementById('pix-proof-input')?.click()}
            variant="ghost"
            size="sm"
            className="w-full"
          >
            {file ? 'Trocar arquivo' : 'Selecionar arquivo'}
          </Button>
        </CardContent>
      </Card>

      {/* Liberation info */}
      <div className="rounded-lg bg-muted/30 border border-border px-4 py-3 flex items-start gap-2.5">
        <Clock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Liberação em até 1 hora</strong> em horário comercial.
          Após enviar o comprovante, nossa equipe verifica o pagamento e ativa seu plano. Você é notificado pelo chat de suporte.
        </p>
      </div>

      <div className="flex gap-2">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} className="flex-1" disabled={submitting}>
            Voltar
          </Button>
        )}
        <Button onClick={handleSubmit} disabled={!file || submitting} className="flex-1 gap-2">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Enviar comprovante
        </Button>
      </div>
    </div>
  );
}
