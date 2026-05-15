import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Download, FileText, Package } from 'lucide-react';

export default function FiscalEntryDetail() {
  const { id } = useParams<{ id: string }>();
  const { currentAccount } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [entry, setEntry] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [payables, setPayables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id && currentAccount) loadData();
  }, [id, currentAccount]);

  const loadData = async () => {
    setLoading(true);
    const [entryRes, itemsRes, payablesRes] = await Promise.all([
      supabase.from('fiscal_entries').select('*, suppliers(name, cnpj), stores(name)').eq('id', id!).single(),
      supabase.from('fiscal_entry_items').select('*, products(name, sku)').eq('fiscal_entry_id', id!),
      supabase.from('accounts_payable').select('*').eq('notes', `fiscal_entry:${id}`),
    ]);
    setEntry(entryRes.data);
    setItems(itemsRes.data || []);
    setPayables(payablesRes.data || []);
    setLoading(false);
  };

  const downloadStorageFile = async (path: string, filename: string) => {
    try {
      const { data, error } = await supabase.storage.from('fiscal-files').download(path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao baixar arquivo', description: e.message });
    }
  };

  const fc = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '-';

  const statusLabels: Record<string, string> = { draft: 'Rascunho', confirmed: 'Confirmada', canceled: 'Cancelada' };
  const statusColors: Record<string, string> = { draft: 'bg-yellow-500', confirmed: 'bg-green-600', canceled: 'bg-muted' };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!entry) {
    return <div className="flex h-64 items-center justify-center"><p className="text-muted-foreground">Entrada não encontrada</p></div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/app/fiscal-entries')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">Entrada Fiscal</h1>
          <p className="text-sm text-muted-foreground">NF-e {entry.nfe_number}/{entry.nfe_series}</p>
        </div>
        <Badge className={`${statusColors[entry.status] || 'bg-muted'} text-white`}>
          {statusLabels[entry.status] || entry.status}
        </Badge>
      </div>

      {/* Supplier & NF Info */}
      <Card>
        <CardHeader><CardTitle>Dados da NF-e</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Fornecedor:</span>
              <p className="font-medium">{entry.suppliers?.name}</p>
              <p className="text-xs text-muted-foreground">CNPJ: {entry.suppliers?.cnpj}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Loja:</span>
              <p className="font-medium">{entry.stores?.name}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Chave de Acesso:</span>
              <p className="font-mono text-xs break-all">{entry.access_key || '-'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Data Emissão:</span>
              <p className="font-medium">{formatDate(entry.issue_date)}</p>
            </div>
          </div>
          <div className="border-t pt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div><span className="text-muted-foreground">Produtos:</span><p className="font-medium">{fc(entry.total_products)}</p></div>
            <div><span className="text-muted-foreground">Frete:</span><p className="font-medium">{fc(entry.total_freight)}</p></div>
            <div><span className="text-muted-foreground">Desconto:</span><p className="font-medium">{fc(entry.total_discount)}</p></div>
            <div><span className="text-muted-foreground">Total NF:</span><p className="font-bold text-primary">{fc(entry.total_nfe)}</p></div>
          </div>
        </CardContent>
      </Card>

      {/* Files */}
      <Card>
        <CardHeader><CardTitle>Documentos</CardTitle></CardHeader>
        <CardContent className="flex gap-3 flex-wrap">
          {entry.xml_path ? (
            <Button variant="outline" size="sm" onClick={() => downloadStorageFile(entry.xml_path, `nfe-${entry.nfe_number}.xml`)}>
              <Download className="h-3 w-3 mr-1" /> XML
            </Button>
          ) : <span className="text-sm text-muted-foreground">XML não disponível</span>}
          {entry.pdf_path ? (
            <Button variant="outline" size="sm" onClick={() => downloadStorageFile(entry.pdf_path, `danfe-${entry.nfe_number}.pdf`)}>
              <Download className="h-3 w-3 mr-1" /> PDF / DANFE
            </Button>
          ) : <span className="text-sm text-muted-foreground">PDF não anexado</span>}
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader><CardTitle>Itens ({items.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-3 border rounded-lg p-3">
              <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.description}</p>
                <p className="text-xs text-muted-foreground">
                  {item.quantity} {item.unit} × {fc(item.unit_price)} = {fc(item.total_line)}
                </p>
                {item.products && (
                  <p className="text-xs text-green-600">Vinculado: {item.products.name} ({item.products.sku})</p>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Accounts Payable */}
      {payables.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Contas a Pagar</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {payables.map(ap => (
              <div key={ap.id} className="flex items-center justify-between border rounded-lg p-3">
                <div>
                  <p className="text-sm font-medium">{ap.description}</p>
                  <p className="text-xs text-muted-foreground">Vencimento: {formatDate(ap.due_date)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{fc(ap.amount)}</p>
                  <Badge variant={ap.status === 'open' ? 'default' : ap.status === 'canceled' ? 'secondary' : 'outline'} className="text-xs">
                    {ap.status === 'open' ? 'Aberto' : ap.status === 'paid' ? 'Pago' : 'Cancelado'}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {entry.notes && (
        <Card>
          <CardHeader><CardTitle>Observações</CardTitle></CardHeader>
          <CardContent><p className="text-sm">{entry.notes}</p></CardContent>
        </Card>
      )}
    </div>
  );
}
