import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Send, Plus, Pencil, Trash2, Eye, AlertTriangle, Image as ImageIcon } from 'lucide-react';

interface Campaign {
  id: string;
  account_id: string;
  store_id: string | null;
  name: string;
  subject: string;
  headline: string;
  body: string;
  cta_label: string | null;
  cta_url: string | null;
  image_url: string | null;
  highlight_price: string | null;
  highlight_old_price: string | null;
  is_active: boolean;
  audience: string;
  total_sent: number;
  last_sent_at: string | null;
  created_at: string;
}

const emptyForm = {
  name: '', subject: '', headline: '', body: '',
  cta_label: 'Aproveitar oferta', cta_url: '',
  image_url: '', highlight_price: '', highlight_old_price: '',
  audience: 'all_customers', is_active: true, store_id: '',
};

import { isModuleDisabled } from '@/utils/accountModules';
import ModuleBlocked from '@/components/ModuleBlocked';

export default function EmailCampaigns() {
  const { currentAccount } = useAuth();
  const { toast } = useToast();
  if (isModuleDisabled(currentAccount, 'email_marketing')) {
    return <ModuleBlocked title="Email Marketing bloqueado" description="O módulo de campanhas de e-mail está bloqueado para esta conta. Contate a equipe Typos para ativar." />;
  }
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stores, setStores] = useState<Array<{ id: string; name: string; logo_path: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [sending, setSending] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [hasLogoSomewhere, setHasLogoSomewhere] = useState(false);

  useEffect(() => {
    if (!currentAccount?.id) return;
    load();
  }, [currentAccount?.id]);

  const load = async () => {
    if (!currentAccount?.id) return;
    setLoading(true);
    const [{ data: c }, { data: s }] = await Promise.all([
      supabase.from('email_campaigns').select('*').eq('account_id', currentAccount.id).order('created_at', { ascending: false }),
      supabase.from('stores').select('id,name,logo_path').eq('account_id', currentAccount.id).eq('is_active', true),
    ]);
    setCampaigns((c as Campaign[]) || []);
    setStores(s || []);
    setHasLogoSomewhere((s || []).some(x => !!x.logo_path));
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, store_id: stores[0]?.id || '' });
    setOpenForm(true);
  };

  const openEdit = (c: Campaign) => {
    setEditing(c);
    setForm({
      name: c.name,
      subject: c.subject,
      headline: c.headline,
      body: c.body,
      cta_label: c.cta_label || '',
      cta_url: c.cta_url || '',
      image_url: c.image_url || '',
      highlight_price: c.highlight_price || '',
      highlight_old_price: c.highlight_old_price || '',
      audience: c.audience,
      is_active: c.is_active,
      store_id: c.store_id || stores[0]?.id || '',
    });
    setOpenForm(true);
  };

  const save = async () => {
    if (!currentAccount?.id) return;
    if (!form.name || !form.subject || !form.headline || !form.body) {
      toast({ title: 'Campos obrigatórios', description: 'Nome, assunto, título e mensagem são obrigatórios.', variant: 'destructive' });
      return;
    }
    const payload: any = {
      account_id: currentAccount.id,
      store_id: form.store_id || null,
      name: form.name,
      subject: form.subject,
      headline: form.headline,
      body: form.body,
      cta_label: form.cta_label || null,
      cta_url: form.cta_url || null,
      image_url: form.image_url || null,
      highlight_price: form.highlight_price || null,
      highlight_old_price: form.highlight_old_price || null,
      audience: form.audience,
      is_active: form.is_active,
    };

    let error;
    if (editing) {
      ({ error } = await supabase.from('email_campaigns').update(payload).eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('email_campaigns').insert(payload));
    }
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: editing ? 'Campanha atualizada' : 'Campanha criada' });
    setOpenForm(false);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('email_campaigns').delete().eq('id', id);
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    toast({ title: 'Campanha removida' });
    load();
  };

  const toggleActive = async (c: Campaign) => {
    await supabase.from('email_campaigns').update({ is_active: !c.is_active }).eq('id', c.id);
    load();
  };

  const send = async (c: Campaign) => {
    setSending(c.id);
    try {
      const { data, error } = await supabase.functions.invoke('send-offer-email', {
        body: { campaign_id: c.id, store_id: c.store_id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({
        title: `Disparo concluído`,
        description: `${(data as any).sent} enviados, ${(data as any).failed} falhas (de ${(data as any).total} destinatários).`,
      });
      load();
    } catch (e: any) {
      toast({ title: 'Falha no envio', description: e?.message || 'Erro desconhecido', variant: 'destructive' });
    } finally {
      setSending(null);
    }
  };

  const buildPreviewHtml = () => {
    const color = '#C45E1A';
    const store = stores.find(s => s.id === form.store_id);
    const storeName = store?.name || currentAccount?.name || 'Loja';
    const logoUrl = store?.logo_path
      ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/store-assets/${store.logo_path}`
      : null;
    const logo = logoUrl
      ? `<img src="${logoUrl}" alt="${storeName}" style="max-height:56px;max-width:200px;display:block;margin:0 auto;" />`
      : `<div style="font-family:Arial,sans-serif;font-size:26px;font-weight:800;color:${color};text-align:center;">${storeName}</div>`;
    const image = form.image_url
      ? `<tr><td style="padding:0 32px;"><img src="${form.image_url}" alt="" style="display:block;width:100%;max-width:536px;height:auto;border-radius:8px;margin:0 0 20px;" /></td></tr>`
      : '';
    const priceBlock = form.highlight_price
      ? `<tr><td style="padding:0 32px 20px;text-align:center;">
          ${form.highlight_old_price ? `<div style="font-size:14px;color:#999;text-decoration:line-through;">${form.highlight_old_price}</div>` : ''}
          <div style="font-size:36px;font-weight:800;color:${color};line-height:1.1;margin-top:4px;">${form.highlight_price}</div>
        </td></tr>` : '';
    const cta = form.cta_label && form.cta_url
      ? `<tr><td align="center" style="padding:8px 32px 32px;"><a href="${form.cta_url}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;padding:14px 36px;border-radius:999px;font-weight:700;">${form.cta_label}</a></td></tr>` : '';
    return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0f0f0;font-family:Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f0f0;padding:24px 0;"><tr><td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;max-width:600px;box-shadow:0 4px 16px rgba(0,0,0,0.06);">
          <tr><td align="center" style="padding:32px 24px 24px;background:#fff;border-bottom:3px solid ${color};">${logo}</td></tr>
          <tr><td style="padding:32px 32px 8px;">
            <p style="margin:0 0 8px;font-size:15px;color:#666;">Olá, <strong>Cliente Exemplo</strong>!</p>
            <h1 style="margin:0 0 16px;font-size:26px;line-height:1.25;color:#1a1a1a;font-weight:800;">${form.headline || 'Sua oferta aqui'}</h1>
          </td></tr>
          ${image}${priceBlock}
          <tr><td style="padding:0 32px 24px;font-size:15px;line-height:1.65;color:#444;">${(form.body || 'Mensagem da oferta').replace(/\n/g, '<br/>')}</td></tr>
          ${cta}
          <tr><td style="padding:24px;background:#f8f8f8;text-align:center;font-family:Arial,sans-serif;font-size:12px;color:#888;">
            <strong style="color:#555;">${storeName}</strong>
            <div style="margin-top:14px;font-size:11px;color:#bbb;">Você está recebendo este email porque é cliente da nossa loja.</div>
          </td></tr>
        </table>
      </td></tr></table>
    </body></html>`;
  };

  const showPreview = () => {
    setPreviewHtml(buildPreviewHtml());
    setPreviewOpen(true);
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-6xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary" /> Campanhas de Email
          </h1>
          <p className="text-sm text-muted-foreground">
            Crie ofertas e dispare por email para seus clientes com 1 clique.
          </p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Nova Campanha</Button>
      </div>

      {!hasLogoSomewhere && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <strong>Recomendação:</strong> Cadastre a logo da sua loja em <a href="/app/stores" className="underline text-amber-700">Lojas</a> para que ela apareça no topo dos emails. Sem logo, exibimos apenas o nome da loja.
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
      ) : campaigns.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Mail className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Nenhuma campanha criada ainda.</p>
          <Button variant="outline" className="mt-4" onClick={openCreate}>Criar minha primeira campanha</Button>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {campaigns.map((c) => (
            <Card key={c.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold truncate">{c.name}</h3>
                      <Badge variant={c.is_active ? 'default' : 'secondary'}>
                        {c.is_active ? 'Ativa' : 'Inativa'}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {c.audience === 'credit_authorized' ? 'Crediaristas' : 'Todos clientes'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{c.subject}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Total enviado: {c.total_sent}
                      {c.last_sent_at && ` · Último envio: ${new Date(c.last_sent_at).toLocaleString('pt-BR')}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Switch checked={c.is_active} onCheckedChange={() => toggleActive(c)} />
                    <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" disabled={sending === c.id}>
                          {sending === c.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                            : <Send className="h-3.5 w-3.5 mr-1" />}
                          Disparar agora
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmar disparo</AlertDialogTitle>
                          <AlertDialogDescription>
                            O email "<strong>{c.subject}</strong>" será enviado imediatamente para todos os clientes do público "{c.audience === 'credit_authorized' ? 'Crediaristas' : 'Todos clientes'}" que tenham email cadastrado.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => send(c)}>Sim, enviar agora</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
                          <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remove(c.id)}>Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Campanha' : 'Nova Campanha de Email'}</DialogTitle>
            <DialogDescription>O email será enviado com a logo e nome da loja selecionada.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Nome interno *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Black Friday Móveis" />
              </div>
              <div>
                <Label>Loja remetente</Label>
                <Select value={form.store_id} onValueChange={v => setForm({ ...form, store_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {stores.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} {!s.logo_path && '(sem logo)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Assunto do email *</Label>
              <Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="Ex: 🔥 50% OFF em todos os sofás!" />
            </div>
            <div>
              <Label>Título principal (headline) *</Label>
              <Input value={form.headline} onChange={e => setForm({ ...form, headline: e.target.value })} placeholder="Ex: Sofá Retrátil por apenas..." />
            </div>
            <div>
              <Label>Mensagem *</Label>
              <Textarea rows={5} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} placeholder="Descreva sua oferta..." />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="flex items-center gap-1"><ImageIcon className="h-3.5 w-3.5" /> URL da imagem (opcional)</Label>
                <Input value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." />
              </div>
              <div>
                <Label>Público-alvo</Label>
                <Select value={form.audience} onValueChange={v => setForm({ ...form, audience: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_customers">Todos clientes com email</SelectItem>
                    <SelectItem value="credit_authorized">Apenas clientes do crediário</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Preço destaque (opcional)</Label>
                <Input value={form.highlight_price} onChange={e => setForm({ ...form, highlight_price: e.target.value })} placeholder="R$ 1.299,00" />
              </div>
              <div>
                <Label>Preço antigo (riscado)</Label>
                <Input value={form.highlight_old_price} onChange={e => setForm({ ...form, highlight_old_price: e.target.value })} placeholder="De R$ 2.499,00" />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Texto do botão (CTA)</Label>
                <Input value={form.cta_label} onChange={e => setForm({ ...form, cta_label: e.target.value })} placeholder="Aproveitar oferta" />
              </div>
              <div>
                <Label>Link do botão</Label>
                <Input value={form.cta_url} onChange={e => setForm({ ...form, cta_url: e.target.value })} placeholder="https://sualoja.com/promo" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
              <Label>Campanha ativa (disponível para disparo)</Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={showPreview}><Eye className="h-4 w-4 mr-1" /> Pré-visualizar</Button>
            <Button onClick={save}>{editing ? 'Salvar' : 'Criar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Pré-visualização</DialogTitle></DialogHeader>
          <iframe srcDoc={previewHtml} className="w-full h-[600px] border rounded" title="preview" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
