import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, Plus, Pencil, Trash2, Bell, AlertTriangle, Tag, Hash,
  MessageSquareWarning, Flame, Save, X
} from 'lucide-react';

interface ActionRule {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  match_categories: string[];
  match_priorities: string[];
  match_statuses: string[];
  keywords: string[];
  tags: string[];
  severity: 'low' | 'normal' | 'high' | 'urgent';
  require_unread: boolean;
  created_at: string;
}

const CATEGORIES = [
  { value: 'support', label: 'Suporte' },
  { value: 'feature_request', label: 'Ajuste técnico' },
];
const PRIORITIES = [
  { value: 'low', label: 'Baixa' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
];
const STATUSES = [
  { value: 'open', label: 'Aberto' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'resolved', label: 'Resolvido' },
  { value: 'closed', label: 'Fechado' },
];
const SEVERITIES = [
  { value: 'low', label: 'Baixa', className: 'bg-muted text-muted-foreground' },
  { value: 'normal', label: 'Normal', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30' },
  { value: 'high', label: 'Alta', className: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30' },
  { value: 'urgent', label: 'Urgente', className: 'bg-destructive/10 text-destructive border-destructive/30' },
];

const emptyForm: Omit<ActionRule, 'id' | 'created_at'> = {
  name: '',
  description: '',
  is_active: true,
  match_categories: [],
  match_priorities: [],
  match_statuses: ['open', 'in_progress'],
  keywords: [],
  tags: [],
  severity: 'normal',
  require_unread: true,
};

export function SupportActionRulesManager() {
  const { toast } = useToast();
  const [rules, setRules] = useState<ActionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ActionRule | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [keywordInput, setKeywordInput] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('support_action_rules' as any)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast({ variant: 'destructive', title: 'Erro ao carregar regras', description: error.message });
    } else {
      setRules((data as any[]) || []);
    }
    setLoading(false);
  };

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setKeywordInput(''); setTagInput('');
    setOpen(true);
  };

  const openEdit = (rule: ActionRule) => {
    setEditing(rule);
    setForm({
      name: rule.name,
      description: rule.description || '',
      is_active: rule.is_active,
      match_categories: rule.match_categories || [],
      match_priorities: rule.match_priorities || [],
      match_statuses: rule.match_statuses || [],
      keywords: rule.keywords || [],
      tags: rule.tags || [],
      severity: rule.severity,
      require_unread: rule.require_unread,
    });
    setKeywordInput(''); setTagInput('');
    setOpen(true);
  };

  const toggleArr = (field: 'match_categories' | 'match_priorities' | 'match_statuses', value: string) => {
    setForm(f => ({
      ...f,
      [field]: f[field].includes(value) ? f[field].filter(v => v !== value) : [...f[field], value],
    }));
  };

  const addKeyword = () => {
    const v = keywordInput.trim().toLowerCase();
    if (!v || form.keywords.includes(v)) return;
    setForm(f => ({ ...f, keywords: [...f.keywords, v] }));
    setKeywordInput('');
  };
  const removeKeyword = (v: string) => setForm(f => ({ ...f, keywords: f.keywords.filter(k => k !== v) }));

  const addTag = () => {
    const v = tagInput.trim().toLowerCase();
    if (!v || form.tags.includes(v)) return;
    setForm(f => ({ ...f, tags: [...f.tags, v] }));
    setTagInput('');
  };
  const removeTag = (v: string) => setForm(f => ({ ...f, tags: f.tags.filter(k => k !== v) }));

  const save = async () => {
    if (!form.name.trim()) {
      toast({ variant: 'destructive', title: 'Nome obrigatório' });
      return;
    }
    setSaving(true);
    const payload = { ...form, name: form.name.trim(), description: form.description?.trim() || null };
    const op = editing
      ? supabase.from('support_action_rules' as any).update(payload).eq('id', editing.id)
      : supabase.from('support_action_rules' as any).insert(payload);
    const { error } = await op;
    setSaving(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: error.message });
      return;
    }
    toast({ title: editing ? 'Regra atualizada' : 'Regra criada' });
    setOpen(false);
    load();
  };

  const toggleActive = async (rule: ActionRule) => {
    const { error } = await supabase
      .from('support_action_rules' as any)
      .update({ is_active: !rule.is_active })
      .eq('id', rule.id);
    if (error) toast({ variant: 'destructive', title: 'Erro', description: error.message });
    else load();
  };

  const remove = async (rule: ActionRule) => {
    if (!confirm(`Apagar a regra "${rule.name}"?`)) return;
    const { error } = await supabase.from('support_action_rules' as any).delete().eq('id', rule.id);
    if (error) toast({ variant: 'destructive', title: 'Erro ao apagar', description: error.message });
    else { toast({ title: 'Regra apagada' }); load(); }
  };

  const sevClass = (s: string) => SEVERITIES.find(x => x.value === s)?.className || '';
  const sevLabel = (s: string) => SEVERITIES.find(x => x.value === s)?.label || s;

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-4 flex items-start gap-3">
          <Bell className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium">Regras para destacar tickets que exigem ação</p>
            <p className="text-muted-foreground text-xs mt-0.5">
              Defina quais combinações de categoria, prioridade, status, palavras-chave e tags devem disparar destaque
              no sino de notificações e na lista de tickets do superadmin.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">{rules.length} regra(s) configurada(s)</h3>
          <p className="text-xs text-muted-foreground">Tickets que se enquadrem em uma regra ativa serão sinalizados.</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Nova regra</Button>
      </div>

      {rules.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">
          Nenhuma regra cadastrada. Clique em "Nova regra" para começar.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {rules.map(rule => (
            <Card key={rule.id} className={`transition-all ${!rule.is_active ? 'opacity-60' : ''}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-base">{rule.name}</CardTitle>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${sevClass(rule.severity)}`}>
                        {sevLabel(rule.severity)}
                      </span>
                      {!rule.is_active && <Badge variant="outline" className="text-[10px]">Inativa</Badge>}
                    </div>
                    {rule.description && (
                      <CardDescription className="mt-1 text-xs">{rule.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Switch checked={rule.is_active} onCheckedChange={() => toggleActive(rule)} />
                    <Button size="icon" variant="ghost" onClick={() => openEdit(rule)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(rule)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 pb-3 space-y-1.5 text-xs">
                {rule.match_categories.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-muted-foreground">Categorias:</span>
                    {rule.match_categories.map(c => (
                      <Badge key={c} variant="secondary" className="text-[10px]">
                        {CATEGORIES.find(x => x.value === c)?.label || c}
                      </Badge>
                    ))}
                  </div>
                )}
                {rule.match_priorities.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Flame className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Prioridades:</span>
                    {rule.match_priorities.map(p => <Badge key={p} variant="secondary" className="text-[10px]">{p}</Badge>)}
                  </div>
                )}
                {rule.match_statuses.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-muted-foreground">Status:</span>
                    {rule.match_statuses.map(s => (
                      <Badge key={s} variant="outline" className="text-[10px]">
                        {STATUSES.find(x => x.value === s)?.label || s}
                      </Badge>
                    ))}
                  </div>
                )}
                {rule.keywords.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <MessageSquareWarning className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Palavras-chave:</span>
                    {rule.keywords.map(k => <Badge key={k} className="text-[10px] bg-primary/10 text-primary border-primary/30" variant="outline">{k}</Badge>)}
                  </div>
                )}
                {rule.tags.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Tag className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Tags:</span>
                    {rule.tags.map(t => <Badge key={t} variant="secondary" className="text-[10px]">#{t}</Badge>)}
                  </div>
                )}
                {rule.require_unread && (
                  <p className="text-[11px] text-muted-foreground italic flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Apenas tickets com mensagens não lidas
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar regra' : 'Nova regra de ação'}</DialogTitle>
            <DialogDescription>
              Configure quando um ticket deve ser sinalizado como exigindo ação imediata.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label>Nome da regra *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Pedidos urgentes de ajuste" />
            </div>

            <div className="grid gap-2">
              <Label>Descrição (opcional)</Label>
              <Textarea value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="O que esta regra captura?" rows={2} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Severidade</Label>
                <Select value={form.severity} onValueChange={v => setForm(f => ({ ...f, severity: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SEVERITIES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-3">
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
                  <Label className="text-sm">Ativa</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.require_unread} onCheckedChange={v => setForm(f => ({ ...f, require_unread: v }))} />
                  <Label className="text-sm">Exige mensagens não lidas</Label>
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Categorias do ticket</Label>
              <div className="flex flex-wrap gap-3">
                {CATEGORIES.map(c => (
                  <label key={c.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={form.match_categories.includes(c.value)} onCheckedChange={() => toggleArr('match_categories', c.value)} />
                    {c.label}
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">Vazio = qualquer categoria.</p>
            </div>

            <div className="grid gap-2">
              <Label>Prioridades</Label>
              <div className="flex flex-wrap gap-3">
                {PRIORITIES.map(p => (
                  <label key={p.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={form.match_priorities.includes(p.value)} onCheckedChange={() => toggleArr('match_priorities', p.value)} />
                    {p.label}
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">Vazio = qualquer prioridade.</p>
            </div>

            <div className="grid gap-2">
              <Label>Status do ticket</Label>
              <div className="flex flex-wrap gap-3">
                {STATUSES.map(s => (
                  <label key={s.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={form.match_statuses.includes(s.value)} onCheckedChange={() => toggleArr('match_statuses', s.value)} />
                    {s.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Palavras-chave (no assunto ou mensagens)</Label>
              <div className="flex gap-2">
                <Input value={keywordInput} onChange={e => setKeywordInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
                  placeholder="Ex: erro, urgente, parado" />
                <Button type="button" onClick={addKeyword} variant="outline">Adicionar</Button>
              </div>
              {form.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {form.keywords.map(k => (
                    <Badge key={k} variant="outline" className="gap-1">
                      {k}
                      <button onClick={() => removeKeyword(k)} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Tags do ticket</Label>
              <div className="flex gap-2">
                <Input value={tagInput} onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                  placeholder="Ex: vip, financeiro" />
                <Button type="button" onClick={addTag} variant="outline">Adicionar</Button>
              </div>
              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {form.tags.map(t => (
                    <Badge key={t} variant="secondary" className="gap-1">
                      #{t}
                      <button onClick={() => removeTag(t)} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editing ? 'Salvar alterações' : 'Criar regra'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
