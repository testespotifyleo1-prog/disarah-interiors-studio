import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, QrCode } from "lucide-react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";

interface StripeEmbeddedCheckoutProps {
  priceId: string;
  quantity?: number;
  customerEmail?: string;
  userId?: string;
  accountId?: string;
  returnUrl?: string;
  paymentMethod?: "card" | "pix";
}

function formatCheckoutError(message: string, paymentMethod?: "card" | "pix") {
  if (paymentMethod === "pix" && /pix/i.test(message)) {
    return "O PIX não está disponível nesta conta de pagamentos no ambiente atual. Ative o PIX na conta de pagamentos ou use cartão.";
  }

  return message || "Não foi possível iniciar o checkout.";
}

export function StripeEmbeddedCheckout({
  priceId,
  quantity,
  customerEmail,
  userId,
  accountId,
  returnUrl,
  paymentMethod,
}: StripeEmbeddedCheckoutProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const createCheckoutSession = async () => {
      setIsLoading(true);
      setCheckoutError(null);
      setClientSecret(null);

      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          priceId,
          quantity,
          customerEmail,
          userId,
          accountId,
          returnUrl,
          environment: getStripeEnvironment(),
          paymentMethod,
        },
      });

      if (!isMounted) return;

      if (error || !data?.clientSecret) {
        const rawMessage = data?.error || error?.message || "Failed to create checkout session";
        setCheckoutError(formatCheckoutError(rawMessage, paymentMethod));
        setIsLoading(false);
        return;
      }

      setClientSecret(data.clientSecret);
      setIsLoading(false);
    };

    void createCheckoutSession();

    return () => {
      isMounted = false;
    };
  }, [accountId, customerEmail, paymentMethod, priceId, quantity, returnUrl, userId]);

  if (isLoading) {
    return (
      <div
        id="checkout"
        className="flex min-h-[320px] items-center justify-center rounded-lg border border-border bg-card px-6 py-10 text-center"
      >
        <div className="space-y-3">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
          <div>
            <p className="font-medium text-foreground">Preparando o checkout</p>
            <p className="text-sm text-muted-foreground">Aguarde um instante.</p>
          </div>
        </div>
      </div>
    );
  }

  if (checkoutError) {
    return (
      <div
        id="checkout"
        className="rounded-lg border border-destructive/20 bg-destructive/5 p-5 text-left"
      >
        <div className="flex items-start gap-3">
          {paymentMethod === "pix" ? (
            <QrCode className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          ) : (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          )}
          <div className="space-y-1">
            <p className="font-medium text-foreground">Não foi possível iniciar este pagamento</p>
            <p className="text-sm text-muted-foreground">{checkoutError}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!clientSecret) {
    return null;
  }

  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ clientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
