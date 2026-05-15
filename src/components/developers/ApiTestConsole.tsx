import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, FlaskConical, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-api/v1`;
const METHODS = ['GET', 'POST', 'PATCH', 'DELETE'] as const;
type Method = typeof METHODS[number];

const PRESETS: { label: string; method: Method; path: string; body?: string }[] = [
  { label: 'Listar produtos', method: 'GET', path: '/products?limit=5' },
  { label: 'Listar vendas pagas', method: 'GET', path: '/sales?status=paid&limit=5' },
  { label: 'Listar clientes', method: 'GET', path: '/customers?limit=5' },
  { label: 'Saldos de estoque', method: 'GET', path: '/stock?limit=5' },
  {
    label: 'Criar produto (escrita)',
    method: 'POST',
    path: '/products',
    body: JSON.stringify(
      { name: 'Produto teste', sku: 'TEST-001', price: 9.9, category: 'Geral' },
      null,
      2,
    ),
  },
];

export default function ApiTestConsole() {
  const [apiKey, setApiKey] = useState('');
  const [method, setMethod] = useState<Method>('GET');
  const [path, setPath] = useState('/products?limit=5');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<{
    status: number;
    statusText: string;
    latencyMs: number;
    headers: Record<string, string>;
    body: string;
  } | null>(null);

  const env: 'live' | 'test' | null = apiKey.startsWith('tps_test_')
    ? 'test'
    : apiKey.startsWith('tps_live_')
    ? 'live'
    : null;

  const handleSend = async () => {
    if (!apiKey.trim()) {
      toast.error('Informe uma chave de API (tps_live_… ou tps_test_…)');
      return;
    }
    if (!path.startsWith('/')) {
      toast.error('O caminho deve começar com /');
      return;
    }
    setLoading(true);
    setResponse(null);
    const start = performance.now();
    try {
      const init: RequestInit = {
        method,
        headers: { Authorization: `Bearer ${apiKey.trim()}`, 'Content-Type': 'application/json' },
      };
      if (method !== 'GET' && body.trim()) init.body = body;
      const res = await fetch(`${API_BASE}${path}`, init);
      const text = await res.text();
      const latencyMs = Math.round(performance.now() - start);
      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => (headers[k] = v));
      let pretty = text;
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        /* keep raw */
      }
      setResponse({ status: res.status, statusText: res.statusText, latencyMs, headers, body: pretty });
    } catch (e: any) {
      const latencyMs = Math.round(performance.now() - start);
      setResponse({
        status: 0,
        statusText: 'Network error',
        latencyMs,
        headers: {},
        body: String(e?.message ?? e),
      });
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (p: typeof PRESETS[number]) => {
    setMethod(p.method);
    setPath(p.path);
    setBody(p.body ?? '');
  };

  const statusColor = response
    ? response.status >= 200 && response.status < 300
      ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
      : response.status >= 400
      ? 'bg-rose-100 text-rose-700 border-rose-200'
      : 'bg-amber-100 text-amber-800 border-amber-200'
    : '';

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Play className="h-4 w-4 text-primary" />
            Console de teste da API
          </CardTitle>
          <CardDescription>
            Faça uma requisição autenticada direto do navegador para validar sua chave em modo Live ou Test.
            Chaves <code className="font-mono">tps_test_</code> retornam <code className="font-mono">_test_dry_run: true</code> em escritas e não persistem nada.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">Chave de API</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="tps_live_… ou tps_test_…"
                className="font-mono text-xs"
                type="password"
                autoComplete="off"
              />
              {env === 'live' && (
                <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-100 border-sky-200">Live</Badge>
              )}
              {env === 'test' && (
                <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">
                  <FlaskConical className="h-3 w-3 mr-1" />
                  Test
                </Badge>
              )}
            </div>
          </div>

          <div>
            <Label className="text-xs mb-1.5 block">Exemplos rápidos</Label>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <Button
                  key={p.label}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => applyPreset(p)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-[110px_1fr] gap-2">
            <div>
              <Label className="text-xs">Método</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as Method)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Path</Label>
              <Input
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/products?limit=5"
                className="font-mono text-xs mt-1"
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground -mt-2 font-mono break-all">
            {API_BASE}{path}
          </p>

          {method !== 'GET' && (
            <div>
              <Label className="text-xs">Body (JSON)</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder='{ "name": "Produto teste" }'
                className="font-mono text-xs mt-1 min-h-[120px]"
              />
            </div>
          )}

          <Button onClick={handleSend} disabled={loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            {loading ? 'Enviando…' : 'Enviar requisição'}
          </Button>
        </CardContent>
      </Card>

      {response && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={statusColor}>
                {response.status || 'ERR'} {response.statusText}
              </Badge>
              <Badge variant="secondary" className="text-xs">{response.latencyMs} ms</Badge>
              {(() => {
                try {
                  const parsed = JSON.parse(response.body);
                  if (parsed && parsed._test_dry_run) {
                    return (
                      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">
                        <FlaskConical className="h-3 w-3 mr-1" />
                        dry-run
                      </Badge>
                    );
                  }
                } catch {
                  /* noop */
                }
                return null;
              })()}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Headers</Label>
              <pre className="bg-muted p-3 rounded text-[10px] overflow-x-auto mt-1 max-h-40">
{Object.entries(response.headers).map(([k, v]) => `${k}: ${v}`).join('\n')}
              </pre>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Body</Label>
              <pre className="bg-muted p-3 rounded text-xs overflow-x-auto mt-1 max-h-[400px]">
{response.body}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
