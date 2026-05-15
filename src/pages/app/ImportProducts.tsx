import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Upload, Loader2, FileSpreadsheet, CheckCircle, XCircle } from 'lucide-react';
import { parseCsvText, type CsvRow } from '@/utils/importCsv';

const PRODUCT_FIELDS = [
  { key: 'name', label: 'Nome *', required: true },
  { key: 'sku', label: 'SKU' },
  { key: 'price_default', label: 'Preço de Venda' },
  { key: 'cost_default', label: 'Custo' },
  { key: 'unit', label: 'Unidade' },
  { key: 'ncm', label: 'NCM' },
  { key: 'gtin', label: 'GTIN/EAN' },
  { key: 'cfop_default', label: 'CFOP' },
  { key: 'cest', label: 'CEST' },
  { key: 'qty', label: 'Estoque Inicial (loja selecionada)' },
];

export default function ImportProducts() {
  const { currentAccount, currentStore } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ success: number; errors: { row: number; msg: string }[] } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const { headers, rows } = parseCsvText(text);
      setCsvHeaders(headers);
      setCsvData(rows);
      setResults(null);

      // Auto-map by similarity
      const autoMap: Record<string, string> = {};
      PRODUCT_FIELDS.forEach(field => {
        const match = headers.find(h =>
          h.toLowerCase().includes(field.key.replace('_default', '').replace('_', ' ')) ||
          h.toLowerCase() === field.key
        );
        if (match) autoMap[field.key] = match;
      });
      setMapping(autoMap);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImport = async () => {
    if (!currentAccount) return;

    const nameCol = mapping['name'];
    if (!nameCol) {
      toast({ variant: 'destructive', title: 'Mapeie ao menos o campo Nome' });
      return;
    }

    setImporting(true);
    setProgress(0);
    const errors: { row: number; msg: string }[] = [];
    let success = 0;

    // Process in batches of 500 for performance with 15k+ products
    const BATCH_SIZE = 500;
    const totalRows = csvData.length;

    for (let batchStart = 0; batchStart < totalRows; batchStart += BATCH_SIZE) {
      const batch = csvData.slice(batchStart, batchStart + BATCH_SIZE);
      const batchInserts: any[] = [];
      const batchUpdates: { id: string; data: any; rowIdx: number }[] = [];
      const skuLookups: { sku: string; rowIdx: number; product: any }[] = [];

      // Prepare batch
      for (let j = 0; j < batch.length; j++) {
        const globalIdx = batchStart + j;
        const row = batch[j];
        const name = row[nameCol]?.trim();
        if (!name) {
          errors.push({ row: globalIdx + 2, msg: 'Nome vazio' });
          continue;
        }

        const skuValue = mapping['sku'] ? row[mapping['sku']]?.trim() || null : null;
        const product: any = {
          account_id: currentAccount.id,
          name,
          ...(skuValue ? { sku: skuValue } : {}),
          price_default: mapping['price_default'] ? parseFloat(row[mapping['price_default']]?.replace(',', '.') || '0') : 0,
          cost_default: mapping['cost_default'] ? parseFloat(row[mapping['cost_default']]?.replace(',', '.') || '0') : 0,
          unit: mapping['unit'] ? row[mapping['unit']]?.trim() || 'UN' : 'UN',
          ncm: mapping['ncm'] ? row[mapping['ncm']]?.trim() || null : null,
          gtin: mapping['gtin'] ? row[mapping['gtin']]?.trim() || null : null,
          cfop_default: mapping['cfop_default'] ? row[mapping['cfop_default']]?.trim() || null : null,
          cest: mapping['cest'] ? row[mapping['cest']]?.trim() || null : null,
        };

        if (skuValue) {
          skuLookups.push({ sku: skuValue, rowIdx: globalIdx, product });
        } else {
          batchInserts.push({ ...product, _rowIdx: globalIdx });
        }
      }

      // Lookup existing SKUs in batch
      if (skuLookups.length > 0) {
        const skus = skuLookups.map(s => s.sku);
        const { data: existing } = await supabase
          .from('products')
          .select('id, sku')
          .eq('account_id', currentAccount.id)
          .in('sku', skus);

        const existingMap = new Map((existing || []).map(e => [e.sku, e.id]));

        for (const lookup of skuLookups) {
          const existingId = existingMap.get(lookup.sku);
          if (existingId) {
            batchUpdates.push({ id: existingId, data: lookup.product, rowIdx: lookup.rowIdx });
          } else {
            batchInserts.push({ ...lookup.product, _rowIdx: lookup.rowIdx });
          }
        }
      }

      // Batch insert new products
      if (batchInserts.length > 0) {
        const cleanInserts = batchInserts.map(({ _rowIdx, ...rest }) => rest);
        const { data: inserted, error } = await supabase
          .from('products')
          .insert(cleanInserts)
          .select('id');

        if (error) {
          // Fallback to row-by-row on batch error
          for (let k = 0; k < batchInserts.length; k++) {
            const { _rowIdx, ...product } = batchInserts[k];
            try {
              const { error: rowErr } = await supabase.from('products').insert(product);
              if (rowErr) throw rowErr;
              success++;
            } catch (e: any) {
              errors.push({ row: _rowIdx + 2, msg: e.message });
            }
          }
        } else {
          success += (inserted || []).length;
        }
      }

      // Process updates individually (can't batch updates with different data)
      for (const upd of batchUpdates) {
        try {
          const { error } = await supabase.from('products').update(upd.data).eq('id', upd.id);
          if (error) throw error;
          success++;
        } catch (e: any) {
          errors.push({ row: upd.rowIdx + 2, msg: e.message });
        }
      }

      if (mapping['qty'] && currentStore) {
        // Stock import handled separately after all products
      }

      // Update progress
      setProgress(Math.min(100, Math.round(((batchStart + batch.length) / totalRows) * 100)));
    }

    setResults({ success, errors });
    setImporting(false);
    toast({
      title: 'Importação concluída',
      description: `${success} produtos importados, ${errors.length} erros.`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/app/products">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Importar Produtos</h1>
          <p className="text-muted-foreground">Importe produtos em massa via arquivo CSV</p>
        </div>
      </div>

      {/* Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Selecionar Arquivo
          </CardTitle>
          <CardDescription>
            Formatos aceitos: CSV com separador vírgula ou ponto e vírgula. Se o SKU já existir, o produto será atualizado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            ref={fileRef}
            type="file"
            accept=".csv,.txt"
            onChange={handleFileChange}
          />
        </CardContent>
      </Card>

      {/* Mapping */}
      {csvHeaders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Mapeamento de Colunas</CardTitle>
            <CardDescription>
              Associe as colunas do CSV aos campos do sistema. Preview: {csvData.length} linhas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {PRODUCT_FIELDS.map(field => (
                <div key={field.key} className="space-y-1">
                  <Label className="text-xs">{field.label}</Label>
                  <Select
                    value={mapping[field.key] || '__none__'}
                    onValueChange={(v) => setMapping(prev => ({ ...prev, [field.key]: v === '__none__' ? '' : v }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Não mapear" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Não mapear —</SelectItem>
                      {csvHeaders.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {/* Preview */}
            <div className="mt-6 overflow-auto max-h-64 border rounded">
              <Table>
                <TableHeader>
                  <TableRow>
                    {csvHeaders.map(h => (
                      <TableHead key={h} className="text-xs whitespace-nowrap">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {csvData.slice(0, 5).map((row, i) => (
                    <TableRow key={i}>
                      {csvHeaders.map(h => (
                        <TableCell key={h} className="text-xs whitespace-nowrap">{row[h]}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 space-y-3">
              <Button onClick={handleImport} disabled={importing}>
                {importing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Importar {csvData.length} Produtos
              </Button>
              {importing && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Importando...</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {results && (
        <Card>
          <CardHeader>
            <CardTitle>Resultado da Importação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-6">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">{results.success} importados com sucesso</span>
              </div>
              {results.errors.length > 0 && (
                <div className="flex items-center gap-2 text-destructive">
                  <XCircle className="h-5 w-5" />
                  <span className="font-medium">{results.errors.length} erros</span>
                </div>
              )}
            </div>
            {results.errors.length > 0 && (
              <div className="max-h-48 overflow-auto border rounded p-3 space-y-1">
                {results.errors.map((err, i) => (
                  <p key={i} className="text-sm text-destructive">
                    Linha {err.row}: {err.msg}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
