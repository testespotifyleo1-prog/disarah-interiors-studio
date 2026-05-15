import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { TyposLogo } from '@/components/brand/TyposLogo';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Package, Truck, ClipboardCheck, Clock, ExternalLink, MapPin, QrCode } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TrackingData {
  status: string;
  shipping_provider: string | null;
  tracking_code: string | null;
  shipping_label_url: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
  sale_number: number | null;
  store_name: string | null;
  store_slug: string | null;
  items: { product_name: string; qty_required: number; qty_picked: number }[];
}

const STEPS = [
  { key: 'pending', label: 'Pedido recebido', icon: Clock },
  { key: 'picking', label: 'Em separação', icon: Package },
  { key: 'checked', label: 'Conferido', icon: ClipboardCheck },
  { key: 'shipped', label: 'Enviado', icon: Truck },
  { key: 'delivered', label: 'Entregue', icon: CheckCircle2 },
];

const STATUS_INDEX: Record<string, number> = {
  pending: 0, picking: 1, checked: 2, shipped: 3, delivered: 4,
};

export default function TrackOrder() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) return;
    document.title = 'Acompanhe seu pedido';
    (async () => {
      const { data: res, error } = await supabase.rpc('get_public_tracking', { _token: token });
      if (error || !res) { setNotFound(true); setLoading(false); return; }
      setData(res as unknown as TrackingData);
      setLoading(false);
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="animate-pulse text-muted-foreground">Carregando rastreio…</div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-6">
        <Card className="p-8 text-center max-w-md">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <h1 className="text-xl font-bold mb-1">Pedido não encontrado</h1>
          <p className="text-sm text-muted-foreground">Verifique o link enviado pelo lojista.</p>
        </Card>
      </div>
    );
  }

  const currentStep = STATUS_INDEX[data.status] ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="border-b border-border/40 bg-card/60 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <TyposLogo size="sm" showCredit />
          {data.store_slug && (
            <a
              href={`/loja/${data.store_slug}`}
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              Visitar loja <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Hero */}
        <div className="text-center space-y-2 animate-fade-in">
          <Badge className="bg-primary/10 text-primary border-primary/20">Rastreamento</Badge>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            {data.status === 'delivered' ? 'Pedido entregue! 🎉' : 'Acompanhe seu pedido'}
          </h1>
          <p className="text-muted-foreground">
            {data.store_name && <>Loja: <span className="font-semibold text-foreground">{data.store_name}</span> · </>}
            Pedido <span className="font-mono font-semibold text-foreground">#{data.sale_number ?? '—'}</span>
          </p>
        </div>

        {/* Timeline */}
        <Card className="p-6 sm:p-8">
          <div className="relative">
            <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-border" />
            <div
              className="absolute left-6 top-6 w-0.5 bg-primary transition-all duration-700"
              style={{ height: `calc((100% - 3rem) * ${currentStep / (STEPS.length - 1)})` }}
            />
            <div className="space-y-6">
              {STEPS.map((step, i) => {
                const Icon = step.icon;
                const done = i <= currentStep;
                const active = i === currentStep;
                return (
                  <div key={step.key} className="flex items-start gap-4 relative">
                    <div className={cn(
                      'h-12 w-12 rounded-full flex items-center justify-center shrink-0 border-2 transition-all relative z-10',
                      done ? 'bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/30' : 'bg-card border-border text-muted-foreground',
                      active && 'animate-pulse ring-4 ring-primary/20'
                    )}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 pt-2.5">
                      <div className={cn('font-semibold', done ? 'text-foreground' : 'text-muted-foreground')}>
                        {step.label}
                      </div>
                      {active && (
                        <div className="text-xs text-primary mt-0.5">Em andamento agora</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Tracking info */}
        {(data.tracking_code || data.shipping_provider) && (
          <Card className="p-6 bg-primary/5 border-primary/20">
            <div className="flex items-center gap-2 mb-3">
              <Truck className="h-5 w-5 text-primary" />
              <h2 className="font-bold">Informações de envio</h2>
            </div>
            <dl className="space-y-2 text-sm">
              {data.shipping_provider && (
                <div className="flex justify-between"><dt className="text-muted-foreground">Transportadora</dt><dd className="font-semibold uppercase">{data.shipping_provider}</dd></div>
              )}
              {data.tracking_code && (
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Código</dt><dd className="font-mono font-semibold break-all text-right">{data.tracking_code}</dd></div>
              )}
              {data.shipping_label_url && (
                <a href={data.shipping_label_url} target="_blank" rel="noreferrer"
                   className="block mt-2 text-center bg-primary text-primary-foreground py-2.5 rounded-lg font-semibold hover:opacity-90 transition">
                  Acompanhar na transportadora
                </a>
              )}
            </dl>
          </Card>
        )}

        {/* Items */}
        {data.items?.length > 0 && (
          <Card className="p-6">
            <h2 className="font-bold mb-3 flex items-center gap-2"><Package className="h-4 w-4" /> Itens do pedido</h2>
            <ul className="divide-y divide-border">
              {data.items.map((it, i) => (
                <li key={i} className="py-2.5 flex justify-between text-sm">
                  <span className="font-medium">{it.product_name}</span>
                  <span className="text-muted-foreground tabular-nums">{Number(it.qty_required)}x</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* QR code for sharing */}
        <Card className="p-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-3 text-sm font-bold">
            <QrCode className="h-4 w-4 text-primary" /> Compartilhe este rastreio
          </div>
          <div className="flex justify-center">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${encodeURIComponent(window.location.href)}`}
              alt="QR Code para acompanhar pedido"
              className="rounded-lg border bg-white p-2"
              width={220}
              height={220}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Aponte a câmera do celular para abrir esta página em outro dispositivo.
          </p>
        </Card>

        <p className="text-center text-xs text-muted-foreground pt-2 flex items-center justify-center gap-1">
          <MapPin className="h-3 w-3" /> Atualizado em {new Date(data.updated_at).toLocaleString('pt-BR')}
        </p>
      </main>
    </div>
  );
}
