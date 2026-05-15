import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Wifi, WifiOff, RefreshCw, Loader2, CheckCircle2, AlertTriangle, Cloud } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { getOfflineSales, clearSyncedSales, type OfflineSale } from '@/services/offlineStore';
import { syncOfflineSales, isSyncing } from '@/services/offlineSync';
import { useToast } from '@/hooks/use-toast';

interface OfflineIndicatorProps {
  storeId?: string;
}

export default function OfflineIndicator({ storeId }: OfflineIndicatorProps) {
  const { isOnline, status } = useOnlineStatus();
  const { toast } = useToast();
  const [pendingCount, setPendingCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [syncingCount, setSyncingCount] = useState(0);
  const [showPanel, setShowPanel] = useState(false);
  const [offlineSales, setOfflineSales] = useState<OfflineSale[]>([]);
  const [syncing, setSyncing] = useState(false);

  const refreshCounts = useCallback(async () => {
    const all = await getOfflineSales(storeId);
    setOfflineSales(all);
    setPendingCount(all.filter(s => s.status === 'pending').length);
    setErrorCount(all.filter(s => s.status === 'error').length);
    setSyncingCount(all.filter(s => s.status === 'syncing').length);
  }, [storeId]);

  useEffect(() => {
    refreshCounts();
    const interval = setInterval(refreshCounts, 5000);
    return () => clearInterval(interval);
  }, [refreshCounts]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pendingCount > 0 && !syncing) {
      handleSync();
    }
  }, [isOnline, pendingCount]);

  const handleSync = async () => {
    if (syncing || isSyncing()) return;
    setSyncing(true);
    try {
      const results = await syncOfflineSales(storeId);
      const successes = results.filter(r => r.success).length;
      const failures = results.filter(r => !r.success).length;
      
      if (successes > 0) {
        toast({
          title: `${successes} venda(s) sincronizada(s)!`,
          description: failures > 0 ? `${failures} com erro` : undefined,
        });
      }
      if (failures > 0 && successes === 0) {
        toast({
          variant: 'destructive',
          title: 'Erro na sincronização',
          description: `${failures} venda(s) com falha. Tente novamente.`,
        });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
      setSyncing(false);
      refreshCounts();
    }
  };

  const handleClearSynced = async () => {
    await clearSyncedSales();
    refreshCounts();
    toast({ title: 'Vendas sincronizadas removidas do cache' });
  };

  const totalPending = pendingCount + errorCount + syncingCount;
  const hasIssues = !isOnline || totalPending > 0;

  if (!hasIssues && status === 'online') return null;

  const getStatusBadge = (sale: OfflineSale) => {
    switch (sale.status) {
      case 'pending': return <Badge variant="outline" className="text-yellow-600 border-yellow-300"><Cloud className="h-3 w-3 mr-1" />Pendente</Badge>;
      case 'syncing': return <Badge variant="outline" className="text-blue-600 border-blue-300"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Sincronizando</Badge>;
      case 'synced': return <Badge variant="outline" className="text-green-600 border-green-300"><CheckCircle2 className="h-3 w-3 mr-1" />Sincronizada</Badge>;
      case 'error': return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Erro</Badge>;
    }
  };

  const fc = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Connection status */}
        {!isOnline && (
          <Badge variant="destructive" className="gap-1 cursor-pointer animate-pulse" onClick={() => setShowPanel(true)}>
            <WifiOff className="h-3 w-3" /> Offline
          </Badge>
        )}

        {/* Pending count */}
        {totalPending > 0 && (
          <Badge
            variant="outline"
            className="gap-1 cursor-pointer border-yellow-400 text-yellow-600 hover:bg-yellow-50"
            onClick={() => setShowPanel(true)}
          >
            <Cloud className="h-3 w-3" />
            {totalPending} pendente{totalPending > 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      <Dialog open={showPanel} onOpenChange={setShowPanel}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isOnline ? <Wifi className="h-5 w-5 text-green-500" /> : <WifiOff className="h-5 w-5 text-red-500" />}
              Status da Conexão
            </DialogTitle>
            <DialogDescription>
              {isOnline ? 'Conectado ao servidor' : 'Sem conexão — modo de contingência ativo'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border p-2">
                <div className="text-lg font-bold text-yellow-600">{pendingCount}</div>
                <div className="text-xs text-muted-foreground">Pendentes</div>
              </div>
              <div className="rounded-lg border p-2">
                <div className="text-lg font-bold text-red-600">{errorCount}</div>
                <div className="text-xs text-muted-foreground">Com erro</div>
              </div>
              <div className="rounded-lg border p-2">
                <div className="text-lg font-bold text-green-600">
                  {offlineSales.filter(s => s.status === 'synced').length}
                </div>
                <div className="text-xs text-muted-foreground">Sincronizadas</div>
              </div>
            </div>

            {/* Sync button */}
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={handleSync}
                disabled={syncing || !isOnline || (pendingCount + errorCount === 0)}
              >
                {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                {syncing ? 'Sincronizando...' : 'Sincronizar agora'}
              </Button>
              {offlineSales.some(s => s.status === 'synced') && (
                <Button variant="outline" onClick={handleClearSynced} size="sm">
                  Limpar
                </Button>
              )}
            </div>

            {!isOnline && (pendingCount + errorCount) > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                As vendas serão sincronizadas automaticamente quando a conexão voltar.
              </p>
            )}

            {/* Sale list */}
            {offlineSales.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Vendas offline</h4>
                {offlineSales
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map(sale => (
                    <div key={sale.id} className="rounded-lg border p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{fc(sale.total)}</span>
                        {getStatusBadge(sale)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(sale.created_at).toLocaleString('pt-BR')} · {sale.items.length} ite{sale.items.length > 1 ? 'ns' : 'm'}
                        {sale.customer_name && ` · ${sale.customer_name}`}
                      </div>
                      {sale.sync_error && (
                        <p className="text-xs text-red-500">{sale.sync_error}</p>
                      )}
                      {sale.synced_sale_id && (
                        <p className="text-xs text-green-600">ID: {sale.synced_sale_id.substring(0, 8)}...</p>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
