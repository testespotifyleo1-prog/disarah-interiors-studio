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

const CUSTOMER_FIELDS = [
  { key: 'name', label: 'Nome *', required: true },
  { key: 'document', label: 'CPF/CNPJ' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Telefone' },
  { key: 'postalCode', label: 'CEP' },
  { key: 'street', label: 'Logradouro' },
  { key: 'number', label: 'Número' },
  { key: 'complement', label: 'Complemento' },
  { key: 'district', label: 'Bairro' },
  { key: 'city', label: 'Cidade' },
  { key: 'state', label: 'UF' },
  { key: 'cityCode', label: 'Código IBGE' },
];

export default function ImportCustomers() {
  const { currentAccount } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
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

      const autoMap: Record<string, string> = {};
      CUSTOMER_FIELDS.forEach(field => {
        const match = headers.find(h =>
          h.toLowerCase().includes(field.key.toLowerCase()) ||
          h.toLowerCase() === field.label.toLowerCase().replace(' *', '')
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
    const errors: { row: number; msg: string }[] = [];
    let success = 0;

    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      const name = row[nameCol]?.trim();
      if (!name) {
        errors.push({ row: i + 2, msg: 'Nome vazio' });
        continue;
      }

      const document = mapping['document'] ? row[mapping['document']]?.replace(/\D/g, '') || null : null;

      // Build address
      let addressJson: any = null;
      const hasAddress = ['street', 'city', 'state', 'postalCode'].some(k => mapping[k] && row[mapping[k]]?.trim());
      if (hasAddress) {
        addressJson = {
          street: mapping['street'] ? row[mapping['street']]?.trim() : undefined,
          number: mapping['number'] ? row[mapping['number']]?.trim() : undefined,
          complement: mapping['complement'] ? row[mapping['complement']]?.trim() : undefined,
          district: mapping['district'] ? row[mapping['district']]?.trim() : undefined,
          city: mapping['city'] ? row[mapping['city']]?.trim() : undefined,
          state: mapping['state'] ? row[mapping['state']]?.trim()?.toUpperCase() : undefined,
          cityCode: mapping['cityCode'] ? row[mapping['cityCode']]?.trim() : undefined,
          postalCode: mapping['postalCode'] ? row[mapping['postalCode']]?.replace(/\D/g, '') : undefined,
        };
      }

      const customer: any = {
        account_id: currentAccount.id,
        name,
        document: document || null,
        email: mapping['email'] ? row[mapping['email']]?.trim() || null : null,
        phone: mapping['phone'] ? row[mapping['phone']]?.trim() || null : null,
        address_json: addressJson,
      };

      try {
        // Upsert by document if available
        if (document) {
          const { data: existing } = await supabase
            .from('customers')
            .select('id')
            .eq('account_id', currentAccount.id)
            .eq('document', document)
            .maybeSingle();

          if (existing) {
            const { error } = await supabase.from('customers').update(customer).eq('id', existing.id);
            if (error) throw error;
          } else {
            const { error } = await supabase.from('customers').insert(customer);
            if (error) throw error;
          }
        } else {
          const { error } = await supabase.from('customers').insert(customer);
          if (error) throw error;
        }

        success++;
      } catch (error: any) {
        errors.push({ row: i + 2, msg: error.message });
      }
    }

    setResults({ success, errors });
    setImporting(false);
    toast({
      title: 'Importação concluída',
      description: `${success} clientes importados, ${errors.length} erros.`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/app/customers">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Importar Clientes</h1>
          <p className="text-muted-foreground">Importe clientes em massa via arquivo CSV</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Selecionar Arquivo
          </CardTitle>
          <CardDescription>
            Formatos aceitos: CSV com separador vírgula ou ponto e vírgula. Se o CPF/CNPJ já existir, o cliente será atualizado.
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
              {CUSTOMER_FIELDS.map(field => (
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

            <div className="mt-4">
              <Button onClick={handleImport} disabled={importing}>
                {importing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Importar {csvData.length} Clientes
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
