import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plug, ShieldCheck, AlertCircle, Trash2, ExternalLink } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export default function MagaluIntegration() {
  const { currentAccount } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [connection, setConnection] = useState<any>(null);
  const [hasGlobalCreds, setHasGlobalCreds] = useState(false);

  useEffect(() => { void load(); }, [currentAccount?.id]);

  const load = async () => {
    if (!currentAccount?.id) return;
    setLoading(true);
    const [conn, creds] = await Promise.all([
      (supabase as any).from('magalu_connections').select('*').eq('account_id', currentAccount.id).maybeSingle(),
      (supabase as any).from('magalu_global_credentials').select('id').limit(1).maybeSingle(),
    ]);
    setConnection(conn.data);
    setHasGlobalCreds(!!creds.data);
    setLoading(false);
  };

  const handleConnect = async () => {
    if (!hasGlobalCreds) {
      toast({ variant: 'destructive', title: 'Integração indisponível', description: 'Aguardando configuração pelo administrador.' });
      return;
    }
    setConnecting(true);
    const { data, error } = await supabase.functions.invoke('magalu-connect', {
      body: { action: 'authorize', accountId: currentAccount?.id, returnUrl: `${window.location.origin}/app/integrations/magalu` },
    });
    if (error || !data?.authorize_url) {
      toast({ variant: 'destructive', title: 'Erro ao iniciar conexão', description: error?.message || data?.error });
      setConnecting(false);
      return;
    }
    window.location.href = data.authorize_url;
  };

  const toggleActive = async (val: boolean) => {
    if (!connection) return;
    await (supabase as any).from('magalu_connections').update({ is_active: val }).eq('id', connection.id);
    setConnection({ ...connection, is_active: val });
    toast({ title: val ? 'Magalu ativado' : 'Magalu desativado' });
  };

  const handleDisconnect = async () => {
    if (!connection) return;
    if (!confirm('Tem certeza? Você perderá a sincronização com Magalu.')) return;
    await (supabase as any).from('magalu_connections').delete().eq('id', connection.id);
    setConnection(null);
    toast({ title: 'Conta Magalu desconectada' });
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-lg bg-[#0086FF] flex items-center justify-center text-white font-bold text-xl">M</div>
        <div>
          <h1 className="text-2xl font-bold">Magazine Luiza Marketplace</h1>
          <p className="text-sm text-muted-foreground">Sincronize seus produtos com o Magalu Marketplace.</p>
        </div>
      </div>

      {!hasGlobalCreds && (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              <p className="font-semibold">Integração ainda não disponível</p>
              <p className="text-xs mt-1">Aguardando o administrador concluir o setup OAuth do Magalu.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {connection ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" /> Conta conectada
              </CardTitle>
              <Badge className={connection.is_active ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-muted text-muted-foreground'}>
                {connection.is_active ? 'Ativa' : 'Desativada'}
              </Badge>
            </div>
            <CardDescription>Seller ID: <span className="font-mono">{connection.seller_id || '—'}</span></CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Sincronização ativa</p>
                <p className="text-xs text-muted-foreground">Liga/desliga envio de produtos e recebimento de pedidos.</p>
              </div>
              <Switch checked={connection.is_active} onCheckedChange={toggleActive} />
            </div>
            <Button variant="destructive" size="sm" onClick={handleDisconnect} className="gap-2">
              <Trash2 className="h-4 w-4" /> Desconectar conta
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Conectar sua conta Magalu Marketplace</CardTitle>
            <CardDescription>Você será redirecionado para o Magalu para autorizar o Typos ERP.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
              <p><strong>Pré-requisitos:</strong></p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Contrato de Seller ativo no <a href="https://parceiros.magazineluiza.com.br" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Magalu Parceiros <ExternalLink className="h-3 w-3" /></a></li>
                <li>CNPJ ativo cadastrado no Magalu</li>
              </ul>
            </div>
            <Button onClick={handleConnect} disabled={connecting || !hasGlobalCreds} className="gap-2 w-full sm:w-auto">
              {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
              Conectar conta Magalu
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
