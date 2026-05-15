import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, CheckCircle, XCircle, FileDown, ShoppingCart, Send, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { logActivity } from '@/utils/activityLog';
import { generateQuotePDF } from '@/utils/generateQuotePDF';

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Rascunho', variant: 'secondary' },
  sent: { label: 'Enviado', variant: 'outline' },
  approved: { label: 'Aprovado', variant: 'default' },
  rejected: { label: 'Recusado', variant: 'destructive' },
  expired: { label: 'Vencido', variant: 'destructive' },
  converted: { label: 'Convertido em Venda', variant: 'default' },
};

export default function QuoteDetail() {
  const { id } = useParams();
  const { user, currentAccount, stores, canEdit } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [quote, setQuote] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  useEffect(() => { if (id) loadQuote(); }, [id]);

  const loadQuote = async () => {
    setLoading(true);
    const [{ data: q }, { data: itms }] = await Promise.all([
      supabase.from('quotes').select('*, customers(name, phone, document, address_json), stores(name, cnpj, ie, phone, address_json, logo_path, logo_updated_at)').eq('id', id!).maybeSingle(),
      supabase.from('quote_items').select('*, products(name, sku, unit)').eq('quote_id', id!),
    ]);
    setQuote(q);
    setItems(itms || []);
    setLoading(false);
  };

  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const updateStatus = async (newStatus: string, extra: Record<string, any> = {}) => {
    setActing(true);
    try {
      const { error } = await supabase.from('quotes').update({ status: newStatus, ...extra }).eq('id', id!);
      if (error) throw error;
      await logActivity({ accountId: currentAccount!.id, userId: user!.id, userName: user!.email, action: 'update', entityType: 'quote', entityId: id, details: { status: newStatus } });
      toast({ title: `Orçamento ${STATUS_MAP[newStatus]?.label || newStatus}!` });
      loadQuote();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally { setActing(false); }
  };

  const convertToSale = async () => {
    setActing(true);
    try {
      // Create sale from quote
      const { data: sale, error: se } = await supabase.from('sales').insert({
        account_id: currentAccount!.id,
        store_id: quote.store_id,
        seller_id: quote.seller_id,
        customer_id: quote.customer_id,
        status: 'draft',
        subtotal: quote.subtotal,
        discount: quote.discount,
        delivery_fee: quote.delivery_fee,
        total: quote.total,
        notes: `Convertido do Orçamento #${quote.quote_number}${quote.notes ? `. ${quote.notes}` : ''}`,
      }).select().single();
      if (se) throw se;

      // Create sale items from quote items
      const saleItems = items.map(i => ({
        sale_id: sale.id,
        product_id: i.product_id,
        qty: i.qty,
        unit_price: i.unit_price,
        unit_cost: 0,
        total_line: i.total_line,
      }));
      const { error: ie } = await supabase.from('sale_items').insert(saleItems);
      if (ie) throw ie;

      // Mark quote as converted
      await supabase.from('quotes').update({
        status: 'converted',
        converted_sale_id: sale.id,
        converted_at: new Date().toISOString(),
      }).eq('id', id!);

      await logActivity({ accountId: currentAccount!.id, userId: user!.id, userName: user!.email, action: 'create', entityType: 'sale', entityId: sale.id, details: { origem: `orcamento_${quote.quote_number}` } });
      toast({ title: `Venda criada a partir do orçamento!` });
      navigate(`/app/sales/${sale.id}`);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally { setActing(false); }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!quote) return <div className="text-center py-12 text-muted-foreground">Orçamento não encontrado.</div>;

  const canSend = quote.status === 'draft';
  const canApprove = quote.status === 'sent' && canEdit;
  const canReject = ['sent', 'approved'].includes(quote.status) && canEdit;
  const canConvert = quote.status === 'approved';

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/app/quotes')}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold">Orçamento #{quote.quote_number}</h1>
            <Badge variant={STATUS_MAP[quote.status]?.variant}>{STATUS_MAP[quote.status]?.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{format(new Date(quote.created_at), 'dd/MM/yyyy HH:mm')}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Cliente</CardTitle></CardHeader>
          <CardContent><p className="font-medium">{quote.customers?.name || 'Consumidor Final'}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Loja</CardTitle></CardHeader>
          <CardContent><p className="font-medium">{quote.stores?.name}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total</CardTitle></CardHeader>
          <CardContent><p className="font-bold text-lg">{formatCurrency(quote.total)}</p></CardContent>
        </Card>
      </div>

      {quote.valid_until && (
        <Card>
          <CardContent className="py-3">
            <p className="text-sm">Válido até: <span className="font-medium">{format(new Date(quote.valid_until + 'T12:00:00'), 'dd/MM/yyyy')}</span></p>
          </CardContent>
        </Card>
      )}

      {quote.notes && (
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Observações</CardTitle></CardHeader>
        <CardContent><p className="text-sm">{quote.notes}</p></CardContent></Card>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Itens</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Preço Unit.</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, idx) => (
                <TableRow key={item.id}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell>{item.products?.name}</TableCell>
                  <TableCell className="text-right">{item.qty}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.total_line)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="text-right pt-3 border-t mt-3 space-y-1">
            <p className="text-sm">Subtotal: {formatCurrency(quote.subtotal)}</p>
            {quote.discount > 0 && <p className="text-sm text-destructive">Desconto: -{formatCurrency(quote.discount)}</p>}
            {quote.delivery_fee > 0 && <p className="text-sm">Entrega: +{formatCurrency(quote.delivery_fee)}</p>}
            <p className="font-bold text-lg">Total: {formatCurrency(quote.total)}</p>
          </div>
        </CardContent>
      </Card>

      {quote.converted_sale_id && (
        <Card>
          <CardContent className="py-3 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-primary" />
            <span className="text-sm">Convertido em venda</span>
            <Button size="sm" variant="link" onClick={() => navigate(`/app/sales/${quote.converted_sale_id}`)}>Ver venda →</Button>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => generateQuotePDF(quote, items)}>
          <FileDown className="mr-1 h-4 w-4" /> PDF
        </Button>
        {canSend && <Button size="sm" onClick={() => updateStatus('sent')} disabled={acting}><Send className="mr-1 h-4 w-4" /> Enviar</Button>}
        {canApprove && <Button size="sm" onClick={() => updateStatus('approved')} disabled={acting}><CheckCircle className="mr-1 h-4 w-4" /> Aprovar</Button>}
        {canConvert && <Button size="sm" onClick={convertToSale} disabled={acting}><ShoppingCart className="mr-1 h-4 w-4" /> Converter em Venda</Button>}
        {canReject && <Button size="sm" variant="destructive" onClick={() => updateStatus('rejected')} disabled={acting}><XCircle className="mr-1 h-4 w-4" /> Recusar</Button>}
      </div>
    </div>
  );
}
