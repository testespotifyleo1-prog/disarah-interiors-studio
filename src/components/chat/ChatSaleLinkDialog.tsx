import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Link2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  open: boolean;
  onClose: () => void;
  accountId: string;
  storeId: string;
  onLink: (saleId: string) => void;
}

interface SaleResult {
  id: string;
  order_number: number | null;
  total: number;
  status: string;
  created_at: string;
  customers: { name: string } | null;
}

export default function ChatSaleLinkDialog({ open, onClose, accountId, storeId, onLink }: Props) {
  const [search, setSearch] = useState('');
  const [sales, setSales] = useState<SaleResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) searchSales();
  }, [open]);

  const searchSales = async () => {
    setLoading(true);
    let query = supabase
      .from('sales')
      .select('id, order_number, total, status, created_at, customers(name)')
      .eq('account_id', accountId)
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (search.trim()) {
      const num = parseInt(search);
      if (!isNaN(num)) {
        query = query.eq('order_number', num);
      }
    }

    const { data } = await query;
    setSales((data || []) as unknown as SaleResult[]);
    setLoading(false);
  };

  const statusLabel: Record<string, string> = {
    draft: 'Rascunho', open: 'Aberta', paid: 'Paga', canceled: 'Cancelada',
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Vincular venda à conversa</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nº do pedido..."
              className="pl-9"
              onKeyDown={e => e.key === 'Enter' && searchSales()}
            />
          </div>
          <Button onClick={searchSales} variant="outline" size="sm">Buscar</Button>
        </div>
        <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
          {sales.map(sale => (
            <div key={sale.id} className="flex items-center justify-between p-2 border rounded hover:bg-accent/50 transition-colors">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">#{sale.order_number}</span>
                  <Badge variant="outline" className="text-[10px]">{statusLabel[sale.status] || sale.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {sale.customers?.name || 'Sem cliente'} · R$ {sale.total.toFixed(2).replace('.', ',')}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {format(new Date(sale.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => { onLink(sale.id); onClose(); }}>
                <Link2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {sales.length === 0 && !loading && (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhuma venda encontrada</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
