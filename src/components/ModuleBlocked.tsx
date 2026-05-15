import { Lock } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  title?: string;
  description?: string;
}

export default function ModuleBlocked({
  title = 'Recurso indisponível',
  description = 'Este recurso está bloqueado para esta conta. Contate a equipe Typos para ativar.',
}: Props) {
  return (
    <div className="max-w-xl mx-auto mt-12">
      <Card className="border-dashed">
        <CardHeader className="items-center text-center">
          <div className="rounded-full bg-muted p-3 mb-2">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
