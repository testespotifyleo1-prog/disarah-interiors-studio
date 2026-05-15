import { useSearchParams, Link } from "react-router-dom";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CheckoutReturn() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="text-center max-w-md">
        {sessionId ? (
          <>
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Pagamento confirmado!</h1>
            <p className="text-muted-foreground mb-6">
              Seu plano foi ativado automaticamente. Você já pode usar todas as funcionalidades do seu plano.
            </p>
            <Link to="/app/dashboard">
              <Button className="rounded-full gap-2">
                Ir para o Dashboard <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-foreground mb-2">Sessão não encontrada</h1>
            <p className="text-muted-foreground mb-6">
              Não foi possível encontrar as informações do pagamento.
            </p>
            <Link to="/app/dashboard">
              <Button variant="outline" className="rounded-full">Voltar ao Dashboard</Button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
