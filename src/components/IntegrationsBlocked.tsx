import { Lock } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function IntegrationsBlocked() {
  return (
    <div className="max-w-xl mx-auto mt-12">
      <Card className="border-dashed">
        <CardHeader className="items-center text-center">
          <div className="rounded-full bg-muted p-3 mb-2">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle>Integração indisponível</CardTitle>
          <CardDescription>
            O módulo de Marketplaces & Integrações está bloqueado para esta conta. Contate o suporte para ativar.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
