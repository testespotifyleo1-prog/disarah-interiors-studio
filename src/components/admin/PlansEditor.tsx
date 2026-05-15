import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Star, Plus, X, Crown } from "lucide-react";
import { FEATURE_CATALOG, type Plan, type PlanFeature } from "@/utils/planFeatures";

type EditablePlan = Plan & {
  ai_credits_monthly?: number | null;
  landing_highlights?: string[] | null;
  is_featured?: boolean;
  landing_cta_label?: string | null;
  landing_subtitle?: string | null;
};

const categories = Array.from(new Set(FEATURE_CATALOG.map((f) => f.category)));

export function PlansEditor() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<EditablePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [activeSlug, setActiveSlug] = useState<string>("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("plans")
      .select("*")
      .order("sort_order");
    if (error) {
      toast({ variant: "destructive", title: "Erro ao carregar planos", description: error.message });
    } else {
      const list = (data || []) as unknown as EditablePlan[];
      setPlans(list);
      if (list.length && !activeSlug) setActiveSlug(list[0].slug);
    }
    setLoading(false);
  }

  function update(idx: number, patch: Partial<EditablePlan>) {
    setPlans((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }

  function toggleFeature(idx: number, feature: PlanFeature) {
    setPlans((prev) =>
      prev.map((p, i) => {
        if (i !== idx) return p;
        const has = (p.features || []).includes(feature);
        return {
          ...p,
          features: has
            ? (p.features as string[]).filter((f) => f !== feature)
            : [...(p.features as string[]), feature],
        };
      })
    );
  }

  async function save(plan: EditablePlan) {
    setSaving(plan.id);
    const payload: any = {
      name: plan.name,
      slug: plan.slug,
      price: Number(plan.price) || 0,
      description: plan.description || null,
      max_users: Number(plan.max_users) || 1,
      max_stores: Number(plan.max_stores) || 1,
      features: plan.features || [],
      is_active: plan.is_active,
      sort_order: Number(plan.sort_order) || 0,
      ai_credits_monthly: Number(plan.ai_credits_monthly) || 0,
      landing_highlights: plan.landing_highlights || [],
      is_featured: !!plan.is_featured,
      landing_cta_label: plan.landing_cta_label || null,
      landing_subtitle: plan.landing_subtitle || null,
    };
    const { error } = await supabase.from("plans").update(payload).eq("id", plan.id);
    if (error) {
      toast({ variant: "destructive", title: "Erro", description: error.message });
    } else {
      toast({ title: "Plano salvo!", description: `${plan.name} atualizado e refletido no sistema e na landing page.` });
      void load();
    }
    setSaving(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Crown className="h-4 w-4 text-primary" />
            Editor de Planos
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Edite preço, limites, funcionalidades e como cada plano aparece na landing page.
            Tudo é refletido em tempo real no sistema.
          </p>
        </CardHeader>
      </Card>

      <Tabs value={activeSlug} onValueChange={setActiveSlug}>
        <TabsList className="w-full justify-start flex-wrap h-auto">
          {plans.map((p) => (
            <TabsTrigger key={p.id} value={p.slug} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              {p.is_featured && <Star className="h-3 w-3 mr-1 fill-current" />}
              {p.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {plans.map((plan, idx) => (
          <TabsContent key={plan.id} value={plan.slug} className="space-y-4 mt-4">
            {/* Básico */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Informações Básicas</CardTitle>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Nome</Label>
                  <Input value={plan.name} onChange={(e) => update(idx, { name: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Slug (identificador único)</Label>
                  <Input value={plan.slug} onChange={(e) => update(idx, { slug: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Preço mensal (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={plan.price}
                    onChange={(e) => update(idx, { price: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Ordem de exibição</Label>
                  <Input
                    type="number"
                    value={plan.sort_order}
                    onChange={(e) => update(idx, { sort_order: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Máx. de usuários</Label>
                  <Input
                    type="number"
                    value={plan.max_users}
                    onChange={(e) => update(idx, { max_users: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Máx. de lojas</Label>
                  <Input
                    type="number"
                    value={plan.max_stores}
                    onChange={(e) => update(idx, { max_stores: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Créditos IA mensais</Label>
                  <Input
                    type="number"
                    value={plan.ai_credits_monthly ?? 0}
                    onChange={(e) => update(idx, { ai_credits_monthly: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <Switch
                    checked={plan.is_active}
                    onCheckedChange={(v) => update(idx, { is_active: v })}
                  />
                  <Label className="text-xs">Ativo (visível para novas contas)</Label>
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Descrição (interna)</Label>
                  <Textarea
                    rows={2}
                    value={plan.description || ""}
                    onChange={(e) => update(idx, { description: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Landing Page */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Star className="h-4 w-4" /> Aparência na Landing Page
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={!!plan.is_featured}
                    onCheckedChange={(v) => update(idx, { is_featured: v })}
                  />
                  <Label className="text-xs">Destacar como "Mais Popular"</Label>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Subtítulo (na landing)</Label>
                    <Input
                      placeholder="Ex: Para quem está começando"
                      value={plan.landing_subtitle || ""}
                      onChange={(e) => update(idx, { landing_subtitle: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Texto do botão CTA</Label>
                    <Input
                      placeholder="Começar grátis"
                      value={plan.landing_cta_label || ""}
                      onChange={(e) => update(idx, { landing_cta_label: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Destaques (bullets exibidos no card)</Label>
                  <HighlightsEditor
                    value={plan.landing_highlights || []}
                    onChange={(v) => update(idx, { landing_highlights: v })}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Se vazio, usa as próprias funcionalidades selecionadas como bullets.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Features */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">
                  Funcionalidades incluídas{" "}
                  <Badge variant="secondary" className="ml-2">
                    {(plan.features || []).length} de {FEATURE_CATALOG.length}
                  </Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Marque tudo que esse plano vai liberar. Bloqueia automaticamente o acesso para quem não tem.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {categories.map((cat) => (
                  <div key={cat}>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                      {cat}
                    </h4>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {FEATURE_CATALOG.filter((f) => f.category === cat).map((f) => {
                        const checked = (plan.features || []).includes(f.key);
                        return (
                          <label
                            key={f.key}
                            className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                              checked
                                ? "border-primary bg-primary/5"
                                : "border-border hover:bg-muted/50"
                            }`}
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => toggleFeature(idx, f.key)}
                              className="mt-0.5"
                            />
                            <div className="text-xs leading-tight">
                              <p className="font-medium">{f.label}</p>
                              <p className="text-[10px] text-muted-foreground">{f.key}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="sticky bottom-4 flex justify-end">
              <Button
                onClick={() => save(plan)}
                disabled={saving === plan.id}
                size="lg"
                className="shadow-lg"
              >
                {saving === plan.id ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Salvar {plan.name}
              </Button>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function HighlightsEditor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          placeholder="Ex: Tudo do plano Start"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              e.preventDefault();
              onChange([...value, draft.trim()]);
              setDraft("");
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => {
            if (draft.trim()) {
              onChange([...value, draft.trim()]);
              setDraft("");
            }
          }}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {value.length > 0 && (
        <ul className="space-y-1">
          {value.map((h, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-md bg-muted/50 text-xs"
            >
              <span>• {h}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onChange(value.filter((_, idx) => idx !== i))}
              >
                <X className="h-3 w-3" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
