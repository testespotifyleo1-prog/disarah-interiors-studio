import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Share2, Trash2, Search, ImageOff, X, ShoppingCart, Coins } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAiSimulationEnabled } from "@/hooks/useAiSimulationEnabled";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AiCreditBalanceBadge } from "@/components/ai/AiCreditBalanceBadge";
import { BuyAiCreditsDialog } from "@/components/ai/BuyAiCreditsDialog";
import { useAiCreditBalance } from "@/hooks/useAiCreditBalance";
import { useSearchParams } from "react-router-dom";

interface Sim {
  id: string;
  status: string;
  created_at: string;
  environment_image_url: string;
  generated_image_url: string | null;
  analysis: any;
  suggestions: any;
  error_message: string | null;
  product_id: string;
  customer_id: string | null;
  user_notes: string | null;
}

export default function AiSimulations() {
  const { currentAccount } = useAuth();
  const { toast } = useToast();
  const { enabled, loading: flagLoading } = useAiSimulationEnabled();
  const { refresh: refreshBalance } = useAiCreditBalance();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sims, setSims] = useState<Sim[]>([]);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Record<string, { name: string }>>({});
  const [customers, setCustomers] = useState<Record<string, { name: string; phone: string | null }>>({});
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<Sim | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);

  // Pós-checkout Stripe — exibe sucesso e refresca saldo
  useEffect(() => {
    if (searchParams.get("checkout") === "success") {
      toast({ title: "Pagamento confirmado! 🎉", description: "Seus créditos foram liberados." });
      void refreshBalance();
      searchParams.delete("checkout");
      searchParams.delete("session_id");
      setSearchParams(searchParams, { replace: true });
    }
  }, []);

  useEffect(() => {
    if (!currentAccount?.id) return;
    void load();
  }, [currentAccount?.id]);


  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("ai_simulations")
      .select("*")
      .eq("account_id", currentAccount!.id)
      .order("created_at", { ascending: false })
      .limit(200);
    const list = (data || []) as Sim[];
    setSims(list);

    const productIds = Array.from(new Set(list.map((s) => s.product_id)));
    const customerIds = Array.from(new Set(list.map((s) => s.customer_id).filter(Boolean) as string[]));
    if (productIds.length) {
      const { data: ps } = await supabase.from("products").select("id, name").in("id", productIds);
      setProducts(Object.fromEntries((ps || []).map((p: any) => [p.id, { name: p.name }])));
    }
    if (customerIds.length) {
      const { data: cs } = await supabase.from("customers").select("id, name, phone").in("id", customerIds);
      setCustomers(Object.fromEntries((cs || []).map((c: any) => [c.id, { name: c.name, phone: c.phone }])));
    }
    setLoading(false);
  };

  const removeOne = async (id: string) => {
    if (!confirm("Excluir esta simulação?")) return;
    const { error } = await supabase.from("ai_simulations").delete().eq("id", id);
    if (error) {
      toast({ variant: "destructive", title: "Erro", description: error.message });
      return;
    }
    setSims((prev) => prev.filter((s) => s.id !== id));
    toast({ title: "Simulação excluída" });
  };

  const shareWa = (s: Sim) => {
    if (!s.generated_image_url) return;
    const c = s.customer_id ? customers[s.customer_id] : null;
    const phone = c?.phone?.replace(/\D/g, "");
    const productName = products[s.product_id]?.name || "produto";
    const lines = [
      `Olá${c ? `, ${c.name.split(" ")[0]}` : ""}! 👋`,
      ``,
      `Aqui está a simulação do produto *${productName}* no seu ambiente:`,
      s.generated_image_url,
    ];
    if (s.analysis?.summary) lines.push(``, `💡 ${s.analysis.summary}`);
    const text = encodeURIComponent(lines.join("\n"));
    const url = phone ? `https://wa.me/55${phone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, "_blank");
  };

  const filtered = sims.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const pn = products[s.product_id]?.name?.toLowerCase() || "";
    const cn = s.customer_id ? customers[s.customer_id]?.name?.toLowerCase() || "" : "";
    return pn.includes(q) || cn.includes(q);
  });

  if (flagLoading) return <div className="p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  if (!enabled) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <Card>
          <CardContent className="pt-6 text-center space-y-2">
            <Sparkles className="h-10 w-10 mx-auto text-muted-foreground" />
            <h2 className="text-lg font-semibold">Simulação Inteligente — Premium</h2>
            <p className="text-sm text-muted-foreground">
              Esta funcionalidade não está habilitada para sua conta. Fale com o suporte para ativar.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Simulações Inteligentes
          </h1>
          <p className="text-sm text-muted-foreground">Histórico de simulações de produtos no ambiente do cliente</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <AiCreditBalanceBadge onClick={() => setBuyOpen(true)} />
          <Button size="sm" variant="outline" onClick={() => setBuyOpen(true)} className="gap-1.5">
            <ShoppingCart className="h-3.5 w-3.5" /> Comprar créditos
          </Button>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por produto ou cliente…" className="pl-8" />
          </div>
        </div>
      </div>


      {loading ? (
        <div className="py-20 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="pt-10 pb-10 text-center text-muted-foreground">
          <ImageOff className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p>Nenhuma simulação ainda. Acesse Produtos e clique no ícone <strong>✨ Simular</strong>.</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((s) => (
            <Card key={s.id} className="overflow-hidden group">
              <button
                type="button"
                onClick={() => setPreview(s)}
                className="block w-full aspect-video bg-muted relative"
              >
                {s.generated_image_url ? (
                  <img src={s.generated_image_url} alt="Simulação" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
                    {s.status === "failed" ? "Falhou" : s.status}
                  </div>
                )}
                {s.analysis?.harmony_score != null && (
                  <Badge className="absolute top-2 right-2 bg-background/80 text-foreground border">
                    {s.analysis.harmony_score}/10
                  </Badge>
                )}
              </button>
              <CardContent className="p-3 space-y-2">
                <div>
                  <p className="font-medium text-sm line-clamp-1">{products[s.product_id]?.name || "Produto"}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {s.customer_id ? customers[s.customer_id]?.name || "Cliente" : "Sem cliente"} • {new Date(s.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="flex-1 gap-1 text-xs h-8" onClick={() => shareWa(s)} disabled={!s.generated_image_url}>
                    <Share2 className="h-3 w-3" /> WhatsApp
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => removeOne(s.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{preview ? products[preview.product_id]?.name || "Simulação" : ""}</DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Ambiente</p>
                  <img src={preview.environment_image_url} className="w-full rounded bg-muted object-contain max-h-72" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Com produto</p>
                  {preview.generated_image_url ? (
                    <img src={preview.generated_image_url} className="w-full rounded bg-muted object-contain max-h-72" />
                  ) : <p className="text-sm text-destructive">{preview.error_message || "Sem imagem"}</p>}
                </div>
              </div>
              {preview.analysis?.summary && (
                <p className="text-sm bg-muted/40 p-3 rounded">{preview.analysis.summary}</p>
              )}
              {preview.user_notes && (
                <p className="text-xs text-muted-foreground"><strong>Obs:</strong> {preview.user_notes}</p>
              )}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => shareWa(preview)} disabled={!preview.generated_image_url} className="gap-2">
                  <Share2 className="h-4 w-4" /> Enviar pelo WhatsApp
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BuyAiCreditsDialog open={buyOpen} onOpenChange={setBuyOpen} />
    </div>
  );
}
