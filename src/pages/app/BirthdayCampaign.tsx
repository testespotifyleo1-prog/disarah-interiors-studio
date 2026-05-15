import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Cake, Loader2, Save, Send, Sparkles, Code2, Eye, Mail, Copy } from 'lucide-react';

interface Settings {
  id?: string;
  account_id: string;
  store_id: string;
  enabled: boolean;
  send_email: boolean;
  email_subject: string;
  email_message: string;
  email_html_template: string | null;
  template_mode: 'default' | 'html';
  coupon_enabled: boolean;
  coupon_code: string | null;
  coupon_description: string | null;
  coupon_valid_days: number;
  coupon_discount_type: 'percent' | 'fixed';
  coupon_discount_value: number;
  coupon_prefix: string | null;
  send_hour: number;
  from_name: string | null;
  reply_to: string | null;
}

const DEFAULT_HTML = `<div style="max-width:560px;margin:0 auto;padding:24px;font-family:Arial,sans-serif;background:#fff;">
  <div style="background:#FFF7F0;border-radius:16px;padding:32px;text-align:center;">
    <h1 style="color:#C45E1A;font-size:28px;margin:0 0 12px;">🎉 Feliz Aniversário, {primeiro_nome}!</h1>
    <p style="color:#444;font-size:16px;line-height:1.6;margin:0 0 20px;">
      A equipe da <strong>{loja}</strong> deseja um dia incrível para você!
    </p>
    <div style="margin:24px 0;padding:20px;border:2px dashed #C45E1A;border-radius:12px;background:#fff;">
      <p style="margin:0 0 6px;font-size:13px;color:#666;text-transform:uppercase;">Seu presente</p>
      <p style="margin:0;font-size:28px;font-weight:bold;color:#C45E1A;letter-spacing:2px;">{cupom}</p>
      <p style="margin:8px 0 0;font-size:14px;color:#333;">{oferta}</p>
      <p style="margin:6px 0 0;font-size:12px;color:#999;">Válido até {validade}</p>
    </div>
    <p style="font-size:13px;color:#999;margin:24px 0 0;">Com carinho,<br><strong>{loja}</strong></p>
  </div>
</div>`;

const DEFAULTS = {
  enabled: false,
  send_email: true,
  email_subject: 'Feliz aniversário, {primeiro_nome}! 🎉',
  email_message: 'Olá {nome}!\n\nA equipe da {loja} deseja um aniversário cheio de alegria, saúde e realizações. 🎂\n\nPreparamos um mimo especial pra você comemorar com a gente!',
  email_html_template: DEFAULT_HTML,
  template_mode: 'default' as const,
  coupon_enabled: false,
  coupon_code: null,
  coupon_description: '',
  coupon_valid_days: 30,
  coupon_discount_type: 'percent' as const,
  coupon_discount_value: 10,
  coupon_prefix: 'ANIVER',
  send_hour: 9,
  from_name: '',
  reply_to: '',
};

const VARIABLES: Array<{ key: string; desc: string }> = [
  { key: 'nome', desc: 'Nome completo do cliente' },
  { key: 'primeiro_nome', desc: 'Primeiro nome do cliente' },
  { key: 'loja', desc: 'Nome da sua loja' },
  { key: 'cupom', desc: 'Código do cupom (se ativo)' },
  { key: 'oferta', desc: 'Descrição da oferta' },
  { key: 'validade', desc: 'Data de validade do cupom' },
];

function renderVars(text: string, vars: Record<string, string>) {
  let out = text || '';
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(v);
  return out;
}

import { isModuleDisabled } from '@/utils/accountModules';
import ModuleBlocked from '@/components/ModuleBlocked';

export default function BirthdayCampaign() {
  const { currentAccount, currentStore, isOwnerOrAdmin } = useAuth();
  if (isModuleDisabled(currentAccount, 'email_marketing')) {
    return <ModuleBlocked title="Aniversários bloqueados" description="O módulo de campanhas de aniversário está bloqueado para esta conta. Contate a equipe Typos para ativar." />;
  }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [s, setS] = useState<Settings | null>(null);
  const [testEmail, setTestEmail] = useState('');

  useEffect(() => {
    if (!currentAccount || !currentStore) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('birthday_campaign_settings')
        .select('*')
        .eq('store_id', currentStore.id)
        .maybeSingle();
      if (data) {
        setS({ ...DEFAULTS, ...(data as any) } as Settings);
      } else {
        setS({ account_id: currentAccount.id, store_id: currentStore.id, ...DEFAULTS } as Settings);
      }
      setLoading(false);
    })();
  }, [currentAccount, currentStore]);

  const update = (patch: Partial<Settings>) => setS(prev => prev ? { ...prev, ...patch } : prev);

  const previewVars = useMemo(() => {
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + (s?.coupon_valid_days || 30));
    return {
      nome: 'Maria Silva',
      primeiro_nome: 'Maria',
      loja: currentStore?.name || 'Sua Loja',
      cupom: `${(s?.coupon_prefix || 'ANIVER').toUpperCase()}-EXEMPLO1`,
      oferta: s?.coupon_enabled
        ? (s.coupon_discount_type === 'percent' ? `${s.coupon_discount_value}% OFF` : `R$ ${Number(s.coupon_discount_value).toFixed(2)} de desconto`) + (s.coupon_description ? ` — ${s.coupon_description}` : '')
        : (s?.coupon_description || ''),
      validade: validUntil.toLocaleDateString('pt-BR'),
    };
  }, [s, currentStore]);

  const previewSubject = useMemo(() => renderVars(s?.email_subject || '', previewVars), [s, previewVars]);
  const previewHtml = useMemo(() => {
    if (!s) return '';
    if (s.template_mode === 'html' && s.email_html_template) {
      return renderVars(s.email_html_template, previewVars);
    }
    const message = renderVars(s.email_message, previewVars).replace(/\n/g, '<br>');
    const coupon = s.coupon_enabled
      ? `<div style="margin:24px 0;padding:20px;border:2px dashed #C45E1A;border-radius:12px;text-align:center;background:#FFF7F0;">
          <p style="margin:0 0 6px;font-size:13px;color:#666;text-transform:uppercase;">Seu presente</p>
          <p style="margin:0 0 8px;font-size:28px;font-weight:bold;color:#C45E1A;letter-spacing:2px;">${previewVars.cupom}</p>
          <p style="margin:0 0 8px;font-size:14px;color:#333;">${previewVars.oferta}</p>
          <p style="margin:0;font-size:12px;color:#999;">Válido até ${previewVars.validade}</p>
        </div>` : '';
    return `<div style="max-width:560px;margin:0 auto;padding:24px;font-family:Arial,sans-serif;background:#fff;">
      <div style="background:#fff;border-radius:16px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
        <h1 style="margin:0 0 8px;color:#C45E1A;font-size:28px;">🎉 Feliz Aniversário, ${previewVars.primeiro_nome}!</h1>
        <p style="margin:0 0 20px;color:#444;font-size:16px;line-height:1.6;">${message}</p>
        ${coupon}
        <p style="margin:24px 0 0;font-size:13px;color:#999;text-align:center;">Com carinho,<br><strong>${previewVars.loja}</strong></p>
      </div>
    </div>`;
  }, [s, previewVars]);

  const save = async () => {
    if (!s || !currentAccount || !currentStore) return;
    setSaving(true);
    try {
      const payload = { ...s, account_id: currentAccount.id, store_id: currentStore.id };
      const { error } = await supabase.from('birthday_campaign_settings').upsert(payload, { onConflict: 'store_id' });
      if (error) throw error;
      toast.success('Configurações salvas!', {
        description: s.enabled ? 'Campanha ativa e pronta para enviar.' : 'Campanha está desativada.',
      });
    } catch (e: any) {
      toast.error('Erro ao salvar', { description: e.message });
    } finally { setSaving(false); }
  };

  const sendTest = async () => {
    if (!s || !currentStore) return;
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-birthday-emails', {
        body: { force_store_id: currentStore.id },
      });
      if (error) throw error;
      const sent = data?.sent ?? 0;
      const skipped = data?.skipped ?? 0;
      const errs = data?.errors_count ?? 0;
      if (sent > 0) {
        toast.success(`✉️ ${sent} e-mail(s) enviado(s)!`, {
          description: `Pulados (já enviados): ${skipped} • Erros: ${errs}`,
        });
      } else if (errs > 0) {
        toast.error(`Falha no envio (${errs} erro(s))`, { description: data?.errors?.[0] || 'Verifique a configuração do Resend.' });
      } else if (skipped > 0) {
        toast.info(`✓ ${skipped} aniversariante(s) já recebeu(ram) e-mail hoje`, {
          description: 'Cada cliente recebe no máximo 1 e-mail de aniversário por ano. Nenhum novo envio necessário.',
        });
      } else {
        toast.info('Nenhum aniversariante hoje', { description: 'Configure clientes com data de nascimento para esta loja.' });
      }
    } catch (e: any) {
      toast.error('Erro no disparo', { description: e.message });
    } finally { setTesting(false); }
  };

  const sendTestEmail = async () => {
    if (!s || !currentStore || !testEmail) return;
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-birthday-emails', {
        body: { force_store_id: currentStore.id, test_email: testEmail },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(`✉️ E-mail de teste enviado!`, { description: `Destino: ${testEmail}. Verifique a caixa de entrada (e o spam).` });
      } else {
        toast.error('Falha ao enviar teste', { description: data?.error || 'Verifique o domínio no Resend.' });
      }
    } catch (e: any) {
      toast.error('Erro no envio de teste', { description: e.message });
    } finally { setTesting(false); }
  };

  const copyVar = (k: string) => {
    navigator.clipboard.writeText(`{${k}}`);
    toast.success(`Variável {${k}} copiada!`);
  };

  if (!isOwnerOrAdmin) {
    return <Card><CardContent className="py-12 text-center text-muted-foreground">Apenas administradores acessam esta área.</CardContent></Card>;
  }
  if (loading || !s) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Cake className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Mensagem de Aniversário</h1>
          <p className="text-sm text-muted-foreground">Envio automático no aniversário do cliente — via e-mail (typoserp.com.br)</p>
        </div>
      </div>

      {/* On/Off */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Ativar envio automático</CardTitle>
              <CardDescription>Quando ativo, todo dia o sistema envia a mensagem para os aniversariantes do dia.</CardDescription>
            </div>
            <Switch checked={s.enabled} onCheckedChange={v => update({ enabled: v })} />
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Horário de envio</Label>
            <Select value={String(s.send_hour)} onValueChange={v => update({ send_hour: Number(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }).map((_, h) => (
                  <SelectItem key={h} value={String(h)}>{String(h).padStart(2, '0')}:00</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">Horário de Brasília</p>
          </div>
          <div className="space-y-2">
            <Label>Nome do remetente</Label>
            <Input value={s.from_name || ''} onChange={e => update({ from_name: e.target.value })} placeholder="Ex: Loja Bela Festa" />
            <p className="text-[11px] text-muted-foreground">Endereço sempre noreply@typoserp.com.br</p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>E-mail para resposta (Reply-To)</Label>
            <Input type="email" value={s.reply_to || ''} onChange={e => update({ reply_to: e.target.value })} placeholder="contato@sualoja.com.br" />
          </div>
        </CardContent>
      </Card>

      {/* Variables helper */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-amber-500" /> Variáveis disponíveis</CardTitle>
          <CardDescription>Clique para copiar e cole no assunto, mensagem ou HTML.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {VARIABLES.map(v => (
            <button key={v.key} onClick={() => copyVar(v.key)} title={v.desc}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-background border text-xs hover:bg-primary hover:text-primary-foreground transition">
              <Copy className="h-3 w-3" /> <code>{`{${v.key}}`}</code>
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Subject */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Assunto do e-mail</CardTitle>
        </CardHeader>
        <CardContent>
          <Input value={s.email_subject} onChange={e => update({ email_subject: e.target.value })} maxLength={150} />
          <p className="text-[11px] text-muted-foreground mt-2">Pré-visualização: <strong>{previewSubject}</strong></p>
        </CardContent>
      </Card>

      {/* Template Editor */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Editor de Template</CardTitle>
              <CardDescription>Escolha entre o layout padrão ou personalize com HTML completo.</CardDescription>
            </div>
            <Badge variant={s.template_mode === 'html' ? 'default' : 'secondary'}>
              {s.template_mode === 'html' ? 'HTML personalizado' : 'Layout padrão'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={s.template_mode} onValueChange={(v: any) => update({ template_mode: v })}>
            <TabsList className="grid w-full grid-cols-2 max-w-md">
              <TabsTrigger value="default"><Mail className="h-3.5 w-3.5 mr-1.5" /> Layout padrão</TabsTrigger>
              <TabsTrigger value="html"><Code2 className="h-3.5 w-3.5 mr-1.5" /> HTML personalizado</TabsTrigger>
            </TabsList>

            <TabsContent value="default" className="space-y-3 mt-4">
              <Label>Texto da mensagem</Label>
              <Textarea value={s.email_message} onChange={e => update({ email_message: e.target.value })} rows={6} maxLength={1500} />
              <p className="text-[11px] text-muted-foreground">O sistema gera automaticamente um layout bonito ao redor do seu texto.</p>
            </TabsContent>

            <TabsContent value="html" className="space-y-3 mt-4">
              <div className="flex items-center justify-between">
                <Label>Código HTML completo</Label>
                <Button variant="ghost" size="sm" onClick={() => update({ email_html_template: DEFAULT_HTML })}>
                  Restaurar exemplo
                </Button>
              </div>
              <Textarea
                value={s.email_html_template || ''}
                onChange={e => update({ email_html_template: e.target.value })}
                rows={16}
                className="font-mono text-xs"
                placeholder="<div>Olá {primeiro_nome}...</div>"
              />
              <p className="text-[11px] text-muted-foreground">Use HTML inline. Estilos via <code>style=""</code> são recomendados para máxima compatibilidade com clientes de e-mail.</p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Live Preview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Eye className="h-4 w-4" /> Pré-visualização</CardTitle>
          <CardDescription>Como o cliente verá o e-mail.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden bg-muted/30">
            <div className="bg-muted px-4 py-2 border-b text-xs flex items-center gap-3">
              <Badge variant="outline">De: {s.from_name || 'Typos! ERP'} &lt;noreply@typoserp.com.br&gt;</Badge>
              <Badge variant="outline">Assunto: {previewSubject}</Badge>
            </div>
            <iframe
              title="Pré-visualização"
              srcDoc={previewHtml}
              className="w-full h-[500px] bg-white"
              sandbox=""
            />
          </div>
        </CardContent>
      </Card>

      {/* Coupon */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Cupom único por cliente</CardTitle>
              <CardDescription>Cada cliente recebe um código exclusivo de uso único, validado nos PDVs e e-commerce.</CardDescription>
            </div>
            <Switch checked={s.coupon_enabled} onCheckedChange={v => update({ coupon_enabled: v })} />
          </div>
        </CardHeader>
        {s.coupon_enabled && (
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Tipo de desconto</Label>
              <Select value={s.coupon_discount_type} onValueChange={(v: 'percent' | 'fixed') => update({ coupon_discount_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percentual (%)</SelectItem>
                  <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{s.coupon_discount_type === 'percent' ? 'Percentual (%)' : 'Valor (R$)'}</Label>
              <Input type="number" min={0} step={s.coupon_discount_type === 'percent' ? 1 : 0.01} value={s.coupon_discount_value} onChange={e => update({ coupon_discount_value: Math.max(0, Number(e.target.value) || 0) })} />
            </div>
            <div className="space-y-2">
              <Label>Validade (dias)</Label>
              <Input type="number" min={1} max={365} value={s.coupon_valid_days} onChange={e => update({ coupon_valid_days: Math.max(1, Number(e.target.value) || 1) })} />
            </div>
            <div className="space-y-2">
              <Label>Prefixo do código</Label>
              <Input value={s.coupon_prefix || ''} onChange={e => update({ coupon_prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) })} placeholder="ANIVER" maxLength={12} />
              <p className="text-[10px] text-muted-foreground">Ex.: ANIVER → ANIVER-AB12CD34</p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Descrição (opcional)</Label>
              <Input value={s.coupon_description || ''} onChange={e => update({ coupon_description: e.target.value })} placeholder="Ex.: válido para qualquer produto" maxLength={120} />
            </div>
          </CardContent>
        )}
      </Card>

      {/* Test send */}
      <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Enviar e-mail de teste</CardTitle>
          <CardDescription>Receba uma cópia exata em um endereço seu para validar layout e entrega.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-2">
          <Input type="email" placeholder="seu-email@exemplo.com" value={testEmail} onChange={e => setTestEmail(e.target.value)} />
          <Button onClick={sendTestEmail} disabled={testing || !testEmail.includes('@')}>
            {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Enviar teste
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-2 sm:justify-between sticky bottom-0 bg-background/95 backdrop-blur py-3 -mx-2 px-2 border-t">
        <Button variant="outline" onClick={sendTest} disabled={testing || !s.enabled}>
          {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
          Disparar agora (aniversariantes de hoje)
        </Button>
        <Button onClick={save} disabled={saving} size="lg">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar configurações
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        💡 O sistema verifica os aniversariantes a cada hora e envia somente no horário escolhido. Cada cliente recebe no máximo 1 e-mail por ano.
      </p>
    </div>
  );
}
