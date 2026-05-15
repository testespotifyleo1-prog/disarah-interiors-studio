import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, QrCode, ExternalLink, CheckCircle2, XCircle, Clock,
  FileText, Save, Search, MessageSquare, Calendar, Building2, CreditCard
} from 'lucide-react';

interface PixRequest {
  id: string;
  account_id: string;
  requested_by: string;
  plan_id: string;
  billing_cycle: string;
  amount: number;
  status: string;
  proof_url: string | null;
  support_ticket_id: string | null;
  notes: string | null;
  rejection_reason: string | null;
  activated_until: string | null;
  created_at: string;
  account_name?: string;
  plan_name?: string;
}

export function PixPaymentsManagement() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<PixRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [actionDialog, setActionDialog] = useState<{ type: 'approve' | 'reject'; request: PixRequest } | null>(null);
  const [months, setMonths] = useState('1');
  const [reason, setReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [pixSettings, setPixSettings] = useState({ pix_key: '', pix_holder_name: '', pix_key_type: 'cnpj' });
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    loadRequests();
    loadPixSettings();

    const channel = supabase
      .channel('pix-requests-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pix_payment_requests' }, () => loadRequests())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadPixSettings = async () => {
    const { data } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', ['pix_key', 'pix_holder_name', 'pix_key_type']);
    if (data) {
      const map: any = {};
      data.forEach((r: any) => { map[r.key] = r.value; });
      setPixSettings({
        pix_key: map.pix_key || '',
        pix_holder_name: map.pix_holder_name || 'Typos ERP',
        pix_key_type: map.pix_key_type || 'cnpj',
      });
    }
  };

  const savePixSettings = async () => {
    setSavingSettings(true);
    for (const [key, value] of Object.entries(pixSettings)) {
      await supabase.from('site_settings').update({ value }).eq('key', key);
    }
    setSavingSettings(false);
    toast({ title: 'Configurações PIX salvas!' });
  };

  const loadRequests = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('pix_payment_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      const accountIds = [...new Set(data.map((r: any) => r.account_id))];
      const planIds = [...new Set(data.map((r: any) => r.plan_id))];

      const [accRes, planRes] = await Promise.all([
        supabase.from('accounts').select('id, name').in('id', accountIds),
        supabase.from('plans').select('id, name').in('id', planIds),
      ]);

      const accMap = new Map((accRes.data || []).map((a: any) => [a.id, a.name]));
      const planMap = new Map((planRes.data || []).map((p: any) => [p.id, p.name]));

      setRequests(
        data.map((r: any) => ({
          ...r,
          account_name: accMap.get(r.account_id) || 'N/A',
          plan_name: planMap.get(r.plan_id) || 'N/A',
        })) as PixRequest[]
      );
    }
    setLoading(false);
  };

  const handleApprove = async () => {
    if (!actionDialog) return;
    setProcessing(true);
    const { data, error } = await supabase.rpc('approve_pix_payment', {
      _request_id: actionDialog.request.id,
      _months: parseInt(months) || 1,
    });
    if (error) {
      toast({ variant: 'destructive', title: 'Erro ao aprovar', description: error.message });
    } else {
      toast({ title: '✅ Plano ativado!', description: `Liberado por ${months} mes(es).` });

      // Send confirmation message in support ticket
      if (actionDialog.request.support_ticket_id) {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('support_messages').insert({
          ticket_id: actionDialog.request.support_ticket_id,
          sender_id: user?.id,
          sender_name: 'Suporte Typos',
          sender_type: 'support',
          content: `✅ Pagamento aprovado! Seu plano ${actionDialog.request.plan_name} foi ativado por ${months} mes(es). Aproveite todos os recursos! 🚀`,
        } as any);
        await supabase.from('support_tickets').update({ status: 'resolved', closed_at: new Date().toISOString() } as any).eq('id', actionDialog.request.support_ticket_id);
      }
    }
    setProcessing(false);
    setActionDialog(null);
    setMonths('1');
    loadRequests();
  };

  const handleReject = async () => {
    if (!actionDialog || !reason.trim()) return;
    setProcessing(true);
    const { error } = await supabase.rpc('reject_pix_payment', {
      _request_id: actionDialog.request.id,
      _reason: reason.trim(),
    });
    if (error) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } else {
      toast({ title: 'Solicitação rejeitada' });
      // Send rejection message in support ticket
      if (actionDialog.request.support_ticket_id) {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('support_messages').insert({
          ticket_id: actionDialog.request.support_ticket_id,
          sender_id: user?.id,
          sender_name: 'Suporte Typos',
          sender_type: 'support',
          content: `❌ Não conseguimos validar este pagamento.\n\nMotivo: ${reason.trim()}\n\nPor favor, envie um novo comprovante ou entre em contato.`,
        } as any);
      }
    }
    setProcessing(false);
    setActionDialog(null);
    setReason('');
    loadRequests();
  };

  const filtered = requests.filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (search && !`${r.account_name} ${r.plan_name}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const approvedCount = requests.filter(r => r.status === 'approved').length;

  return (
    <div className="space-y-6">
      {/* PIX Settings */}
      <Card className="border-l-4 border-l-primary">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <QrCode className="h-4 w-4 text-primary" /> Configuração da Chave PIX da Typos
          </CardTitle>
          <CardDescription className="text-xs">Esta chave aparecerá para os clientes que escolherem pagar via PIX.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Chave PIX</Label>
              <Input
                value={pixSettings.pix_key}
                onChange={e => setPixSettings({ ...pixSettings, pix_key: e.target.value })}
                placeholder="Ex: 12.345.678/0001-99"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Tipo de chave</Label>
              <Input
                value={pixSettings.pix_key_type}
                onChange={e => setPixSettings({ ...pixSettings, pix_key_type: e.target.value })}
                placeholder="cnpj, cpf, email, telefone, aleatoria"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Nome do titular</Label>
              <Input
                value={pixSettings.pix_holder_name}
                onChange={e => setPixSettings({ ...pixSettings, pix_holder_name: e.target.value })}
                placeholder="Typos ERP"
                className="mt-1"
              />
            </div>
          </div>
          <Button onClick={savePixSettings} disabled={savingSettings} size="sm" className="gap-2">
            {savingSettings ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Salvar configurações PIX
          </Button>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-xs text-muted-foreground">Aguardando aprovação</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <div>
                <p className="text-2xl font-bold">{approvedCount}</p>
                <p className="text-xs text-muted-foreground">Aprovados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{requests.length}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conta ou plano..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          {(['pending', 'approved', 'rejected', 'all'] as const).map(s => (
            <Button
              key={s}
              size="sm"
              variant={filterStatus === s ? 'default' : 'outline'}
              onClick={() => setFilterStatus(s)}
            >
              {s === 'pending' ? `Pendentes (${pendingCount})` : s === 'approved' ? 'Aprovados' : s === 'rejected' ? 'Rejeitados' : 'Todos'}
            </Button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <QrCode className="h-12 w-12 mx-auto opacity-20 mb-3" />
            <p className="text-sm">Nenhuma solicitação {filterStatus !== 'all' ? filterStatus : ''} encontrada.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(req => {
            const statusColors: Record<string, string> = {
              pending: 'bg-amber-100 text-amber-800 border-amber-200',
              approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
              rejected: 'bg-red-100 text-red-800 border-red-200',
            };
            const statusLabel: Record<string, string> = {
              pending: 'Aguardando',
              approved: 'Aprovado',
              rejected: 'Rejeitado',
            };
            return (
              <Card key={req.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex flex-col lg:flex-row gap-4 lg:items-center justify-between">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <h3 className="font-semibold text-sm">{req.account_name}</h3>
                        <Badge variant="outline" className={`text-[10px] ${statusColors[req.status]}`}>
                          {statusLabel[req.status]}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="font-medium text-foreground">{req.plan_name}</span>
                        <span>·</span>
                        <span>R$ {Number(req.amount).toFixed(2)}</span>
                        <span>·</span>
                        <span>{req.billing_cycle === 'yearly' ? '365 dias' : '30 dias'}</span>
                        <span>·</span>
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(req.created_at).toLocaleString('pt-BR')}</span>
                      </div>
                      {req.activated_until && (
                        <p className="text-xs text-emerald-700">
                          ✅ Liberado até {new Date(req.activated_until).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                      {req.rejection_reason && (
                        <p className="text-xs text-red-700">
                          ❌ Motivo: {req.rejection_reason}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {req.proof_url && (
                        <Button size="sm" variant="outline" asChild>
                          <a href={req.proof_url} target="_blank" rel="noopener noreferrer" className="gap-1.5">
                            <FileText className="h-3.5 w-3.5" /> Comprovante <ExternalLink className="h-3 w-3" />
                          </a>
                        </Button>
                      )}
                      {req.support_ticket_id && (
                        <Button size="sm" variant="ghost" asChild>
                          <a href={`/superadmin?ticket=${req.support_ticket_id}`} className="gap-1.5">
                            <MessageSquare className="h-3.5 w-3.5" /> Chat
                          </a>
                        </Button>
                      )}
                      {req.status === 'pending' && (
                        <>
                          <Button size="sm" variant="destructive" onClick={() => setActionDialog({ type: 'reject', request: req })}>
                            <XCircle className="h-3.5 w-3.5 mr-1" /> Rejeitar
                          </Button>
                          <Button size="sm" onClick={() => { setActionDialog({ type: 'approve', request: req }); setMonths(req.billing_cycle === 'yearly' ? '12' : '1'); }} className="gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar e ativar
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Action Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={(o) => !o && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog?.type === 'approve' ? '✅ Aprovar e ativar plano' : '❌ Rejeitar pagamento'}
            </DialogTitle>
            <DialogDescription>
              {actionDialog?.type === 'approve'
                ? `Confirme a ativação do plano ${actionDialog?.request.plan_name} para ${actionDialog?.request.account_name}.`
                : `Informe o motivo da rejeição. O cliente será notificado pelo chat.`}
            </DialogDescription>
          </DialogHeader>
          {actionDialog?.type === 'approve' ? (
            <div className="space-y-3 py-2">
              <div>
                <Label className="text-xs">Quantos meses ativar?</Label>
                <Input
                  type="number"
                  min="1"
                  value={months}
                  onChange={e => setMonths(e.target.value)}
                  className="mt-1"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Sugerido: {actionDialog?.request.billing_cycle === 'yearly' ? '12 meses (anual)' : '1 mês (mensal)'}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              <Label className="text-xs">Motivo da rejeição</Label>
              <Textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Ex: Comprovante ilegível, valor divergente..."
                rows={3}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)} disabled={processing}>Cancelar</Button>
            {actionDialog?.type === 'approve' ? (
              <Button onClick={handleApprove} disabled={processing}>
                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar ativação'}
              </Button>
            ) : (
              <Button variant="destructive" onClick={handleReject} disabled={processing || !reason.trim()}>
                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Rejeitar'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
