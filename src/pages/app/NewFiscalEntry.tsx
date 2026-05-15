import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, FileText, Check, Package, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { parseNFeXml, type ParsedNFe, type ParsedNFeItem } from '@/utils/parseNFeXml';

interface ItemState {
  item: ParsedNFeItem;
  matchedProductId: string | null;
  matchedProductName: string | null;
  createProduct: boolean;
  include: boolean;
  expirationDate: string;
}

export default function NewFiscalEntry() {
  const { currentAccount, stores } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [storeId, setStoreId] = useState<string>('');
  const [storeCnpj, setStoreCnpj] = useState<string>('');
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedNFe | null>(null);
  const [itemStates, setItemStates] = useState<ItemState[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [parsing, setParsing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [cnpjMismatch, setCnpjMismatch] = useState(false);

  // Payment fields
  const [dueDate, setDueDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [installments, setInstallments] = useState<number>(1);
  const [notes, setNotes] = useState('');

  // Load store CNPJ when store changes
  useEffect(() => {
    if (storeId) {
      const store = stores.find(s => s.id === storeId);
      if (store) setStoreCnpj(store.cnpj?.replace(/\D/g, '') || '');
    }
  }, [storeId, stores]);

  // Load products for matching
  useEffect(() => {
    if (currentAccount) {
      supabase.from('products').select('id, name, sku, ncm, unit, cost_default, price_default')
        .eq('account_id', currentAccount.id).eq('is_active', true)
        .then(({ data }) => setProducts(data || []));
    }
  }, [currentAccount]);

  const handleXmlUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setXmlFile(file);

    if (!storeId) {
      toast({ variant: 'destructive', title: 'Selecione uma loja primeiro' });
      return;
    }

    setParsing(true);
    try {
      const text = await file.text();
      const parsed = parseNFeXml(text);
      setParsedData(parsed);

      // Validate CNPJ - warn but don't block
      const destCnpj = parsed.destinatario.cnpj.replace(/\D/g, '');
      if (destCnpj && destCnpj !== storeCnpj) {
        setCnpjMismatch(true);
        toast({ variant: 'destructive', title: 'CNPJ divergente', description: `O CNPJ destinatário (${destCnpj}) não corresponde ao CNPJ da loja selecionada (${storeCnpj}). Verifique se a loja está correta.` });
      } else {
        setCnpjMismatch(false);
      }

      // Auto-match items — auto-create when no match found
      const states: ItemState[] = parsed.items.map(item => {
        const match = findProductMatch(item);
        return {
          item,
          matchedProductId: match?.id || null,
          matchedProductName: match?.name || null,
          createProduct: !match,
          include: true,
          expirationDate: '',
        };
      });
      setItemStates(states);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro ao processar XML', description: err.message });
    } finally {
      setParsing(false);
    }
  };

  const findProductMatch = (item: ParsedNFeItem) => {
    // Try matching by name (case-insensitive, partial)
    const descLower = item.description.toLowerCase();
    return products.find(p => {
      const pName = p.name?.toLowerCase() || '';
      const pSku = p.sku?.toLowerCase() || '';
      return pName === descLower || pSku === item.code;
    }) || null;
  };

  const updateItemState = (index: number, updates: Partial<ItemState>) => {
    setItemStates(prev => prev.map((s, i) => i === index ? { ...s, ...updates } : s));
  };

  const handleConfirm = async () => {
    if (!parsedData || !currentAccount || !storeId) return;

    const includedItems = itemStates.filter(s => s.include);
    if (includedItems.length === 0) {
      toast({ variant: 'destructive', title: 'Selecione ao menos um item' });
      return;
    }

    setConfirming(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sessão expirada');

      // 1. Upsert supplier
      const supplierCnpj = parsedData.emitente.cnpj.replace(/\D/g, '');
      let supplierId: string;

      const { data: existingSupplier } = await supabase
        .from('suppliers')
        .select('id')
        .eq('account_id', currentAccount.id)
        .eq('cnpj', supplierCnpj)
        .maybeSingle();

      if (existingSupplier) {
        supplierId = existingSupplier.id;
      } else {
        const { data: newSupplier, error: supErr } = await supabase
          .from('suppliers')
          .insert({
            account_id: currentAccount.id,
            cnpj: supplierCnpj,
            name: parsedData.emitente.name,
            trade_name: parsedData.emitente.tradeName || null,
          })
          .select('id')
          .single();
        if (supErr) throw new Error('Erro ao cadastrar fornecedor');
        supplierId = newSupplier.id;
      }

      // 2. Upload XML
      let xmlPath: string | null = null;
      if (xmlFile) {
        const path = `${currentAccount.id}/${storeId}/${Date.now()}_${xmlFile.name}`;
        const { error: uploadErr } = await supabase.storage.from('fiscal-files').upload(path, xmlFile);
        if (!uploadErr) xmlPath = path;
      }

      // 3. Upload PDF
      let pdfPath: string | null = null;
      if (pdfFile) {
        const path = `${currentAccount.id}/${storeId}/${Date.now()}_${pdfFile.name}`;
        const { error: uploadErr } = await supabase.storage.from('fiscal-files').upload(path, pdfFile);
        if (!uploadErr) pdfPath = path;
      }

      // 4. Create fiscal entry
      const { data: entry, error: entryErr } = await supabase
        .from('fiscal_entries')
        .insert({
          account_id: currentAccount.id,
          store_id: storeId,
          supplier_id: supplierId,
          access_key: parsedData.accessKey,
          nfe_number: parsedData.nfeNumber,
          nfe_series: parsedData.nfeSeries,
          issue_date: parsedData.issueDate || null,
          total_products: parsedData.totalProducts,
          total_freight: parsedData.totalFreight,
          total_discount: parsedData.totalDiscount,
          total_nfe: parsedData.totalNfe,
          xml_path: xmlPath,
          pdf_path: pdfPath,
          status: 'confirmed',
          notes: notes || null,
          confirmed_at: new Date().toISOString(),
          confirmed_by: user.id,
          created_by: user.id,
        })
        .select('id')
        .single();

      if (entryErr) throw new Error('Erro ao criar entrada fiscal');

      // 5. Create items + products + inventory
      for (const itemState of includedItems) {
        let productId = itemState.matchedProductId;

        // Create product if requested — generate sequential SKU
        if (!productId && itemState.createProduct) {
          // Generate next SKU
          const { data: nextSku } = await supabase.rpc('generate_next_sku', { _account_id: currentAccount.id });
          const sku = nextSku || itemState.item.code || null;

          const { data: newProd } = await supabase
            .from('products')
            .insert({
              account_id: currentAccount.id,
              name: itemState.item.description,
              sku,
              ncm: itemState.item.ncm || null,
              unit: itemState.item.unit || 'UN',
              cost_default: itemState.item.unitPrice,
              price_default: itemState.item.unitPrice,
            })
            .select('id')
            .single();
          if (newProd) productId = newProd.id;
        }

        // Insert item
        await supabase.from('fiscal_entry_items').insert({
          fiscal_entry_id: entry.id,
          product_id: productId || null,
          xml_code: itemState.item.code,
          description: itemState.item.description,
          ncm: itemState.item.ncm,
          cfop: itemState.item.cfop,
          unit: itemState.item.unit,
          quantity: itemState.item.quantity,
          unit_price: itemState.item.unitPrice,
          total_line: itemState.item.totalLine,
          matched: !!itemState.matchedProductId,
          created_product: itemState.createProduct,
        });

        // Update inventory if product exists
        if (productId) {
          // Check if there's a purchase presentation with explicit unit code matching the XML unit
          let stockQty = itemState.item.quantity;
          const xmlUnit = (itemState.item.unit || '').toUpperCase().trim();
          
          if (xmlUnit) {
            const { data: purchasePres } = await supabase
              .from('product_presentations')
              .select('conversion_factor, purchase_unit_code')
              .eq('product_id', productId)
              .eq('is_purchase', true)
              .eq('is_active', true)
              .not('purchase_unit_code', 'is', null);
            
            if (purchasePres && purchasePres.length > 0) {
              const match = purchasePres.find(p => 
                (p.purchase_unit_code || '').toUpperCase().trim() === xmlUnit
              );
              if (match) {
                stockQty = itemState.item.quantity * match.conversion_factor;
              }
            }
          }

          const { data: inv } = await supabase
            .from('inventory')
            .select('id, qty_on_hand')
            .eq('store_id', storeId)
            .eq('product_id', productId)
            .maybeSingle();

          if (inv) {
            await supabase.from('inventory').update({
              qty_on_hand: inv.qty_on_hand + stockQty,
              updated_at: new Date().toISOString(),
            }).eq('id', inv.id);
          } else {
            await supabase.from('inventory').insert({
              store_id: storeId,
              product_id: productId,
              qty_on_hand: stockQty,
            });
          }

          // Save expiration date if provided
          if (itemState.expirationDate) {
            await supabase.from('product_expiration_dates').insert({
              product_id: productId,
              store_id: storeId,
              account_id: currentAccount.id,
              expiration_date: itemState.expirationDate,
              quantity: stockQty,
              fiscal_entry_id: entry.id,
              batch_label: `NF-e ${parsedData.nfeNumber}`,
            });
          }
        }
      }

      // 6. Create accounts payable
      const totalAP = parsedData.totalNfe;
      const storeName = stores.find(s => s.id === storeId)?.name || '';

      if (installments <= 1) {
        await supabase.from('accounts_payable').insert({
          account_id: currentAccount.id,
          store_id: storeId,
          description: `Compra ${parsedData.emitente.name} — NF-e ${parsedData.nfeNumber}`,
          amount: totalAP,
          due_date: dueDate,
          supplier_name: parsedData.emitente.name,
          category: 'compra',
          status: 'open',
          notes: `fiscal_entry:${entry.id}`,
        });
      } else {
        const installmentAmount = Math.round(totalAP / installments * 100) / 100;
        const firstDate = new Date(dueDate);
        for (let i = 0; i < installments; i++) {
          const dd = new Date(firstDate);
          dd.setMonth(dd.getMonth() + i);
          await supabase.from('accounts_payable').insert({
            account_id: currentAccount.id,
            store_id: storeId,
            description: `Compra ${parsedData.emitente.name} — NF-e ${parsedData.nfeNumber} (${i + 1}/${installments})`,
            amount: i === installments - 1 ? totalAP - installmentAmount * (installments - 1) : installmentAmount,
            due_date: dd.toISOString().substring(0, 10),
            supplier_name: parsedData.emitente.name,
            category: 'compra',
            status: 'open',
            notes: `fiscal_entry:${entry.id}`,
          });
        }
      }

      toast({ title: 'Entrada fiscal confirmada!', description: 'Estoque atualizado e contas a pagar criadas.' });
      navigate('/app/fiscal-entries');
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    } finally {
      setConfirming(false);
    }
  };

  const fc = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Nova Entrada Fiscal</h1>
        <p className="text-sm text-muted-foreground">Importe o XML da NF-e do fornecedor para dar entrada no estoque</p>
      </div>

      {/* Step 1: Select store */}
      <Card>
        <CardHeader><CardTitle className="text-lg">1. Selecione a Loja</CardTitle></CardHeader>
        <CardContent>
          <Select value={storeId} onValueChange={setStoreId}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha a loja que recebeu a mercadoria" />
            </SelectTrigger>
            <SelectContent>
              {stores.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name} — CNPJ: {s.cnpj}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Step 2: Upload XML */}
      {storeId && (
        <Card>
          <CardHeader><CardTitle className="text-lg">2. Upload do XML da NF-e</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Arquivo XML (obrigatório)</Label>
              <Input type="file" accept=".xml" onChange={handleXmlUpload} className="mt-1" />
            </div>
            <div>
              <Label>PDF / DANFE (opcional)</Label>
              <Input type="file" accept=".pdf" onChange={e => setPdfFile(e.target.files?.[0] || null)} className="mt-1" />
            </div>
            {parsing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Processando XML...
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* CNPJ Mismatch Warning */}
      {cnpjMismatch && (
        <Card className="border-destructive">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-destructive flex-shrink-0" />
            <div>
              <p className="font-medium text-destructive">CNPJ Divergente</p>
              <p className="text-sm text-muted-foreground">
                O CNPJ destinatário do XML ({parsedData?.destinatario.cnpj}) não corresponde ao CNPJ da loja selecionada ({storeCnpj}).
                Selecione a loja correta ou use outro XML.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Parsed data */}
      {parsedData && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-lg">3. Dados da NF-e</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Fornecedor:</span>
                  <p className="font-medium">{parsedData.emitente.name}</p>
                  <p className="text-xs text-muted-foreground">CNPJ: {parsedData.emitente.cnpj}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Chave de Acesso:</span>
                  <p className="font-mono text-xs break-all">{parsedData.accessKey}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Número / Série:</span>
                  <p className="font-medium">{parsedData.nfeNumber} / {parsedData.nfeSeries}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Data Emissão:</span>
                  <p className="font-medium">{parsedData.issueDate}</p>
                </div>
              </div>
              <div className="border-t pt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div><span className="text-muted-foreground">Produtos:</span><p className="font-medium">{fc(parsedData.totalProducts)}</p></div>
                <div><span className="text-muted-foreground">Frete:</span><p className="font-medium">{fc(parsedData.totalFreight)}</p></div>
                <div><span className="text-muted-foreground">Desconto:</span><p className="font-medium">{fc(parsedData.totalDiscount)}</p></div>
                <div><span className="text-muted-foreground">Total NF:</span><p className="font-bold text-primary">{fc(parsedData.totalNfe)}</p></div>
              </div>
            </CardContent>
          </Card>

          {/* Step 4: Items */}
          <Card>
            <CardHeader><CardTitle className="text-lg">4. Itens ({itemStates.length})</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {itemStates.map((state, idx) => (
                <div key={idx} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={state.include}
                      onCheckedChange={v => updateItemState(idx, { include: !!v })}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{state.item.description}</p>
                      <p className="text-xs text-muted-foreground">
                        Cód: {state.item.code} • {state.item.quantity} {state.item.unit} × {fc(state.item.unitPrice)} = {fc(state.item.totalLine)}
                      </p>
                      {state.item.ncm && <p className="text-xs text-muted-foreground">NCM: {state.item.ncm} • CFOP: {state.item.cfop}</p>}
                    </div>
                  </div>

                  {state.include && (
                    <div className="ml-7 space-y-2">
                      {state.matchedProductId ? (
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-600" />
                          <span className="text-sm text-green-700">Vinculado: {state.matchedProductName}</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Package className="h-4 w-4" />
                            Nenhum produto encontrado automaticamente
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Select
                              value={state.matchedProductId || 'none'}
                              onValueChange={v => {
                                if (v === 'none') {
                                  updateItemState(idx, { matchedProductId: null, matchedProductName: null, createProduct: false });
                                } else {
                                  const p = products.find(p => p.id === v);
                                  updateItemState(idx, { matchedProductId: v, matchedProductName: p?.name || '', createProduct: false });
                                }
                              }}
                            >
                              <SelectTrigger className="w-full sm:w-64 h-8 text-xs">
                                <SelectValue placeholder="Vincular a produto existente" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Nenhum</SelectItem>
                                {products.map(p => (
                                  <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {!state.matchedProductId && (
                              <label className="flex items-center gap-2 text-xs cursor-pointer">
                                <Checkbox
                                  checked={state.createProduct}
                                  onCheckedChange={v => updateItemState(idx, { createProduct: !!v })}
                                />
                                Criar produto automaticamente
                              </label>
                            )}
                          </div>
                        </div>
                      )}
                      {/* Expiration date field */}
                      <div className="flex items-center gap-2">
                        <Label className="text-xs whitespace-nowrap">Validade:</Label>
                        <Input
                          type="date"
                          value={state.expirationDate}
                          onChange={e => updateItemState(idx, { expirationDate: e.target.value })}
                          className="h-8 text-xs w-40"
                          placeholder="dd/mm/aaaa"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Step 5: Payment */}
          <Card>
            <CardHeader><CardTitle className="text-lg">5. Contas a Pagar</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label>Total</Label>
                  <Input value={fc(parsedData.totalNfe)} disabled className="mt-1" />
                </div>
                <div>
                  <Label>1º Vencimento</Label>
                  <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Parcelas</Label>
                  <Input type="number" min={1} max={24} value={installments} onChange={e => setInstallments(Number(e.target.value))} className="mt-1" />
                </div>
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observações sobre a entrada..." className="mt-1" />
              </div>
            </CardContent>
          </Card>

          {/* Confirm */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => navigate('/app/fiscal-entries')}>Cancelar</Button>
            <Button onClick={handleConfirm} disabled={confirming} size="lg">
              {confirming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Confirmar Entrada
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
