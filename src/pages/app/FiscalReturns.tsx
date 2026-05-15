import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Undo2, Search, FileText, Download, RefreshCw, Eye } from 'lucide-react';

interface FiscalDoc {
  id: string;
  sale_id: string;
  store_id: string;
  type: string;
  provider_id: string | null;
  nfe_number?: string | null;
  status: string;
  access_key: string | null;
  purpose: string;
  ref_fiscal_document_id: string | null;
  return_note_id: string | null;
  pdf_url: string | null;
  xml_url: string | null;
  created_at: string;
}

export default function FiscalReturns() {
  const { currentAccount, currentStore, isOwnerOrAdmin, stores } = useAuth();
  const { toast } = useToast();

  const [returnDocs, setReturnDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Filters
  const [filterStoreId, setFilterStoreId] = useState<string>('all');

  // Create flow
  const [originalDocs, setOriginalDocs] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<Record<string, { selected: boolean; qty: number }>>({});
  const [isFullReturn, setIsFullReturn] = useState(true);
  const [emitting, setEmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [checkingStatus, setCheckingStatus] = useState<string | null>(null);
  const [keySearchResult, setKeySearchResult] = useState<any | null>(null);
  const [searchingByKey, setSearchingByKey] = useState(false);

  const normalizeDigits = (value: string) => value.replace(/\D/g, '');

  const selectedStoreForLookup = filterStoreId !== 'all'
    ? filterStoreId
    : null;

  useEffect(() => {
    if (currentAccount) loadReturnDocs();
  }, [currentAccount, filterStoreId]);

  useEffect(() => {
    if (!showCreateDialog) {
      setKeySearchResult(null);
      setSearchingByKey(false);
      return;
    }

    const normalizedKey = normalizeDigits(searchQuery);
    if (normalizedKey.length !== 44) {
      setKeySearchResult(null);
      setSearchingByKey(false);
      return;
    }

    let cancelled = false;

    const searchByKey = async () => {
      setSearchingByKey(true);

      try {
        const { data, error } = await supabase.functions.invoke('lookup-fiscal-document-by-key', {
          body: {
            access_key: normalizedKey,
            store_id: selectedStoreForLookup,
          },
        });

        if (cancelled) return;
        if (error) throw error;

        setKeySearchResult(data?.found ? data.document : null);

        if (!data?.found && normalizedKey.length === 44) {
          toast({
            variant: 'destructive',
            title: 'Chave não localizada',
            description: data?.message || 'Não foi possível localizar essa NF-e nas lojas com integração fiscal ativa.',
          });
        }
      } catch (e: any) {
        if (cancelled) return;
        setKeySearchResult(null);
        toast({
          variant: 'destructive',
          title: 'Erro ao buscar chave da NF-e',
          description: e.message || 'Não foi possível consultar a chave informada.',
        });
      } finally {
        if (!cancelled) setSearchingByKey(false);
      }
    };

    searchByKey();

    return () => {
      cancelled = true;
    };
  }, [showCreateDialog, searchQuery, selectedStoreForLookup]);

  const loadReturnDocs = async () => {
    if (!currentAccount) return;
    setLoading(true);

    let query = supabase
      .from('fiscal_documents')
      .select('*')
      .eq('purpose', 'return')
      .order('created_at', { ascending: false });

    // Filter by stores in account - we need to get store IDs first
    const { data: accountStores } = await supabase
      .from('stores')
      .select('id')
      .eq('account_id', currentAccount.id);

    if (!accountStores || accountStores.length === 0) {
      setReturnDocs([]);
      setLoading(false);
      return;
    }

    const storeIds = filterStoreId !== 'all'
      ? [filterStoreId]
      : accountStores.map(s => s.id);

    query = query.in('store_id', storeIds);

    const { data } = await query;
    setReturnDocs(data || []);
    setLoading(false);
  };

  const loadOriginalDocs = async () => {
    if (!currentAccount) return;
    setLoadingDocs(true);

    const { data: accountStores } = await supabase
      .from('stores')
      .select('id')
      .eq('account_id', currentAccount.id);

    if (!accountStores || accountStores.length === 0) {
      setOriginalDocs([]);
      setLoadingDocs(false);
      return;
    }

    const preferredStoreId = filterStoreId !== 'all'
      ? filterStoreId
      : currentStore?.id;

    const storeIds = preferredStoreId ? [preferredStoreId] : accountStores.map(s => s.id);

    const { data } = await supabase
      .from('fiscal_documents')
      .select('id, sale_id, store_id, type, provider_id, nfe_number, status, access_key, purpose, ref_fiscal_document_id, return_note_id, pdf_url, xml_url, created_at, sales(id, total, created_at, customer_id, customers(name, document)), stores(name)')
      .eq('purpose', 'normal')
      .eq('status', 'issued')
      .in('store_id', storeIds)
      .order('created_at', { ascending: false })
      .limit(1000);

    setOriginalDocs(data || []);
    setLoadingDocs(false);
  };

  const selectOriginalDoc = async (doc: any) => {
    setSelectedDoc(doc);

    // Load sale items
    const { data: items } = await supabase
      .from('sale_items')
      .select('*, products(name, sku, unit, ncm)')
      .eq('sale_id', doc.sale_id);

    setSaleItems(items || []);
    const initial: Record<string, { selected: boolean; qty: number }> = {};
    (items || []).forEach((item: any) => {
      initial[item.id] = { selected: true, qty: item.qty };
    });
    setSelectedItems(initial);
    setIsFullReturn(true);
  };

  const toggleItem = (itemId: string) => {
    setSelectedItems(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], selected: !prev[itemId].selected },
    }));
    setIsFullReturn(false);
  };

  const updateReturnQty = (itemId: string, qty: number) => {
    const maxQty = saleItems.find(i => i.id === itemId)?.qty || 1;
    setSelectedItems(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], qty: Math.max(1, Math.min(qty, maxQty)) },
    }));
  };

  const handleSelectAll = (selectAll: boolean) => {
    setIsFullReturn(selectAll);
    const updated: Record<string, { selected: boolean; qty: number }> = {};
    saleItems.forEach(item => {
      updated[item.id] = { selected: selectAll, qty: item.qty };
    });
    setSelectedItems(updated);
  };

  const totalRefund = saleItems
    .filter(i => selectedItems[i.id]?.selected)
    .reduce((sum, i) => sum + selectedItems[i.id].qty * i.unit_price, 0);

  const handleEmitReturn = async () => {
    if (!selectedDoc) return;
    const items = saleItems
      .filter(i => selectedItems[i.id]?.selected)
      .map(i => ({
        product_id: i.product_id,
        qty: selectedItems[i.id].qty,
        unit_price: i.unit_price,
      }));

    if (items.length === 0) {
      toast({ variant: 'destructive', title: 'Selecione ao menos um item para devolver' });
      return;
    }

    setEmitting(true);
    try {
      // Step 1: Ensure access_key is populated by checking status first
      if (!selectedDoc.access_key) {
        toast({ title: 'Buscando chave de acesso da NF-e original...' });
        const { data: statusData, error: statusError } = await supabase.functions.invoke('check-fiscal-status', {
          body: { fiscal_document_id: selectedDoc.id },
        });
        if (statusError) throw new Error('Erro ao buscar status da NF-e original');
        if (statusData?.access_key) {
          setSelectedDoc((prev: any) => ({ ...prev, access_key: statusData.access_key }));
        }
      }

      // Step 2: Emit return
      const { data, error } = await supabase.functions.invoke('emit-fiscal-return', {
        body: {
          fiscal_document_id: selectedDoc.id,
          items,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: 'NF-e de devolução emitida!',
        description: 'Documento enviado para processamento na SEFAZ.',
      });
      setShowCreateDialog(false);
      resetForm();
      loadReturnDocs();
    } catch (e: any) {
      const msg = e.message || 'Erro desconhecido';
      toast({ variant: 'destructive', title: 'Erro ao emitir devolução', description: msg });
    } finally {
      setEmitting(false);
    }
  };

  const checkStatus = async (docId: string) => {
    setCheckingStatus(docId);
    try {
      const { data, error } = await supabase.functions.invoke('check-fiscal-status', {
        body: { fiscal_document_id: docId },
      });
      if (error) throw error;
      const isError = data.status === 'error' || data.status === 'denied';
      toast({
        variant: isError ? 'destructive' : 'default',
        title: `Status: ${data.status_label}`,
        description: data.error_message || (data.pdf_url ? 'PDF disponível' : 'Aguardando SEFAZ'),
      });
      loadReturnDocs();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
      setCheckingStatus(null);
    }
  };

  const downloadFile = async (docId: string, format: 'pdf' | 'xml') => {
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) { toast({ variant: 'destructive', title: 'Sessão expirada' }); return; }

      const url = `https://${projectId}.supabase.co/functions/v1/download-fiscal-file?doc_id=${docId}&format=${format}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      if (!response.ok) throw new Error(`Erro ${response.status}`);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `documento-${docId.substring(0, 8)}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (e: any) {
      toast({ variant: 'destructive', title: `Erro ao baixar ${format.toUpperCase()}`, description: e.message });
    }
  };

  const resetForm = () => {
    setSelectedDoc(null);
    setSaleItems([]);
    setSelectedItems({});
    setSearchQuery('');
    setIsFullReturn(true);
    setKeySearchResult(null);
    setSearchingByKey(false);
  };

  const fc = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  const formatDate = (d: string) => new Date(d).toLocaleString('pt-BR');

  const statusLabels: Record<string, string> = {
    processing: 'Processando', issued: 'Autorizada', cancelled: 'Cancelada',
    denied: 'Rejeitada', error: 'Erro', normal: 'Normal',
  };
  const statusColors: Record<string, string> = {
    processing: 'bg-yellow-500', issued: 'bg-green-600', cancelled: 'bg-muted',
    denied: 'bg-destructive', error: 'bg-destructive',
  };

  const searchableOriginalDocs = keySearchResult && !originalDocs.some(doc => doc.id === keySearchResult.id)
    ? [keySearchResult, ...originalDocs]
    : originalDocs;

  const filteredOriginalDocs = searchableOriginalDocs.filter(doc => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const qDigits = normalizeDigits(searchQuery);
    const customerName = (doc.sales?.customers?.name || '').toLowerCase();
    const customerDocument = normalizeDigits(doc.sales?.customers?.document || '');
    const accessKey = normalizeDigits(doc.access_key || '');
    const providerId = (doc.provider_id || '').toLowerCase();
    const nfeNumber = String(doc.nfe_number || '').toLowerCase();
    const saleOrderNumber = String(doc.sales?.sale_number || '').toLowerCase();

    return customerName.includes(q)
      || (!!qDigits && accessKey.includes(qDigits))
      || (!!qDigits && customerDocument.includes(qDigits))
      || (!!qDigits && nfeNumber.includes(qDigits))
      || (!!qDigits && saleOrderNumber.includes(qDigits))
      || providerId.includes(q)
      || doc.id.toLowerCase().includes(q);
  });

  if (!isOwnerOrAdmin) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">Acesso restrito a administradores</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">NF-e de Devolução</h1>
          <p className="text-sm text-muted-foreground">Emita notas fiscais de devolução referenciando NF-e originais</p>
        </div>
        <Button onClick={() => { resetForm(); setShowCreateDialog(true); loadOriginalDocs(); }}>
          <Plus className="mr-2 h-4 w-4" /> Nova Devolução Fiscal
        </Button>
      </div>

      {/* Filters */}
      {stores.length > 1 && (
        <div className="flex gap-3">
          <Select value={filterStoreId} onValueChange={setFilterStoreId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtrar por loja" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as lojas</SelectItem>
              {stores.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* List */}
      {returnDocs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Nenhuma NF-e de devolução emitida.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {returnDocs.map(doc => (
            <Card key={doc.id}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Undo2 className="h-4 w-4 text-orange-500" />
                      <span className="font-medium">NF-e Devolução</span>
                      <Badge className={`${statusColors[doc.status] || 'bg-muted'} text-white text-xs`}>
                        {statusLabels[doc.status] || doc.status}
                      </Badge>
                      <Badge variant="outline" className="text-xs">{doc.type?.toUpperCase()}</Badge>
                    </div>
                    {doc.access_key && (
                      <p className="text-xs text-muted-foreground font-mono break-all">
                        Chave: {doc.access_key}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">{formatDate(doc.created_at)}</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline" size="sm"
                      onClick={() => checkStatus(doc.id)}
                      disabled={checkingStatus === doc.id}
                    >
                      {checkingStatus === doc.id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <RefreshCw className="h-3 w-3" />}
                      <span className="ml-1 hidden sm:inline">Status</span>
                    </Button>
                    {doc.status === 'issued' && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => downloadFile(doc.id, 'pdf')}>
                          <Download className="h-3 w-3" />
                          <span className="ml-1">PDF</span>
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => downloadFile(doc.id, 'xml')}>
                          <Download className="h-3 w-3" />
                          <span className="ml-1">XML</span>
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Return Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova NF-e de Devolução</DialogTitle>
            <DialogDescription>Selecione a NF-e original e os itens a devolver.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!selectedDoc ? (
              <>
                {/* Search and select original NF-e */}
                <div className="space-y-2">
                  <Label>Buscar NF-e original</Label>
                  <Input
                    placeholder="Cliente, CPF/CNPJ, número da NF, chave de acesso ou ID..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="mb-2"
                  />
                  {searchingByKey && normalizeDigits(searchQuery).length === 44 && (
                    <p className="text-xs text-muted-foreground">Consultando a chave no backend fiscal...</p>
                  )}
                  {keySearchResult?.lookup_message && (
                    <p className="text-xs text-muted-foreground">{keySearchResult.lookup_message}</p>
                  )}
                </div>

                {loadingDocs ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : filteredOriginalDocs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma NF-e autorizada encontrada.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {filteredOriginalDocs.map(doc => (
                      <button
                        key={doc.id}
                        className="w-full text-left border rounded-lg p-3 hover:bg-accent/50 transition-colors"
                        onClick={() => {
                          if (doc.can_emit_return === false) {
                            toast({
                              variant: 'destructive',
                              title: 'Nota sem vínculo local',
                              description: doc.lookup_message || 'A chave foi localizada, mas essa nota ainda não está vinculada a uma venda local para devolução automática.',
                            });
                            return;
                          }

                          selectOriginalDoc(doc);
                        }}
                      >
                        <div className="flex justify-between items-start">
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium truncate">
                                {doc.sales?.customers?.name || doc.remote_party_name || 'Sem cliente'}
                              </p>
                              {doc.source === 'remote' && (
                                <Badge variant="secondary" className="text-[10px]">SEFAZ</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {doc.type?.toUpperCase()} • {doc.stores?.name} • {formatDate(doc.created_at)}
                            </p>
                            {doc.nfe_number && (
                              <p className="text-[11px] text-muted-foreground">
                                NF nº {doc.nfe_number}
                              </p>
                            )}
                            {doc.access_key && (
                              <p className="text-[10px] text-muted-foreground font-mono truncate">
                                {doc.access_key}
                              </p>
                            )}
                          </div>
                          <span className="text-sm font-medium ml-2 whitespace-nowrap">
                            {fc(doc.sales?.total || 0)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Selected doc info */}
                <div className="border rounded-lg p-3 bg-muted/50">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium">
                        NF-e original: {selectedDoc.type?.toUpperCase()}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {selectedDoc.sales?.customers?.name || 'Sem cliente'} • {formatDate(selectedDoc.created_at)}
                      </p>
                      {selectedDoc.nfe_number && (
                        <p className="text-xs text-muted-foreground">NF nº {selectedDoc.nfe_number}</p>
                      )}
                      <p className="text-xs text-muted-foreground">Loja: {selectedDoc.stores?.name || '-'}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedDoc(null); setSaleItems([]); }}>
                      Trocar
                    </Button>
                  </div>
                </div>

                {/* Return type */}
                <div className="flex gap-3">
                  <Button
                    variant={isFullReturn ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleSelectAll(true)}
                  >
                    Devolução Total
                  </Button>
                  <Button
                    variant={!isFullReturn ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleSelectAll(false)}
                  >
                    Devolução Parcial
                  </Button>
                </div>

                {/* Items */}
                <div className="space-y-2">
                  <Label>Itens para devolver</Label>
                  {saleItems.map(item => (
                    <div key={item.id} className="flex items-center gap-3 border rounded-lg p-3">
                      <Checkbox
                        checked={selectedItems[item.id]?.selected || false}
                        onCheckedChange={() => toggleItem(item.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.products?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.qty} {item.products?.unit} × {fc(item.unit_price)}
                        </p>
                      </div>
                      {selectedItems[item.id]?.selected && (
                        <div className="flex items-center gap-1">
                          <Label className="text-xs">Qtd:</Label>
                          <Input
                            type="number"
                            min={1}
                            max={item.qty}
                            value={selectedItems[item.id]?.qty || 1}
                            onChange={e => updateReturnQty(item.id, Number(e.target.value))}
                            className="w-16 h-8 text-sm"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Total */}
                <div className="border-t pt-3">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total da devolução</span>
                    <span className="text-orange-600">{fc(totalRefund)}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
            {selectedDoc && (
              <Button onClick={handleEmitReturn} disabled={emitting}>
                {emitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                Emitir NF-e Devolução
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
