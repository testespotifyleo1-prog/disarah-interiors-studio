import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowRight, CheckCircle2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MercadoLivreLogo } from '@/components/brand/BrandLogos';

export default function MercadoLivreCallback() {
  const [params] = useSearchParams();
  const [seconds, setSeconds] = useState(4);

  const status = params.get('status') || 'success';
  const nickname = params.get('nickname') || 'sua loja';
  const message = params.get('message');
  const isSuccess = status === 'success';

  const title = useMemo(
    () => isSuccess ? 'Conta Mercado Livre conectada!' : 'Não foi possível conectar',
    [isSuccess],
  );

  useEffect(() => {
    window.opener?.postMessage({ type: 'meli-oauth-finished', status }, window.location.origin);
    const countdown = window.setInterval(() => setSeconds((prev) => Math.max(prev - 1, 0)), 1000);
    const closer = window.setTimeout(() => window.close(), 4200);
    return () => {
      window.clearInterval(countdown);
      window.clearTimeout(closer);
    };
  }, [status]);

  const handleClose = () => {
    window.close();
    window.location.href = '/app/integrations/mercado-livre';
  };

  return (
    <main className="min-h-screen bg-background px-4 py-8 flex items-center justify-center">
      <Card className="w-full max-w-md overflow-hidden border shadow-xl">
        <CardContent className="p-0">
          <div className="bg-muted/40 px-6 py-7 text-center border-b">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-card shadow-sm">
              <MercadoLivreLogo className="h-11 w-11" />
            </div>
            <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${isSuccess ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>
              {isSuccess ? <CheckCircle2 className="h-7 w-7" /> : <AlertCircle className="h-7 w-7" />}
            </div>
          </div>

          <div className="space-y-5 p-6 text-center">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">{title}</h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {isSuccess
                  ? `A conta ${nickname} foi conectada com sucesso. Você já pode voltar ao Typos! ERP.`
                  : message || 'Feche esta janela, revise a configuração e tente conectar novamente.'}
              </p>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
              Esta janela tenta fechar automaticamente em {seconds}s. Se não fechar, use o botão abaixo.
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button onClick={handleClose} className="gap-2">
                <X className="h-4 w-4" />
                Fechar janela
              </Button>
              <Button variant="outline" asChild className="gap-2">
                <Link to="/app/integrations/mercado-livre">
                  Voltar para integração
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}