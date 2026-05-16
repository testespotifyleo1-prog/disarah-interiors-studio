import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, ExternalLink, Upload, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function SiteSettingsAdmin() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['site_settings_admin'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('site_settings').select('*').limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState<any>({});
  useEffect(() => { if (data) setForm(data); }, [data]);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async () => {
    const { id, created_at, updated_at, ...patch } = form;
    const { error } = await (supabase as any).from('site_settings').update(patch).eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Configurações salvas!');
    qc.invalidateQueries({ queryKey: ['site_settings'] });
    qc.invalidateQueries({ queryKey: ['site_settings_admin'] });
  };

  if (!data) return <div className="p-8">Carregando...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Personalizar Site</h1>
          <p className="text-muted-foreground text-sm">Edite as informações exibidas no site institucional.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link to="/site" target="_blank"><ExternalLink className="h-4 w-4 mr-2" />Ver site</Link></Button>
          <Button asChild variant="secondary"><Link to="/app/site/galeria">Gerenciar Galeria</Link></Button>
          <Button onClick={save}><Save className="h-4 w-4 mr-2" />Salvar</Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Hero (Capa)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Tagline</Label><Input value={form.tagline || ''} onChange={(e) => set('tagline', e.target.value)} /></div>
          <div><Label>Título Principal</Label><Input value={form.hero_title || ''} onChange={(e) => set('hero_title', e.target.value)} /></div>
          <div><Label>Subtítulo</Label><Textarea value={form.hero_subtitle || ''} onChange={(e) => set('hero_subtitle', e.target.value)} rows={2} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Sobre</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Título</Label><Input value={form.about_title || ''} onChange={(e) => set('about_title', e.target.value)} /></div>
          <div><Label>Texto</Label><Textarea value={form.about_text || ''} onChange={(e) => set('about_text', e.target.value)} rows={6} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Contato</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div className="md:col-span-2"><Label>Endereço</Label><Input value={form.address || ''} onChange={(e) => set('address', e.target.value)} /></div>
          <div><Label>Telefone</Label><Input value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} /></div>
          <div><Label>E-mail</Label><Input value={form.email || ''} onChange={(e) => set('email', e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>WhatsApp (Botão flutuante)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Número (com DDI + DDD, só dígitos. Ex: 5531984456346)</Label>
            <Input value={form.whatsapp_number || ''} onChange={(e) => set('whatsapp_number', e.target.value)} />
          </div>
          <div>
            <Label>Mensagem pré-preenchida</Label>
            <Textarea value={form.whatsapp_message || ''} onChange={(e) => set('whatsapp_message', e.target.value)} rows={2} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Redes Sociais</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Switch checked={!!form.show_instagram} onCheckedChange={(v) => set('show_instagram', v)} />
            <div className="flex-1"><Label>URL do Instagram</Label><Input value={form.instagram_url || ''} onChange={(e) => set('instagram_url', e.target.value)} /></div>
          </div>
          <div className="flex items-center gap-4">
            <Switch checked={!!form.show_facebook} onCheckedChange={(v) => set('show_facebook', v)} />
            <div className="flex-1"><Label>URL do Facebook</Label><Input value={form.facebook_url || ''} onChange={(e) => set('facebook_url', e.target.value)} /></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Horário de Atendimento</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Dias úteis</Label><Input value={form.hours_weekdays || ''} onChange={(e) => set('hours_weekdays', e.target.value)} /></div>
          <div><Label>Sábado</Label><Input value={form.hours_saturday || ''} onChange={(e) => set('hours_saturday', e.target.value)} /></div>
          <div><Label>Domingo</Label><Input value={form.hours_sunday || ''} onChange={(e) => set('hours_sunday', e.target.value)} /></div>
        </CardContent>
      </Card>

      <div className="flex justify-end pb-10">
        <Button size="lg" onClick={save}><Save className="h-4 w-4 mr-2" />Salvar Tudo</Button>
      </div>
    </div>
  );
}
