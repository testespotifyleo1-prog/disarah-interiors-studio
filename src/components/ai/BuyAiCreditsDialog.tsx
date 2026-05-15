import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Coins, CreditCard, QrCode, Check, Sparkles, Star, Upload, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { useAiCreditBalance } from "@/hooks/useAiCreditBalance";
import { generatePixPayload, getPixQrCodeUrl } from "@/utils/pixUtils";

interface Pkg {
  id: string;
  name: string;
  credits: number;
  price_cents: number;
  description: string | null;
  highlight: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const PIX_KEY_FALLBACK = "contato@typoserp.com.br";

export function BuyAiCreditsDialog({ open, onOpenChange }: Props) {
  const { currentAccount, user } = useAuth();
  const { balance, refresh } = useAiCreditBalance();
  const { toast } = useToast();

  const [packages, setPackages] = useState<Pkg[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPkg, setSelectedPkg] = useState<Pkg | null>(null);
  const [tab, setTab] = useState<"card" | "pix">("card");

  // Configurable PIX key (from site_settings — same used by plan payments)
  const [pixKey, setPixKey] = useState<string>(PIX_KEY_FALLBACK);
  const [pixHolder, setPixHolder] = useState<string>("Typos ERP");
  const [pixKeyType, setPixKeyType] = useState<string>("");

  // Stripe
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [creatingSession, setCreatingSession] = useState(false);

  // PIX
  const [pixSubmitting, setPixSubmitting] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [pixSubmitted, setPixSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedPkg(null);
    setClientSecret(null);
    setProofFile(null);
    setPixSubmitted(false);
    setTab("card");
    void load();
    void loadPixSettings();
  }, [open]);

  const loadPixSettings = async () => {
    const { data } = await supabase
      .from("site_settings")
      .select("key, value")
      .in("key", ["pix_key", "pix_holder_name", "pix_key_type"]);
    if (data) {
      const map: Record<string, string> = {};
      data.forEach((r: any) => { map[r.key] = r.value; });
      if (map.pix_key) setPixKey(map.pix_key);
      if (map.pix_holder_name) setPixHolder(map.pix_holder_name);
      if (map.pix_key_type) setPixKeyType(map.pix_key_type);
    }
  };

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("ai_credit_packages")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("credits", { ascending: true });
    setPackages((data as Pkg[]) || []);
    setLoading(false);
  };

  const startStripe = async (pkg: Pkg) => {
    if (!currentAccount?.id) return;
    setSelectedPkg(pkg);
    setTab("card");
    setCreatingSession(true);
    setClientSecret(null);
    try {
      const { data, error } = await supabase.functions.invoke("create-ai-credits-checkout", {
        body: {
          package_id: pkg.id,
          account_id: currentAccount.id,
          environment: getStripeEnvironment(),
          returnUrl: `${window.location.origin}/app/ai-simulations?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        },
      });
      if (error || !data?.clientSecret) throw new Error(error?.message || "Falha ao iniciar checkout");
      setClientSecret(data.clientSecret);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message });
      setSelectedPkg(null);
    } finally {
      setCreatingSession(false);
    }
  };

  const submitPix = async () => {
    if (!selectedPkg || !currentAccount?.id || !user?.id) return;
    if (!proofFile) {
      toast({ variant: "destructive", title: "Anexe o comprovante de pagamento" });
      return;
    }
    setPixSubmitting(true);
    try {
      // Upload proof
      const ext = proofFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${currentAccount.id}/ai-credits/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("payment-proofs")
        .upload(path, proofFile, { contentType: proofFile.type });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("ai_credit_purchases").insert({
        account_id: currentAccount.id,
        user_id: user.id,
        package_id: selectedPkg.id,
        credits: selectedPkg.credits,
        price_cents: selectedPkg.price_cents,
        payment_method: "pix",
        status: "pending",
        pix_proof_url: path,
      });
      if (insErr) throw insErr;

      setPixSubmitted(true);
      toast({
        title: "Comprovante enviado! ✅",
        description: "Aprovamos manualmente em até 1 hora. Você será notificado.",
      });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message });
    } finally {
      setPixSubmitting(false);
    }
  };

  const copyPix = () => {
    void navigator.clipboard.writeText(pixKey);
    toast({ title: "Chave Pix copiada" });
  };

  const formatBRL = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
  const pricePerCredit = (pkg: Pkg) => formatBRL(Math.round(pkg.price_cents / pkg.credits));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            Comprar Créditos de IA
          </DialogTitle>
          <DialogDescription className="flex items-center justify-between flex-wrap gap-2">
            <span>Cada simulação consome 1 crédito. Créditos comprados <strong>nunca expiram</strong>.</span>
            <Badge variant="outline" className="gap-1">
              <Coins className="h-3 w-3" /> Saldo atual: <strong className="ml-1">{balance.total}</strong>
            </Badge>
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: choose package */}
        {!selectedPkg && (
          <div className="space-y-3">
            {loading ? (
              <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
            ) : packages.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">
                Nenhum pacote disponível no momento. Entre em contato com o suporte.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {packages.map((pkg) => (
                  <Card
                    key={pkg.id}
                    className={`relative transition hover:border-primary cursor-pointer ${pkg.highlight ? "border-primary border-2 shadow-lg" : ""}`}
                    onClick={() => setSelectedPkg(pkg)}
                  >
                    {pkg.highlight && (
                      <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary gap-1">
                        <Star className="h-3 w-3" /> Mais vendido
                      </Badge>
                    )}
                    <CardContent className="pt-5 text-center space-y-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">{pkg.name}</p>
                      <p className="text-3xl font-bold text-primary">
                        {pkg.credits}
                        <span className="text-sm text-muted-foreground font-normal ml-1">créd.</span>
                      </p>
                      <p className="text-2xl font-semibold">{formatBRL(pkg.price_cents)}</p>
                      <p className="text-[11px] text-muted-foreground">{pricePerCredit(pkg)} por simulação</p>
                      {pkg.description && (
                        <p className="text-xs text-muted-foreground border-t pt-2 mt-2">{pkg.description}</p>
                      )}
                      <Button size="sm" className="w-full mt-2 gap-1">
                        <Sparkles className="h-3.5 w-3.5" /> Escolher
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: payment */}
        {selectedPkg && (
          <div className="space-y-4">
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-4 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-semibold">{selectedPkg.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedPkg.credits} créditos • {formatBRL(selectedPkg.price_cents)}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setSelectedPkg(null); setClientSecret(null); }}>
                  Trocar pacote
                </Button>
              </CardContent>
            </Card>

            {!pixSubmitted ? (
              <Tabs value={tab} onValueChange={(v) => { setTab(v as any); if (v === "card" && !clientSecret) void startStripe(selectedPkg); }}>
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="card" className="gap-2"><CreditCard className="h-4 w-4" /> Cartão (instantâneo)</TabsTrigger>
                  <TabsTrigger value="pix" className="gap-2"><QrCode className="h-4 w-4" /> Pix (até 1h)</TabsTrigger>
                </TabsList>

                <TabsContent value="card" className="mt-4">
                  {creatingSession || (!clientSecret && tab === "card") ? (
                    <div className="py-12 text-center">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                      <p className="text-sm text-muted-foreground mt-3">Preparando pagamento seguro…</p>
                      {!creatingSession && !clientSecret && (
                        <Button className="mt-3" onClick={() => void startStripe(selectedPkg)}>Iniciar pagamento</Button>
                      )}
                    </div>
                  ) : clientSecret ? (
                    <div id="ai-credits-checkout" className="rounded-lg border overflow-hidden">
                      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret: async () => clientSecret }}>
                        <EmbeddedCheckout />
                      </EmbeddedCheckoutProvider>
                    </div>
                  ) : null}
                  <p className="text-[11px] text-muted-foreground mt-2 text-center">
                    💡 Após confirmação do cartão, os créditos são liberados <strong>imediatamente</strong>.
                  </p>
                </TabsContent>

                <TabsContent value="pix" className="mt-4 space-y-3">
                  <Card>
                    <CardContent className="pt-4 space-y-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">
                          1. Escaneie o QR Code ou copie a chave abaixo para pagar <strong>{formatBRL(selectedPkg.price_cents)}</strong>:
                        </p>
                        <div className="grid sm:grid-cols-[auto_1fr] gap-3 items-center">
                          {(() => {
                            const payload = generatePixPayload({
                              pixKey,
                              merchantName: pixHolder,
                              merchantCity: "BRASIL",
                              amount: selectedPkg.price_cents / 100,
                              description: `Creditos IA ${selectedPkg.credits}`,
                            });
                            const qr = getPixQrCodeUrl(payload, 180);
                            return (
                              <div className="bg-white rounded-lg p-2 border mx-auto">
                                <img src={qr} alt="QR Code PIX" className="w-[160px] h-[160px]" />
                              </div>
                            );
                          })()}
                          <div className="space-y-2">
                            <div>
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Titular</p>
                              <p className="text-sm font-medium">{pixHolder}</p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Chave PIX{pixKeyType ? ` (${pixKeyType})` : ""}</p>
                              <div className="flex items-center gap-2 bg-muted rounded p-2">
                                <code className="text-xs flex-1 break-all">{pixKey}</code>
                                <Button size="sm" variant="ghost" onClick={copyPix} className="gap-1 shrink-0">
                                  <Copy className="h-3.5 w-3.5" /> Copiar
                                </Button>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="w-full gap-1.5"
                              onClick={() => {
                                const payload = generatePixPayload({
                                  pixKey,
                                  merchantName: pixHolder,
                                  merchantCity: "BRASIL",
                                  amount: selectedPkg.price_cents / 100,
                                  description: `Creditos IA ${selectedPkg.credits}`,
                                });
                                void navigator.clipboard.writeText(payload);
                                toast({ title: "Código PIX copia-e-cola copiado!" });
                              }}
                            >
                              <Copy className="h-3.5 w-3.5" /> Copiar PIX copia-e-cola
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">2. Anexe o comprovante:</p>
                        <label className="block">
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            className="hidden"
                            onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                          />
                          <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary transition">
                            <Upload className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                            <p className="text-sm">{proofFile ? proofFile.name : "Clique para anexar comprovante"}</p>
                          </div>
                        </label>
                      </div>
                      <Button onClick={submitPix} disabled={pixSubmitting || !proofFile} className="w-full gap-2">
                        {pixSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        Enviar comprovante
                      </Button>
                      <p className="text-[11px] text-muted-foreground text-center">
                        ⏱️ Aprovação manual em até 1 hora durante horário comercial.
                      </p>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            ) : (
              <Card className="border-emerald-500/40 bg-emerald-500/5">
                <CardContent className="pt-6 text-center space-y-2">
                  <div className="h-12 w-12 rounded-full bg-emerald-500/20 mx-auto flex items-center justify-center">
                    <Check className="h-6 w-6 text-emerald-500" />
                  </div>
                  <p className="font-semibold">Comprovante enviado!</p>
                  <p className="text-sm text-muted-foreground">
                    Vamos liberar seus <strong>{selectedPkg.credits} créditos</strong> em até 1 hora.
                    Você verá o saldo atualizado automaticamente.
                  </p>
                  <Button onClick={() => { onOpenChange(false); void refresh(); }} className="mt-2">Fechar</Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
