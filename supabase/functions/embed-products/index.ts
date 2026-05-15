// Indexa produtos para o chatbot sem depender do endpoint de embeddings.
// Usa texto normalizado + tokenização determinística, rápido, idempotente e com progresso real.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 200;

const SYNONYMS: Record<string, string[]> = {
  biscoito: ["bolacha", "biscoto", "biscouto", "cookie", "cookies"],
  refrigerante: ["refri", "refrigera", "refrig"],
  chocolate: ["chocolatte", "chocolat", "xocolate"],
  sabao: ["sabão"],
  detergente: ["deterjente"],
  amaciante: ["amacianti", "amaciant"],
  cafe: ["café"],
  acucar: ["açúcar", "açucar"],
  leite: ["leiti"],
  caixa: ["cx"],
  pacote: ["pct", "paco"],
  litro: ["lt", "lts"],
  quilograma: ["kg", "kilo", "quilo"],
  grama: ["gr", "gramas"],
  unidade: ["un", "und"],
};

const REVERSE_SYNONYMS: Record<string, string> = {};
for (const [canonical, aliases] of Object.entries(SYNONYMS)) {
  REVERSE_SYNONYMS[canonical] = canonical;
  for (const alias of aliases) REVERSE_SYNONYMS[normalizeText(alias)] = canonical;
}

const STOP_WORDS = new Set([
  "de", "da", "do", "das", "dos", "um", "uma", "uns", "umas", "o", "a", "os", "as",
  "e", "ou", "em", "no", "na", "nos", "nas", "por", "para", "com", "sem", "que",
  "produto", "produtos", "item", "itens", "preco", "valor", "quanto", "custa", "tem", "vende",
]);

function normalizeText(text: string): string {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/(\d)[.,](\d)/g, "$1$2")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  const normalized = normalizeText(text);
  const tokens = normalized
    .split(/\s+/)
    .map(t => REVERSE_SYNONYMS[t] || t)
    .filter(t => t.length > 1 && !STOP_WORDS.has(t));
  return [...new Set(tokens)];
}

function buildProductText(p: any): string {
  return [
    p.name,
    p.brand,
    p.category,
    p.sku,
    p.unit,
    p.description,
    p.ai_training,
  ].filter(Boolean).join(" | ").slice(0, 6000);
}

function buildIndexText(p: any): string {
  const text = buildProductText(p);
  const tokens = tokenize(text);
  const nameTokens = tokenize([p.name, p.brand, p.sku].filter(Boolean).join(" "));
  const categoryTokens = tokenize(p.category || "");
  return [
    normalizeText(text),
    `tokens:${tokens.join(" ")}`,
    `nome:${nameTokens.join(" ")}`,
    `categoria:${categoryTokens.join(" ")}`,
  ].join("\n").slice(0, 2000);
}

async function getAuthedUser(req: Request, supabaseUrl: string) {
  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data } = await userClient.auth.getUser();
  return data?.user || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const user = await getAuthedUser(req, supabaseUrl);
  if (!user) {
    return new Response(JSON.stringify({ error: "unauthenticated" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const accountId: string | undefined = body.accountId;
  const force = !!body.force;
  const resetIndex = !!body.resetIndex;
  if (!accountId) {
    return new Response(JSON.stringify({ error: "accountId required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: mem } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", user.id)
    .eq("account_id", accountId)
    .eq("is_active", true)
    .maybeSingle();
  if (!mem) {
    return new Response(JSON.stringify({ error: "not a member" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (force && resetIndex) {
      const { error: resetError } = await supabase
        .from("products")
        .update({ embedding_text: null, embedding_updated_at: null })
        .eq("account_id", accountId)
        .eq("is_active", true);
      if (resetError) throw resetError;
    }

    let query = supabase
      .from("products")
      .select("id, name, brand, category, sku, unit, description, ai_training")
      .eq("account_id", accountId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(BATCH_SIZE);

    query = query.or("embedding_text.is.null,embedding_text.eq.");

    const { data: rows, error } = await query;
    if (error) throw error;

    const products = rows || [];
    let processed = 0;
    let failed = 0;

    const results = await Promise.allSettled(products.map((row) =>
      supabase
        .from("products")
        .update({
          embedding_text: buildIndexText(row),
          embedding_updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .then(({ error: updErr }) => {
          if (updErr) throw updErr;
        })
    ));

    for (const result of results) {
      if (result.status === "fulfilled") processed++;
      else failed++;
    }

    const { data: remainingData } = await supabase.rpc("products_missing_embedding_count", { _account_id: accountId });
    const { data: indexedData } = await supabase.rpc("products_indexed_count", { _account_id: accountId });
    const { data: totalData } = await supabase.rpc("products_total_active_count", { _account_id: accountId });

    return new Response(JSON.stringify({
      ok: true,
      processed,
      failed,
      remaining: Number(remainingData || 0),
      indexed: Number(indexedData || 0),
      total: Number(totalData || 0),
      done: products.length === 0 || Number(remainingData || 0) === 0,
      mode: force ? "full" : "pending",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[embed-products] fatal:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});