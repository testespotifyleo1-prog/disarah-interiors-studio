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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Undo2, Package, FileText, Search } from 'lucide-react';

export default function SupplierReturns() {
  const { currentAccount, currentStore, isOwnerOrAdmin, stores } = useAuth();
  const { toast } = useToast();

  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);

  // Create flow
  const [entries, setEntries] = useState<any[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [entryItems, setEntryItems] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<Record<string, { selected: boolean; qty: number }>>({});
  const [notes, setNotes] = useState('');
  const [emitting, setEmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStoreId, setFilterStoreId] = useState<string>('all');
  const [lookingUpKey, setLookingUpKey] = useState(false);

  useEffect(() => {
    if (currentAccount) loadReturns();
  }, [currentAccount, filterStoreId]);

  const loadReturns = async () => {
    if (!currentAccount) return;
    setLoading(true);

    const { data: accountStores } = await supabase
      .from('stores')
      .select('id')
      .eq('account_id', currentAccount.id);

    if (!accountStores || accountStores.length === 0) {
      setReturns([]);
      setLoading(false);
      return;
    }

    const storeIds = filterStoreId !== 'all'
      ? [filterStoreId]
      : accountStores.map(s => s.id);

    const { data } = await supabase
      .from('supplier_returns')
      .select('*, stores(name), suppliers(name, cnpj), fiscal_entries(nfe_number, nfe_series, access_key)')
      .in('store_id', storeIds)
      .eq('account_id', currentAccount.id)
      .order('created_at', { ascending: false });

    setReturns(data || []);
    setLoading(false);
  };

  const loadEntries = async () => {
    if (!currentAccount) return;
    setLoadingEntries(true);

    const { data: accountStores } = await supabase
      .from('stores')
      .select('id')
      .eq('account_id', currentAccount.id);

    if (!accountStores || accountStores.length === 0) {
      setEntries([]);
      setLoadingEntries(false);
      return;
    }

    const storeIds = filterStoreId !== 'all'
      ? [filterStoreId]
      : currentStore
        ? [currentStore.id]
        : accountStores.map(s => s.id);

    const { data } = await supabase
      .from('fiscal_entries')
      .select('*, suppliers(name, cnpj), stores(name)')
      .eq('status', 'confirmed')
      .eq('account_id', currentAccount.id)
      .in('store_id', storeIds)
      .order('created_at', { ascending: false })
      .limit(500);

    setEntries(data || []);
    setLoadingEntries(false);
  };

  const selectEntry = async (entry: any) => {
    setSelectedEntry(entry);

    const { data: items } = await supabase
      .from('fiscal_entry_items')
      .select('*, products(name, sku, unit)')
      .eq('fiscal_entry_id', entry.id);

    setEntryItems(items || []);
    const initial: Record<string, { selected: boolean; qty: number }> = {};
    (items || []).forEach((item: any) => {
      initial[item.id] = { selected: true, qty: item.quantity };
    });
    setSelectedItems(initial);
  };

  const toggleItem = (itemId: string) => {
    setSelectedItems(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], selected: !prev[itemId].selected },
    }));
  };

  const updateQty = (itemId: string, qty: number) => {
    const maxQty = entryItems.find(i => i.id === itemId)?.quantity || 1;
    setSelectedItems(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], qty: Math.max(1, Math.min(qty, maxQty)) },
    }));
  };

  const totalReturn = entryItems
    .filter(i => selectedItems[i.id]?.selected)
    .reduce((sum, i) => sum + selectedItems[i.id].qty * i.unit_price, 0);

  const handleEmit = async () => {
    if (!selectedEntry || !currentAccount) return;

    const items = entryItems
      .filter(i => selectedItems[i.id]?.selected)
      .map(i => ({
        fiscal_entry_item_id: i.id,
        product_id: i.product_id,
        qty: selectedItems[i.id].qty,
        unit_price: i.unit_price,
        total_line: Number((selectedItems[i.id].qty * i.unit_price).toFixed(2)),
      }));

    if (items.length === 0) {
      toast({ variant: 'destructive', title: 'Selecione ao menos um item para devolver' });
      return;
    }

    setEmitting(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error('Sessão expirada');

      // 1. Create supplier_return record
      const { data: sr, error: srError } = await supabase
        .from('supplier_returns')
        .insert({
          account_id: currentAccount.id,
          store_id: selectedEntry.store_id,
          fiscal_entry_id: selectedEntry.id,
          supplier_id: selectedEntry.supplier_id,
          status: 'draft',
          total_return: Number(totalReturn.toFixed(2)),
          notes: notes || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (srError) throw new Error('Erro ao criar devolução: ' + srError.message);

      // 2. Insert items
      const { error: itemsError } = await supabase
        .from('supplier_return_items')
        .insert(items.map(i => ({
          supplier_return_id: sr.id,
          fiscal_entry_item_id: i.fiscal_entry_item_id,
          product_id: i.product_id,
          qty: i.qty,
          unit_price: i.unit_price,
          total_line: i.total_line,
        })));

      if (itemsError) throw new Error('Erro ao inserir itens: ' + itemsError.message);

      // 3. Emit fiscal document
      const { data: emitData, error: emitError } = await supabase.functions.invoke('emit-supplier-return', {
        body: { supplier_return_id: sr.id },
      });

      if (emitError) throw emitError;
      if (emitData?.error) throw new Error(emitData.error);

      toast({
        title: 'Devolução ao fornecedor emitida!',
        description: emitData?.message || 'NF-e enviada para processamento.',
      });

      setShowDialog(false);
      resetForm();
      loadReturns();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
      setEmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedEntry(null);
    setEntryItems([]);
    setSelectedItems({});
    setNotes('');
    setSearchQuery('');
  };

  const fc = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  const formatDate = (d: string) => new Date(d).toLocaleString('pt-BR');

  const statusLabels: Record<string, string> = {
    draft: 'Rascunho', processing: 'Processando', completed: 'Concluída', canceled: 'Cancelada',
  };
  const statusColors: Record<string, string> = {
    draft: 'bg-yellow-500', processing: 'bg-blue-500', completed: 'bg-green-600', canceled: 'bg-muted',
  };

  const filteredEntries = entries.filter(e => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (e.suppliers?.name || '').toLowerCase().includes(q)
      || (e.nfe_number || '').includes(q)
      || (e.access_key || '').includes(q);
  });

  const isAccessKey = (q: string) => q.replace(/\D/g, '').length === 44;

  const handleLookupByKey = async () => {
    const key = searchQuery.replace(/\D/g, '');
    if (key.length !== 44) {
      toast({ variant: 'destructive', title: 'Chave inválida', description: 'A chave de acesso deve ter 44 dígitos.' });
      return;
    }

    setLookingUpKey(true);
    try {
      const { data, error } = await supabase.functions.invoke('lookup-received-nfe', {
        body: {
          access_key: key,
          store_id: filterStoreId !== 'all' ? filterStoreId : (currentStore?.id || null),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.found) {
        toast({ title: 'NF-e encontrada!', description: data.message });
        // Reload entries so it appears in the list
        await loadEntries();
        // If we have entry_id and it's confirmed, auto-select it
        if (data.entry_id && data.entry_status === 'confirmed') {
          const { data: entry } = await supabase
            .from('fiscal_entries')
            .select('*, suppliers(name, cnpj), stores(name)')
            .eq('id', data.entry_id)
            .single();
          if (entry) {
            selectEntry(entry);
          }
        }
      } else {
        toast({ variant: 'destructive', title: 'Não encontrada', description: data?.message || 'NF-e não localizada.' });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro na busca', description: e.message });
    } finally {
      setLookingUpKey(false);
    }
  };

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
          <h1 className="text-2xl font-bold text-foreground">Devolução ao Fornecedor</h1>
          <p className="text-sm text-muted-foreground">Devolva mercadorias referenciando notas de entrada (compra)</p>
        </div>
        <Button onClick={() => { resetForm(); setShowDialog(true); loadEntries(); }}>
          <Plus className="mr-2 h-4 w-4" /> Nova Devolução
        </Button>
      </div>

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
      {returns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Undo2 className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Nenhuma devolução ao fornecedor realizada.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {returns.map(sr => (
            <Card key={sr.id}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Undo2 className="h-4 w-4 text-orange-500" />
                      <span className="font-medium">Devolução ao Fornecedor</span>
                      <Badge className={`${statusColors[sr.status] || 'bg-muted'} text-white text-xs`}>
                        {statusLabels[sr.status] || sr.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Fornecedor: {sr.suppliers?.name || '-'} • Loja: {sr.stores?.name || '-'}
                    </p>
                    {sr.fiscal_entries?.nfe_number && (
                      <p className="text-xs text-muted-foreground">
                        NF-e Entrada: {sr.fiscal_entries.nfe_number}/{sr.fiscal_entries.nfe_series || '1'}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">{formatDate(sr.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary">{fc(sr.total_return)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Devolução ao Fornecedor</DialogTitle>
            <DialogDescription>
              Selecione uma nota de entrada e os itens a devolver
            </DialogDescription>
          </DialogHeader>

          {!selectedEntry ? (
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por fornecedor, nº NF-e ou chave de acesso (44 dígitos)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                {isAccessKey(searchQuery) && (
                  <Button onClick={handleLookupByKey} disabled={lookingUpKey} variant="secondary">
                    {lookingUpKey ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                    Buscar Chave
                  </Button>
                )}
              </div>

              {isAccessKey(searchQuery) && filteredEntries.length === 0 && !lookingUpKey && (
                <div className="text-center py-4 border rounded-lg bg-accent/30">
                  <p className="text-sm text-muted-foreground mb-2">
                    Chave de acesso detectada mas não encontrada localmente.
                  </p>
                  <Button onClick={handleLookupByKey} disabled={lookingUpKey} size="sm">
                    {lookingUpKey ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                    Buscar no provedor fiscal
                  </Button>
                </div>
              )}

              {loadingEntries ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : filteredEntries.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma nota de entrada confirmada encontrada.
                </p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredEntries.map(entry => (
                    <div
                      key={entry.id}
                      className="border rounded-lg p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => selectEntry(entry)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{entry.suppliers?.name || 'Fornecedor não identificado'}</p>
                          <p className="text-xs text-muted-foreground">
                            NF-e {entry.nfe_number || '-'}/{entry.nfe_series || '1'} • {entry.stores?.name}
                          </p>
                          {entry.access_key && (
                            <p className="text-xs text-muted-foreground font-mono truncate max-w-md">
                              Chave: {entry.access_key}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-sm">{fc(entry.total_nfe)}</p>
                          <p className="text-xs text-muted-foreground">
                            {entry.issue_date ? new Date(entry.issue_date).toLocaleDateString('pt-BR') : '-'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Selected entry info */}
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{selectedEntry.suppliers?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        NF-e {selectedEntry.nfe_number}/{selectedEntry.nfe_series || '1'} • {selectedEntry.stores?.name}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => { setSelectedEntry(null); setEntryItems([]); }}>
                      Trocar
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="font-medium">Itens para devolver</Label>
                  <Button variant="ghost" size="sm" onClick={() => {
                    const allSelected = entryItems.every(i => selectedItems[i.id]?.selected);
                    const updated: Record<string, { selected: boolean; qty: number }> = {};
                    entryItems.forEach(i => {
                      updated[i.id] = { selected: !allSelected, qty: i.quantity };
                    });
                    setSelectedItems(updated);
                  }}>
                    {entryItems.every(i => selectedItems[i.id]?.selected) ? 'Desmarcar todos' : 'Selecionar todos'}
                  </Button>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {entryItems.map(item => (
                    <div key={item.id} className="flex items-center gap-3 border rounded-lg p-3">
                      <Checkbox
                        checked={selectedItems[item.id]?.selected || false}
                        onCheckedChange={() => toggleItem(item.id)}
                      />
                      <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {item.products?.name || item.description}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Máx: {item.quantity} {item.unit} × {fc(item.unit_price)}
                        </p>
                      </div>
                      {selectedItems[item.id]?.selected && (
                        <div className="flex items-center gap-2">
                          <Label className="text-xs">Qtd:</Label>
                          <Input
                            type="number"
                            min={1}
                            max={item.quantity}
                            value={selectedItems[item.id]?.qty || 1}
                            onChange={(e) => updateQty(item.id, Number(e.target.value))}
                            className="w-20 h-8 text-sm"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label>Observações</Label>
                <Textarea
                  placeholder="Motivo da devolução, referências..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>

              {/* Total */}
              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-sm font-medium">Total da devolução:</span>
                <span className="text-lg font-bold text-primary">{fc(totalReturn)}</span>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => { setShowDialog(false); resetForm(); }}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleEmit}
                  disabled={emitting || entryItems.filter(i => selectedItems[i.id]?.selected).length === 0}
                >
                  {emitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                  Gerar NF-e de Devolução
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
