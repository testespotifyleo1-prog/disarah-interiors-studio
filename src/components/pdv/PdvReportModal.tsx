import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Download, Loader2 } from 'lucide-react';
import { generateDailyReportPDF } from '@/utils/generateDailyReport';
import { useToast } from '@/hooks/use-toast';

const fc = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

interface PdvReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  storeName: string;
  accountId: string;
  userId: string;
  userRole: string;
  cashRegister: any;
}

interface SaleSummary {
  totalSales: number;
  totalRevenue: number;
  totalCash: number;
  totalCard: number;
  totalPix: number;
  totalCrediario: number;
  totalFinanceira: number;
  totalStoreCredit: number;
  sales: { id: string; order_number: number | null; total: number; created_at: string; sellerName: string }[];
}

export default function PdvReportModal({ open, onOpenChange, storeId, storeName, accountId, userId, userRole, cashRegister }: PdvReportModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<SaleSummary | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const isAdmin = ['owner', 'admin', 'manager'].includes(userRole);
  const openedAt = cashRegister?.opened_at;

  useEffect(() => {
    if (!open || !openedAt) return;
    loadReport();
  }, [open, openedAt]);

  const loadReport = async () => {
    setLoading(true);
    try {
      // Fetch sales for this register period
      let query = supabase
        .from('sales')
        .select('id, order_number, total, seller_user_id, created_at')
        .eq('store_id', storeId)
        .eq('status', 'paid')
        .gte('created_at', openedAt)
        .order('created_at', { ascending: true });

      if (!isAdmin) {
        query = query.eq('seller_user_id', userId);
      }

      const { data: sales } = await query;
      if (!sales || sales.length === 0) {
        setSummary({ totalSales: 0, totalRevenue: 0, totalCash: 0, totalCard: 0, totalPix: 0, totalCrediario: 0, totalFinanceira: 0, totalStoreCredit: 0, sales: [] });
        setLoading(false);
        return;
      }

      const saleIds = sales.map(s => s.id);

      // Fetch payments in chunks
      const allPayments: any[] = [];
      for (let i = 0; i < saleIds.length; i += 50) {
        const chunk = saleIds.slice(i, i + 50);
        const { data: payments } = await supabase.from('payments').select('sale_id, method, paid_value').in('sale_id', chunk);
        if (payments) allPayments.push(...payments);
      }

      // Get unique seller IDs for names
      const sellerIds = [...new Set(sales.map(s => s.seller_user_id))];
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', sellerIds);
      const profileMap: Record<string, string> = {};
      profiles?.forEach(p => { profileMap[p.user_id] = p.full_name || 'Vendedor'; });

      let totalCash = 0, totalCard = 0, totalPix = 0, totalCrediario = 0, totalFinanceira = 0, totalStoreCredit = 0;
      allPayments.forEach(p => {
        if (p.method === 'cash') totalCash += p.paid_value;
        else if (p.method === 'card') totalCard += p.paid_value;
        else if (p.method === 'pix') totalPix += p.paid_value;
        else if (p.method === 'crediario') totalCrediario += p.paid_value;
        else if (p.method === 'financeira') totalFinanceira += p.paid_value;
        else if (p.method === 'store_credit') totalStoreCredit += p.paid_value;
      });

      setSummary({
        totalSales: sales.length,
        totalRevenue: sales.reduce((s, sale) => s + sale.total, 0),
        totalCash, totalCard, totalPix, totalCrediario, totalFinanceira, totalStoreCredit,
        sales: sales.map(s => ({
          id: s.id,
          order_number: s.order_number,
          total: s.total,
          created_at: s.created_at,
          sellerName: profileMap[s.seller_user_id] || 'Vendedor',
        })),
      });
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao carregar relatório' });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!cashRegister || !summary) return;
    setGeneratingPdf(true);
    try {
      await generateDailyReportPDF({
        storeName,
        storeId,
        accountId,
        register: cashRegister,
        summary: {
          totalSales: summary.totalSales,
          totalRevenue: summary.totalRevenue,
          totalCash: summary.totalCash,
          totalCard: summary.totalCard,
          totalPix: summary.totalPix,
          totalCrediario: summary.totalCrediario,
          totalFinanceira: summary.totalFinanceira,
          avgTicket: summary.totalSales > 0 ? summary.totalRevenue / summary.totalSales : 0,
          totalSangria: 0,
          totalReforco: 0,
        },
        expectedCash: (cashRegister.opening_amount || 0) + summary.totalCash,
      });
      toast({ title: 'PDF gerado com sucesso' });
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao gerar PDF' });
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> Relatório do Caixa
          </DialogTitle>
          <DialogDescription>
            {isAdmin ? 'Consolidado de todas as vendas do caixa' : 'Suas vendas neste caixa'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !summary ? (
          <p className="text-center text-sm text-muted-foreground py-6">Nenhum dado disponível</p>
        ) : (
          <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Vendas</p>
                <p className="text-xl font-bold">{summary.totalSales}</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Faturamento</p>
                <p className="text-xl font-bold text-primary">{fc(summary.totalRevenue)}</p>
              </div>
            </div>

            {/* Payment breakdown */}
            <div className="rounded-lg border p-3 space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Por método</p>
              {[
                { label: 'Dinheiro', value: summary.totalCash },
                { label: 'Cartão', value: summary.totalCard },
                { label: 'PIX', value: summary.totalPix },
                { label: 'Crediário', value: summary.totalCrediario },
                { label: 'Financeira', value: summary.totalFinanceira },
                { label: 'Crédito Loja', value: summary.totalStoreCredit },
              ].filter(r => r.value > 0).map(r => (
                <div key={r.label} className="flex items-center justify-between text-sm">
                  <span>{r.label}</span>
                  <span className="font-semibold">{fc(r.value)}</span>
                </div>
              ))}
              {summary.totalRevenue === 0 && <p className="text-xs text-muted-foreground text-center">Nenhuma venda ainda</p>}
            </div>

            {/* Sales list */}
            {summary.sales.length > 0 && (
              <div className="rounded-lg border p-3 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Vendas ({summary.sales.length})</p>
                <div className="max-h-40 overflow-auto space-y-1">
                  {summary.sales.map(s => (
                    <div key={s.id} className="flex items-center justify-between text-xs py-1 border-b border-dashed last:border-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">#{s.order_number || '—'}</Badge>
                        <span className="text-muted-foreground">
                          {new Date(s.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isAdmin && <span className="text-muted-foreground truncate max-w-[100px]">{s.sellerName}</span>}
                      </div>
                      <span className="font-semibold">{fc(s.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Download PDF - admin only */}
            {isAdmin && (
              <Button className="w-full" variant="outline" onClick={handleDownloadPdf} disabled={generatingPdf}>
                {generatingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Baixar Relatório Completo (PDF)
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
