import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Props { storeId?: string }

export function ContingencyBadge({ storeId }: Props) {
  const [count, setCount] = useState(0);
  const [retrying, setRetrying] = useState(false);

  const load = async () => {
    if (!storeId) { setCount(0); return; }
    const { count: c } = await supabase
      .from('fiscal_documents')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .eq('contingency_mode', true)
      .neq('status', 'issued')
      .neq('status', 'cancelled');
    setCount(c || 0);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000); // poll every 30s
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const retryNow = async () => {
    setRetrying(true);
    try {
      const { data, error } = await supabase.functions.invoke('retry-contingency-nfces', { body: {} });
      if (error) throw error;
      const r = data as any;
      toast.success(`Reenvio: ${r.resolved || 0} autorizadas de ${r.processed || 0}`);
      load();
    } catch (e: any) {
      toast.error(e.message || 'Erro no reenvio');
    } finally { setRetrying(false); }
  };

  if (count === 0) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            <Badge variant="destructive" className="gap-1.5 animate-pulse">
              <AlertTriangle className="h-3 w-3" />
              MODO CONTINGÊNCIA · {count} pendente{count > 1 ? 's' : ''}
            </Badge>
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={retryNow} disabled={retrying}>
              <RefreshCw className={`h-3 w-3 ${retrying ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs max-w-xs">
            {count} NFC-e(s) emitida(s) em contingência aguardando reenvio à SEFAZ.
            O sistema reenvia automaticamente a cada 5 min.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
