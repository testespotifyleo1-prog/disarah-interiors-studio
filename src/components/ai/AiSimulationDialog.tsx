import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Upload, Loader2, Share2, Download, Check, X, AlertTriangle, ArrowLeft, Search, ChevronDown, Coins, ShoppingCart, Crown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCustomerSearch } from "@/hooks/useCustomerSearch";
import { useAiCreditBalance } from "@/hooks/useAiCreditBalance";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AiCreditBalanceBadge } from "./AiCreditBalanceBadge";
import { BuyAiCreditsDialog } from "./BuyAiCreditsDialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  productId: string;
  productName: string;
  productImageUrl?: string | null;
}

type Step = "form" | "processing" | "result" | "error";

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  document?: string | null;
}

export default function AiSimulationDialog({ open, onOpenChange, productId, productName, productImageUrl }: Props) {
  const { currentAccount, currentStore, user } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const { query: custQuery, setQuery: setCustQuery, results: custResults, allCustomers, allLoaded } = useCustomerSearch({ accountId: currentAccount?.id });
  const { balance, refresh: refreshBalance } = useAiCreditBalance();
  const [custOpen, setCustOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);

  const [step, setStep] = useState<Step>("form");
  const [envFile, setEnvFile] = useState<File | null>(null);
  const [envPreview, setEnvPreview] = useState<string>("");
  const [customerId, setCustomerId] = useState<string>("");
  const [width, setWidth] = useState<string>("");
  const [height, setHeight] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [simulationId, setSimulationId] = useState<string>("");
  const [resultUrl, setResultUrl] = useState<string>("");
  const [analysis, setAnalysis] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);

  const selectedCustomer = allCustomers.find((c) => c.id === customerId) as Customer | undefined;
  const customerListToShow: Customer[] = (custQuery.trim() ? custResults : allCustomers.slice(0, 50)) as Customer[];

  useEffect(() => {
    if (!open) return;
    setStep("form");
    setEnvFile(null);
    setEnvPreview("");
    setCustomerId("");
    setCustQuery("");
    setWidth("");
    setHeight("");
    setNotes("");
    setErrorMsg("");
    setSimulationId("");
    setResultUrl("");
    setAnalysis(null);
    setSuggestions([]);
  }, [open]);

  const handleFile = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast({ variant: "destructive", title: "Selecione uma imagem" });
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast({ variant: "destructive", title: "Imagem muito grande", description: "Máximo 10MB" });
      return;
    }
    setEnvFile(f);
    const reader = new FileReader();
    reader.onload = () => setEnvPreview(reader.result as string);
    reader.readAsDataURL(f);
  };

  const startSimulation = async () => {
    if (!envFile || !currentAccount?.id || !user?.id) {
      toast({ variant: "destructive", title: "Envie uma foto do ambiente" });
      return;
    }
    if (balance.total < 1) {
      toast({
        variant: "destructive",
        title: "Sem créditos disponíveis",
        description: "Compre um pacote ou faça upgrade do seu plano para continuar.",
      });
      setBuyOpen(true);
      return;
    }
    setStep("processing");
    setErrorMsg("");

    try {
      const { data: created, error: insErr } = await supabase
        .from("ai_simulations")
        .insert({
          account_id: currentAccount.id,
          store_id: currentStore?.id || null,
          user_id: user.id,
          product_id: productId,
          customer_id: customerId || null,
          environment_image_url: "pending",
          space_width_cm: width ? Number(width) : null,
          space_height_cm: height ? Number(height) : null,
          user_notes: notes || null,
          status: "pending",
        })
        .select("id")
        .single();

      if (insErr || !created) throw new Error(insErr?.message || "Falha ao criar simulação");
      const simId = created.id;
      setSimulationId(simId);

      const ext = envFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${currentAccount.id}/${simId}/environment.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("ai-simulations")
        .upload(path, envFile, { contentType: envFile.type, upsert: true });
      if (upErr) throw new Error(`Upload falhou: ${upErr.message}`);
      const { data: pub } = supabase.storage.from("ai-simulations").getPublicUrl(path);
      const envUrl = pub.publicUrl;

      await supabase.from("ai_simulations").update({ environment_image_url: envUrl }).eq("id", simId);

      const { data, error } = await supabase.functions.invoke("simulate-product-environment", {
        body: { simulation_id: simId },
      });

      if (data?.error === "insufficient_credits" || (error as any)?.context?.status === 402) {
        await refreshBalance();
        toast({
          variant: "destructive",
          title: "Sem créditos",
          description: "Seu saldo acabou. Compre mais créditos para continuar.",
        });
        setBuyOpen(true);
        setStep("form");
        return;
      }
      if (error) throw new Error(error.message || "Falha na geração");
      if (data?.error) throw new Error(data.error);

      await refreshBalance();
      setResultUrl(data.generated_image_url);
      setAnalysis(data.analysis || null);
      setSuggestions(data.suggestions || []);
      setStep("result");
    } catch (e: any) {
      setErrorMsg(e.message || "Erro inesperado");
      setStep("error");
    }
  };

  const shareWhatsApp = async () => {
    const customer = selectedCustomer;
    const phone = customer?.phone?.replace(/\D/g, "");
    const lines = [
      `Olá${customer ? `, ${customer.name.split(" ")[0]}` : ""}! 👋`,
      ``,
      `Aqui está a simulação do produto *${productName}* no seu ambiente:`,
      resultUrl,
      ``,
    ];
    if (analysis?.summary) lines.push(`💡 ${analysis.summary}`, ``);
    if (analysis?.harmony_score != null) lines.push(`✨ Harmonia visual: ${analysis.harmony_score}/10`, ``);
    lines.push(`Qualquer dúvida estamos à disposição!`);
    const text = encodeURIComponent(lines.join("\n"));
    const url = phone ? `https://wa.me/55${phone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, "_blank");
  };

  const downloadImage = async () => {
    if (!resultUrl) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = `simulacao-${productName.replace(/\s+/g, "-")}.jpg`;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const fitsBadge = () => {
    if (!analysis?.fits_well) return null;
    if (analysis.fits_well === "sim")
      return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 gap-1"><Check className="h-3 w-3" /> Combina muito bem</Badge>;
    if (analysis.fits_well === "parcial")
      return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/30 gap-1"><AlertTriangle className="h-3 w-3" /> Combina parcialmente</Badge>;
    return <Badge className="bg-destructive/10 text-destructive border-destructive/30 gap-1"><X className="h-3 w-3" /> Não recomendado</Badge>;
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Simulação Inteligente no Ambiente
              </DialogTitle>
              <DialogDescription className="mt-1">
                Envie uma foto do espaço do cliente e veja como <strong>{productName}</strong> ficaria, com análise de IA.
              </DialogDescription>
            </div>
            <AiCreditBalanceBadge onClick={() => setBuyOpen(true)} />
          </div>
        </DialogHeader>

        {step === "form" && (
          <div className="space-y-4">
            <div>
              <Label>Foto do ambiente do cliente *</Label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] || null)}
              />
              {!envPreview ? (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="mt-2 w-full border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary hover:bg-accent/40 transition"
                >
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium">Clique para enviar a foto do ambiente</p>
                  <p className="text-xs text-muted-foreground mt-1">JPG, PNG até 10MB</p>
                </button>
              ) : (
                <div className="mt-2 relative">
                  <img src={envPreview} alt="Ambiente" className="w-full rounded-lg max-h-72 object-contain bg-muted" />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => fileRef.current?.click()}
                    className="absolute top-2 right-2"
                  >
                    Trocar
                  </Button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Largura disponível (cm)</Label>
                <Input type="number" value={width} onChange={(e) => setWidth(e.target.value)} placeholder="ex: 200" />
              </div>
              <div>
                <Label>Altura disponível (cm)</Label>
                <Input type="number" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="ex: 240" />
              </div>
            </div>

            <div>
              <Label>Cliente (opcional — para histórico e WhatsApp)</Label>
              <Popover open={custOpen} onOpenChange={setCustOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="mt-1 w-full flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm text-left hover:bg-accent/40 transition"
                  >
                    <span className={selectedCustomer ? "" : "text-muted-foreground"}>
                      {selectedCustomer
                        ? `${selectedCustomer.name}${selectedCustomer.phone ? ` — ${selectedCustomer.phone}` : ""}`
                        : "Selecione um cliente..."}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                  <div className="p-2 border-b">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        autoFocus
                        value={custQuery}
                        onChange={(e) => setCustQuery(e.target.value)}
                        placeholder={allLoaded ? `Buscar em ${allCustomers.length} clientes (nome, CPF, telefone)...` : "Carregando clientes..."}
                        className="pl-8 h-9"
                      />
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto scrollbar-thin">
                    {selectedCustomer && (
                      <button
                        type="button"
                        onClick={() => { setCustomerId(""); setCustOpen(false); }}
                        className="w-full text-left px-3 py-2 text-xs text-muted-foreground hover:bg-accent border-b"
                      >
                        ✕ Limpar seleção
                      </button>
                    )}
                    {customerListToShow.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        {custQuery.trim() ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
                      </p>
                    ) : (
                      customerListToShow.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => { setCustomerId(c.id); setCustOpen(false); setCustQuery(""); }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-accent flex flex-col ${customerId === c.id ? "bg-accent" : ""}`}
                        >
                          <span className="font-medium">{c.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {[c.document, c.phone].filter(Boolean).join(" • ") || "Sem dados de contato"}
                          </span>
                        </button>
                      ))
                    )}
                    {!custQuery.trim() && allCustomers.length > 50 && (
                      <p className="text-[11px] text-muted-foreground text-center py-2 border-t">
                        Mostrando 50 de {allCustomers.length}. Use a busca para filtrar.
                      </p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label>Observações (opcional)</Label>
              <Textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ex: cliente prefere posicionar próximo à janela"
              />
            </div>

            {balance.total === 0 && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Você não tem créditos disponíveis. Cada simulação consome 1 crédito.</span>
                </div>
                <Button size="sm" onClick={() => setBuyOpen(true)} className="gap-1 shrink-0">
                  <ShoppingCart className="h-3.5 w-3.5" /> Comprar
                </Button>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              {balance.total === 0 ? (
                <Button onClick={() => setBuyOpen(true)} className="gap-2">
                  <ShoppingCart className="h-4 w-4" /> Comprar créditos
                </Button>
              ) : (
                <Button onClick={startSimulation} disabled={!envFile} className="gap-2">
                  <Sparkles className="h-4 w-4" /> Gerar simulação <span className="text-xs opacity-80">(1 crédito)</span>
                </Button>
              )}
            </DialogFooter>

          </div>
        )}

        {step === "processing" && (
          <div className="py-12 text-center space-y-4">
            <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
            <div>
              <p className="font-medium">Gerando simulação realista…</p>
              <p className="text-sm text-muted-foreground mt-1">
                A IA está colocando o produto no ambiente e analisando o encaixe. Isso leva ~20–40s.
              </p>
            </div>
          </div>
        )}

        {step === "error" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">Não foi possível gerar a simulação</p>
                  <p className="text-sm text-muted-foreground mt-1">{errorMsg}</p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
              <Button onClick={() => setStep("form")} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Tentar novamente
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "result" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Ambiente original</p>
                <img src={envPreview} alt="Original" className="w-full rounded-lg bg-muted object-contain max-h-64" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Com o produto</p>
                <img src={resultUrl} alt="Simulação" className="w-full rounded-lg bg-muted object-contain max-h-64" />
              </div>
            </div>

            {analysis && (
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {fitsBadge()}
                    {analysis.harmony_score != null && (
                      <Badge variant="outline">Harmonia: {analysis.harmony_score}/10</Badge>
                    )}
                    {analysis.size_assessment && (
                      <Badge variant="outline">Tamanho: {analysis.size_assessment}</Badge>
                    )}
                  </div>
                  {analysis.summary && <p className="text-sm">{analysis.summary}</p>}
                  {(analysis.pros?.length || analysis.cons?.length) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      {analysis.pros?.length > 0 && (
                        <div>
                          <p className="font-medium text-emerald-500 mb-1">Pontos fortes</p>
                          <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                            {analysis.pros.map((p: string, i: number) => <li key={i}>{p}</li>)}
                          </ul>
                        </div>
                      )}
                      {analysis.cons?.length > 0 && (
                        <div>
                          <p className="font-medium text-amber-500 mb-1">Ressalvas</p>
                          <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                            {analysis.cons.map((p: string, i: number) => <li key={i}>{p}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {suggestions.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">💡 Alternativas do seu catálogo</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {suggestions.map((s, i) => (
                    <Card key={i} className="overflow-hidden">
                      <CardContent className="p-2 space-y-1">
                        {s.image_url && <img src={s.image_url} alt={s.name} className="w-full h-24 object-cover rounded" />}
                        <p className="text-xs font-medium line-clamp-2">{s.name}</p>
                        <p className="text-xs text-primary font-semibold">R$ {Number(s.price || 0).toFixed(2)}</p>
                        <p className="text-[10px] text-muted-foreground line-clamp-2">{s.reason}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter className="flex-wrap gap-2">
              <Button variant="outline" onClick={downloadImage} className="gap-2">
                <Download className="h-4 w-4" /> Baixar
              </Button>
              <Button onClick={shareWhatsApp} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                <Share2 className="h-4 w-4" /> Enviar pelo WhatsApp
              </Button>
              <Button variant="secondary" onClick={() => setStep("form")}>Nova simulação</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
    <BuyAiCreditsDialog open={buyOpen} onOpenChange={setBuyOpen} />
    </>
  );
}
