import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, Sparkles, Search, Save, Coins, Package as PackageIcon, Plus, Trash2,
  Star, CheckCircle2, XCircle, Eye, Crown,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface Account {
  id: string;
  name: string;
  ai_simulation_enabled: boolean | null;
  plan_id: string | null;
}

interface Plan {
  id: string;
  name: string;
  slug: string;
  ai_credits_monthly: number;
}

interface Pkg {
  id: string;
  name: string;
  credits: number;
  price_cents: number;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  highlight: boolean;
}

interface Purchase {
  id: string;
  account_id: string;
  credits: number;
  price_cents: number;
  status: string;
  payment_method: string;
  pix_proof_url: string | null;
  created_at: string;
  rejection_reason: string | null;
  account?: { name: string };
}

interface BalanceRow {
  account_id: string;
  plan_credits: number;
  purchased_credits: number;
  total_consumed: number;
}

export function AiSimulationManagement() {
  const { toast } = useToast();
  const [globalEnabled, setGlobalEnabled] = useState<boolean>(true);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [balances, setBalances] = useState<Record<string, BalanceRow>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stats, setStats] = useState({ total: 0, succeeded: 0, failed: 0 });

  // Adjust dialog
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustAcc, setAdjustAcc] = useState<Account | null>(null);
  const [adjustDelta, setAdjustDelta] = useState<string>("");
  const [adjustNote, setAdjustNote] = useState<string>("");

  // Package dialog
  const [pkgOpen, setPkgOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState<Partial<Pkg> | null>(null);

  useEffect(() => { void load(); }, []);

  const load = async () => {
    setLoading(true);
    const [
      { data: setting },
      { data: accs },
      { data: simAll },
      { data: plansData },
      { data: pkgs },
      { data: pendingPurchases },
      { data: bals },
    ] = await Promise.all([
      supabase.from("site_settings").select("value").eq("key", "ai_simulation_enabled_global").maybeSingle(),
      supabase.from("accounts").select("id, name, ai_simulation_enabled, plan_id").order("name"),
      supabase.from("ai_simulations").select("status"),
      supabase.from("plans").select("id, name, slug, ai_credits_monthly").order("sort_order"),
      supabase.from("ai_credit_packages").select("*").order("sort_order").order("credits"),
      supabase.from("ai_credit_purchases").select("*, account:accounts(name)").order("created_at", { ascending: false }).limit(50),
      supabase.from("ai_credit_balances").select("account_id, plan_credits, purchased_credits, total_consumed"),
    ]);

    setGlobalEnabled((setting?.value ?? "true") !== "false");
    setAccounts((accs as Account[]) || []);
    setPlans((plansData as Plan[]) || []);
    setPackages((pkgs as Pkg[]) || []);
    setPurchases((pendingPurchases as Purchase[]) || []);

    const balMap: Record<string, BalanceRow> = {};
    (bals || []).forEach((b: any) => { balMap[b.account_id] = b; });
    setBalances(balMap);

    const list = simAll || [];
    setStats({
      total: list.length,
      succeeded: list.filter((s: any) => s.status === "succeeded").length,
      failed: list.filter((s: any) => s.status === "failed").length,
    });
    setLoading(false);
  };

  const saveGlobal = async (val: boolean) => {
    setSavingGlobal(true);
    const { error } = await supabase
      .from("site_settings")
      .upsert({ key: "ai_simulation_enabled_global", value: val ? "true" : "false" }, { onConflict: "key" });
    setSavingGlobal(false);
    if (error) { toast({ variant: "destructive", title: "Erro", description: error.message }); return; }
    setGlobalEnabled(val);
    toast({ title: val ? "Funcionalidade ativada globalmente" : "Funcionalidade desativada globalmente" });
  };

  const toggleAccount = async (acc: Account, val: boolean | null) => {
    const { error } = await supabase.from("accounts").update({ ai_simulation_enabled: val }).eq("id", acc.id);
    if (error) { toast({ variant: "destructive", title: "Erro", description: error.message }); return; }
    setAccounts((prev) => prev.map((a) => (a.id === acc.id ? { ...a, ai_simulation_enabled: val } : a)));
  };

  const updatePlanCredits = async (planId: string, credits: number) => {
    const { error } = await supabase.from("plans").update({ ai_credits_monthly: credits }).eq("id", planId);
    if (error) { toast({ variant: "destructive", title: "Erro", description: error.message }); return; }
    setPlans((p) => p.map((pl) => pl.id === planId ? { ...pl, ai_credits_monthly: credits } : pl));
    toast({ title: "Créditos do plano atualizados" });
  };

  const savePackage = async () => {
    if (!editingPkg?.name || !editingPkg.credits || editingPkg.price_cents == null) {
      toast({ variant: "destructive", title: "Preencha nome, créditos e preço" }); return;
    }
    const payload = {
      name: editingPkg.name,
      credits: Number(editingPkg.credits),
      price_cents: Number(editingPkg.price_cents),
      description: editingPkg.description || null,
      is_active: editingPkg.is_active ?? true,
      sort_order: Number(editingPkg.sort_order ?? 0),
      highlight: editingPkg.highlight ?? false,
    };
    const op = editingPkg.id
      ? supabase.from("ai_credit_packages").update(payload).eq("id", editingPkg.id)
      : supabase.from("ai_credit_packages").insert(payload);
    const { error } = await op;
    if (error) { toast({ variant: "destructive", title: "Erro", description: error.message }); return; }
    toast({ title: editingPkg.id ? "Pacote atualizado" : "Pacote criado" });
    setPkgOpen(false); setEditingPkg(null);
    void load();
  };

  const deletePackage = async (id: string) => {
    if (!confirm("Excluir este pacote?")) return;
    const { error } = await supabase.from("ai_credit_packages").update({ is_active: false }).eq("id", id);
    if (error) { toast({ variant: "destructive", title: "Erro", description: error.message }); return; }
    toast({ title: "Pacote desativado" });
    void load();
  };

  const adjustCredits = async () => {
    if (!adjustAcc || !adjustDelta) return;
    const delta = parseInt(adjustDelta, 10);
    if (isNaN(delta) || delta === 0) { toast({ variant: "destructive", title: "Informe um valor inteiro diferente de zero" }); return; }
    const { error } = await supabase.rpc("admin_adjust_ai_credits", {
      _account_id: adjustAcc.id, _delta: delta, _notes: adjustNote || `Ajuste manual (${delta > 0 ? "+" : ""}${delta})`,
    });
    if (error) { toast({ variant: "destructive", title: "Erro", description: error.message }); return; }
    toast({ title: `${delta > 0 ? "Adicionados" : "Removidos"} ${Math.abs(delta)} créditos` });
    setAdjustOpen(false); setAdjustAcc(null); setAdjustDelta(""); setAdjustNote("");
    void load();
  };

  const approvePix = async (id: string) => {
    const { error } = await supabase.rpc("approve_ai_credit_pix", { _purchase_id: id });
    if (error) { toast({ variant: "destructive", title: "Erro", description: error.message }); return; }
    toast({ title: "PIX aprovado e créditos liberados" });
    void load();
  };

  const rejectPix = async (id: string) => {
    const reason = prompt("Motivo da rejeição:");
    if (!reason) return;
    const { error } = await supabase.rpc("reject_ai_credit_pix", { _purchase_id: id, _reason: reason });
    if (error) { toast({ variant: "destructive", title: "Erro", description: error.message }); return; }
    toast({ title: "PIX rejeitado" });
    void load();
  };

  const viewProof = async (path: string) => {
    const { data } = await supabase.storage.from("payment-proofs").createSignedUrl(path, 600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const filtered = accounts.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()));
  const pendingPix = purchases.filter((p) => p.status === "pending" && p.payment_method === "pix");
  const formatBRL = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

  if (loading) return <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-xs text-muted-foreground">Simulações totais</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-2xl font-bold text-emerald-500">{stats.succeeded}</p>
          <p className="text-xs text-muted-foreground">Bem sucedidas</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-2xl font-bold text-destructive">{stats.failed}</p>
          <p className="text-xs text-muted-foreground">Falhas</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-2xl font-bold text-amber-500">{pendingPix.length}</p>
          <p className="text-xs text-muted-foreground">PIX pendentes</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="control" className="space-y-4">
        <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full">
          <TabsTrigger value="control" className="gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Controle</TabsTrigger>
          <TabsTrigger value="plans" className="gap-1.5"><Crown className="h-3.5 w-3.5" /> Planos</TabsTrigger>
          <TabsTrigger value="packages" className="gap-1.5"><PackageIcon className="h-3.5 w-3.5" /> Pacotes</TabsTrigger>
          <TabsTrigger value="pix" className="gap-1.5 relative"><Coins className="h-3.5 w-3.5" /> PIX
            {pendingPix.length > 0 && <Badge className="ml-1 px-1.5 py-0 text-[10px] bg-amber-500">{pendingPix.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="accounts" className="gap-1.5">Contas</TabsTrigger>
        </TabsList>

        {/* Controle global */}
        <TabsContent value="control" className="space-y-4">
          <Card className="border-l-4 border-l-primary">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Toggle Global
              </CardTitle>
              <CardDescription>
                Ativa/desativa Simulação Inteligente para TODAS as contas (override por conta sobrescreve).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-3">
              <Switch checked={globalEnabled} onCheckedChange={saveGlobal} disabled={savingGlobal} />
              <Label>{globalEnabled ? "Ativada globalmente" : "Desativada globalmente"}</Label>
              {savingGlobal && <Loader2 className="h-4 w-4 animate-spin" />}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Planos */}
        <TabsContent value="plans" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Créditos mensais por plano</CardTitle>
              <CardDescription>
                Os créditos do plano são <strong>recarregados todo mês</strong>. Créditos comprados nunca expiram.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {plans.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 p-3 border rounded">
                  <div className="flex-1">
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.slug}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      defaultValue={p.ai_credits_monthly}
                      className="w-24"
                      onBlur={(e) => {
                        const v = parseInt(e.target.value, 10) || 0;
                        if (v !== p.ai_credits_monthly) void updatePlanCredits(p.id, v);
                      }}
                    />
                    <span className="text-xs text-muted-foreground">créd/mês</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pacotes */}
        <TabsContent value="packages" className="space-y-4">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Pacotes de créditos avulsos</CardTitle>
                <CardDescription>Vendidos via Stripe (cartão) ou PIX manual.</CardDescription>
              </div>
              <Button size="sm" onClick={() => { setEditingPkg({ is_active: true, sort_order: 0, highlight: false }); setPkgOpen(true); }} className="gap-1">
                <Plus className="h-4 w-4" /> Novo
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {packages.map((pkg) => (
                <div key={pkg.id} className={`flex items-center justify-between gap-3 p-3 border rounded ${!pkg.is_active ? "opacity-50" : ""}`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{pkg.name}</p>
                      {pkg.highlight && <Badge className="bg-primary gap-1"><Star className="h-3 w-3" /> Destaque</Badge>}
                      {!pkg.is_active && <Badge variant="outline">Inativo</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {pkg.credits} créditos • {formatBRL(pkg.price_cents)} • {formatBRL(Math.round(pkg.price_cents / pkg.credits))}/un.
                    </p>
                    {pkg.description && <p className="text-xs text-muted-foreground mt-1">{pkg.description}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => { setEditingPkg(pkg); setPkgOpen(true); }}>Editar</Button>
                    <Button size="sm" variant="ghost" onClick={() => deletePackage(pkg.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
              {packages.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum pacote cadastrado.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PIX */}
        <TabsContent value="pix" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Compras via PIX pendentes</CardTitle>
              <CardDescription>Aprove ou rejeite após validar o comprovante.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {pendingPix.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma compra pendente.</p>
              ) : pendingPix.map((p) => (
                <div key={p.id} className="border rounded p-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{p.account?.name || p.account_id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.credits} créditos • {formatBRL(p.price_cents)} • {new Date(p.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {p.pix_proof_url && (
                      <Button size="sm" variant="outline" onClick={() => viewProof(p.pix_proof_url!)} className="gap-1">
                        <Eye className="h-3.5 w-3.5" /> Comprovante
                      </Button>
                    )}
                    <Button size="sm" onClick={() => approvePix(p.id)} className="gap-1 bg-emerald-600 hover:bg-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => rejectPix(p.id)} className="gap-1">
                      <XCircle className="h-3.5 w-3.5" /> Rejeitar
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Histórico recente */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Compras recentes (50 últimas)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {purchases.filter((p) => p.status !== "pending" || p.payment_method !== "pix").slice(0, 20).map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0">
                  <span className="truncate flex-1">{p.account?.name || "—"}</span>
                  <Badge variant="outline" className="text-[10px]">{p.payment_method}</Badge>
                  <span className="text-xs">{p.credits} créd.</span>
                  <span className="text-xs">{formatBRL(p.price_cents)}</span>
                  <Badge variant={p.status === "paid" ? "default" : p.status === "rejected" ? "destructive" : "outline"} className="text-[10px]">
                    {p.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contas */}
        <TabsContent value="accounts" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Override por Conta + Saldo de Créditos</CardTitle>
              <CardDescription>
                "Padrão" segue o toggle global. Use o ajuste manual para conceder/remover créditos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar conta…" className="pl-8" />
              </div>
              <div className="divide-y border rounded">
                {filtered.map((acc) => {
                  const effective = acc.ai_simulation_enabled === null ? globalEnabled : acc.ai_simulation_enabled;
                  const bal = balances[acc.id];
                  const total = (bal?.plan_credits || 0) + (bal?.purchased_credits || 0);
                  return (
                    <div key={acc.id} className="flex items-center justify-between p-3 gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{acc.name}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant={effective ? "default" : "outline"} className="text-[10px]">
                            {effective ? "Ativa" : "Inativa"}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground">
                            {acc.ai_simulation_enabled === null ? "Padrão" : acc.ai_simulation_enabled ? "Override: ON" : "Override: OFF"}
                          </span>
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <Coins className="h-3 w-3" /> {total} ({bal?.plan_credits || 0}p + {bal?.purchased_credits || 0}c)
                          </Badge>
                          {bal?.total_consumed ? <span className="text-[10px] text-muted-foreground">consumiu {bal.total_consumed}</span> : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        <Button size="sm" variant={acc.ai_simulation_enabled === null ? "default" : "outline"} onClick={() => toggleAccount(acc, null)}>Padrão</Button>
                        <Button size="sm" variant={acc.ai_simulation_enabled === true ? "default" : "outline"} onClick={() => toggleAccount(acc, true)}>Ativar</Button>
                        <Button size="sm" variant={acc.ai_simulation_enabled === false ? "destructive" : "outline"} onClick={() => toggleAccount(acc, false)}>Desativar</Button>
                        <Button size="sm" variant="secondary" onClick={() => { setAdjustAcc(acc); setAdjustOpen(true); }} className="gap-1">
                          <Coins className="h-3.5 w-3.5" /> Ajustar
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {filtered.length === 0 && <p className="text-sm text-muted-foreground p-4 text-center">Nenhuma conta encontrada.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Adjust dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar créditos — {adjustAcc?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Quantidade (use negativo para remover)</Label>
              <Input type="number" value={adjustDelta} onChange={(e) => setAdjustDelta(e.target.value)} placeholder="ex: 10 ou -5" />
            </div>
            <div>
              <Label>Motivo / nota</Label>
              <Textarea value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} placeholder="ex: Brinde de boas-vindas" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)}>Cancelar</Button>
            <Button onClick={adjustCredits} className="gap-1"><Save className="h-4 w-4" /> Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Package dialog */}
      <Dialog open={pkgOpen} onOpenChange={setPkgOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPkg?.id ? "Editar pacote" : "Novo pacote"}</DialogTitle>
          </DialogHeader>
          {editingPkg && (
            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input value={editingPkg.name || ""} onChange={(e) => setEditingPkg({ ...editingPkg, name: e.target.value })} placeholder="ex: Pacote Inicial" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Créditos</Label>
                  <Input type="number" value={editingPkg.credits || ""} onChange={(e) => setEditingPkg({ ...editingPkg, credits: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>Preço (centavos)</Label>
                  <Input type="number" value={editingPkg.price_cents ?? ""} onChange={(e) => setEditingPkg({ ...editingPkg, price_cents: parseInt(e.target.value) || 0 })} placeholder="1990 = R$ 19,90" />
                </div>
              </div>
              <div>
                <Label>Descrição (opcional)</Label>
                <Textarea value={editingPkg.description || ""} onChange={(e) => setEditingPkg({ ...editingPkg, description: e.target.value })} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Ordem</Label>
                  <Input type="number" value={editingPkg.sort_order ?? 0} onChange={(e) => setEditingPkg({ ...editingPkg, sort_order: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch checked={!!editingPkg.highlight} onCheckedChange={(v) => setEditingPkg({ ...editingPkg, highlight: v })} />
                  <Label>Destaque</Label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editingPkg.is_active ?? true} onCheckedChange={(v) => setEditingPkg({ ...editingPkg, is_active: v })} />
                <Label>Ativo</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPkgOpen(false)}>Cancelar</Button>
            <Button onClick={savePackage} className="gap-1"><Save className="h-4 w-4" /> Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
