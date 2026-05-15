import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Upload, Loader2, FileSpreadsheet, CheckCircle, XCircle } from 'lucide-react';
import { parseCsvText, type CsvRow } from '@/utils/importCsv';

const SUPPLIER_FIELDS = [
  { key: 'name', label: 'Razão Social *', required: true },
  { key: 'cnpj', label: 'CNPJ *', required: true },
  { key: 'trade_name', label: 'Nome Fantasia' },
  { key: 'email', label: 'E-mail' },
  { key: 'phone', label: 'Telefone' },
  { key: 'cep', label: 'CEP' },
  { key: 'street', label: 'Rua' },
  { key: 'number', label: 'Número' },
  { key: 'complement', label: 'Complemento' },
  { key: 'district', label: 'Bairro' },
  { key: 'city', label: 'Cidade' },
  { key: 'state', label: 'UF' },
  { key: 'skip', label: '— Ignorar —' },
];

export default function ImportSuppliers() {
  const { currentAccount } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'map' | 'importing' | 'done'>('upload');
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importResult, setImportResult] = useState({ success: 0, errors: 0, errorDetails: [] as string[] });

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseCsvText(text);
    if (parsed.rows.length === 0) { toast({ title: 'CSV vazio', variant: 'destructive' }); return; }
    const h = parsed.headers;
    setHeaders(h);
    setRows(parsed.rows);

    // Auto-map
    const autoMap: Record<string, string> = {};
    h.forEach(col => {
      const cl = col.toLowerCase().trim();
      if (cl.includes('razao') || cl.includes('razão') || cl === 'name' || cl === 'nome') autoMap[col] = 'name';
      else if (cl.includes('cnpj')) autoMap[col] = 'cnpj';
      else if (cl.includes('fantasia') || cl.includes('trade')) autoMap[col] = 'trade_name';
      else if (cl.includes('email') || cl.includes('e-mail')) autoMap[col] = 'email';
      else if (cl.includes('telefone') || cl.includes('phone') || cl.includes('fone')) autoMap[col] = 'phone';
      else if (cl.includes('cep') || cl.includes('zip')) autoMap[col] = 'cep';
      else if (cl.includes('rua') || cl.includes('logradouro') || cl.includes('street')) autoMap[col] = 'street';
      else if (cl === 'numero' || cl === 'número' || cl === 'number' || cl === 'nro') autoMap[col] = 'number';
      else if (cl.includes('complemento')) autoMap[col] = 'complement';
      else if (cl.includes('bairro') || cl.includes('district')) autoMap[col] = 'district';
      else if (cl.includes('cidade') || cl.includes('city') || cl.includes('municipio')) autoMap[col] = 'city';
      else if (cl === 'uf' || cl === 'estado' || cl === 'state') autoMap[col] = 'state';
      else autoMap[col] = 'skip';
    });
    setMapping(autoMap);
    setStep('map');
  };

  const doImport = async () => {
    if (!currentAccount) return;
    setStep('importing');
    let success = 0, errors = 0;
    const errorDetails: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const mapped: Record<string, string> = {};
      Object.entries(mapping).forEach(([csvCol, field]) => {
        if (field !== 'skip') mapped[field] = (row[csvCol] || '').toString().trim();
      });

      if (!mapped.name || !mapped.cnpj) {
        errors++;
        errorDetails.push(`Linha ${i + 2}: Razão Social ou CNPJ ausente`);
        continue;
      }

      const cnpjClean = mapped.cnpj.replace(/\D/g, '');
      if (cnpjClean.length < 11) {
        errors++;
        errorDetails.push(`Linha ${i + 2}: CNPJ inválido "${mapped.cnpj}"`);
        continue;
      }

      const address_json: Record<string, string> = {};
      ['cep', 'street', 'number', 'complement', 'district', 'city', 'state'].forEach(k => {
        if (mapped[k]) address_json[k] = mapped[k];
      });

      const { error } = await supabase.from('suppliers').upsert({
        account_id: currentAccount.id,
        cnpj: cnpjClean,
        name: mapped.name,
        trade_name: mapped.trade_name || null,
        email: mapped.email || null,
        phone: mapped.phone || null,
        address_json: Object.keys(address_json).length > 0 ? address_json : null,
      }, { onConflict: 'account_id,cnpj', ignoreDuplicates: false });

      if (error) {
        // Fallback: just insert
        const { error: insertErr } = await supabase.from('suppliers').insert({
          account_id: currentAccount.id,
          cnpj: cnpjClean,
          name: mapped.name,
          trade_name: mapped.trade_name || null,
          email: mapped.email || null,
          phone: mapped.phone || null,
          address_json: Object.keys(address_json).length > 0 ? address_json : null,
        });
        if (insertErr) {
          errors++;
          errorDetails.push(`Linha ${i + 2}: ${insertErr.message}`);
        } else {
          success++;
        }
      } else {
        success++;
      }
    }

    setImportResult({ success, errors, errorDetails });
    setStep('done');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild><Link to="/app/suppliers"><ArrowLeft className="h-5 w-5" /></Link></Button>
        <div>
          <h1 className="text-xl font-bold">Importar Fornecedores via CSV</h1>
          <p className="text-sm text-muted-foreground">Suba seus fornecedores em massa</p>
        </div>
      </div>

      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" /> Selecionar Arquivo CSV</CardTitle>
            <CardDescription>O arquivo deve conter pelo menos Razão Social e CNPJ</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer hover:bg-muted/30 transition" onClick={() => fileRef.current?.click()}>
              <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Clique para selecionar o arquivo .csv</p>
              <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'map' && (
        <Card>
          <CardHeader>
            <CardTitle>Mapeamento de Colunas</CardTitle>
            <CardDescription>Associe cada coluna do CSV ao campo correspondente. Preview: {rows.length} linha(s)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Coluna CSV</TableHead>
                    <TableHead>Campo</TableHead>
                    <TableHead>Amostra</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {headers.map(h => (
                    <TableRow key={h}>
                      <TableCell className="font-medium text-xs">{h}</TableCell>
                      <TableCell>
                        <Select value={mapping[h] || 'skip'} onValueChange={v => setMapping(prev => ({ ...prev, [h]: v }))}>
                          <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {SUPPLIER_FIELDS.map(f => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">{rows[0]?.[h] || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('upload')}>Voltar</Button>
              <Button onClick={doImport} disabled={!mapping}>
                <Upload className="mr-2 h-4 w-4" /> Importar {rows.length} fornecedor(es)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'importing' && (
        <Card><CardContent className="py-16 text-center">
          <Loader2 className="h-10 w-10 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Importando fornecedores...</p>
        </CardContent></Card>
      )}

      {step === 'done' && (
        <Card>
          <CardContent className="py-10 space-y-4">
            <div className="flex items-center justify-center gap-6">
              <div className="text-center">
                <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-1" />
                <p className="text-2xl font-bold">{importResult.success}</p>
                <p className="text-xs text-muted-foreground">Importados</p>
              </div>
              {importResult.errors > 0 && (
                <div className="text-center">
                  <XCircle className="h-8 w-8 text-destructive mx-auto mb-1" />
                  <p className="text-2xl font-bold">{importResult.errors}</p>
                  <p className="text-xs text-muted-foreground">Erros</p>
                </div>
              )}
            </div>
            {importResult.errorDetails.length > 0 && (
              <div className="max-h-40 overflow-y-auto text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 space-y-1">
                {importResult.errorDetails.map((e, i) => <p key={i}>{e}</p>)}
              </div>
            )}
            <div className="flex justify-center gap-2">
              <Button variant="outline" asChild><Link to="/app/suppliers">Voltar para Fornecedores</Link></Button>
              <Button onClick={() => { setStep('upload'); setRows([]); setHeaders([]); }}>Importar Mais</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
