import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const IMAGE_MODEL = "google/gemini-3.1-flash-image-preview";
const TEXT_MODEL = "google/gemini-3-flash-preview";
const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

interface ReqBody {
  simulation_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth: verify caller is a member of the simulation's account
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { simulation_id } = (await req.json()) as ReqBody;
    if (!simulation_id) {
      return new Response(JSON.stringify({ error: "simulation_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load simulation row
    const { data: sim, error: simErr } = await admin
      .from("ai_simulations")
      .select("*")
      .eq("id", simulation_id)
      .single();

    if (simErr || !sim) {
      return new Response(JSON.stringify({ error: "Simulation not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify membership
    const { data: isMember } = await admin.rpc("is_account_member", {
      _user_id: userId,
      _account_id: sim.account_id,
    });
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Feature gate (global + per-account override)
    const { data: globalSetting } = await admin
      .from("site_settings")
      .select("value")
      .eq("key", "ai_simulation_enabled_global")
      .maybeSingle();
    const globalEnabled = (globalSetting?.value ?? "true") !== "false";

    const { data: acc } = await admin
      .from("accounts")
      .select("ai_simulation_enabled, plan_id, plan_status")
      .eq("id", sim.account_id)
      .single();

    const accountOverride: boolean | null = acc?.ai_simulation_enabled ?? null;
    const effectiveEnabled = accountOverride === null ? globalEnabled : accountOverride;

    if (!effectiveEnabled) {
      await admin
        .from("ai_simulations")
        .update({ status: "blocked", error_message: "Funcionalidade desativada para esta conta" })
        .eq("id", simulation_id);
      return new Response(JSON.stringify({ error: "Feature disabled for this account" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Garante créditos mensais e debita 1 crédito ANTES de processar
    await admin.rpc("grant_monthly_ai_credits", { _account_id: sim.account_id });
    const { data: consumeRes, error: consumeErr } = await admin.rpc("consume_ai_credit", {
      _account_id: sim.account_id,
      _user_id: userId,
      _reference_id: simulation_id,
    });
    if (consumeErr || !(consumeRes as any)?.success) {
      await admin
        .from("ai_simulations")
        .update({ status: "blocked", error_message: "Sem créditos de IA disponíveis" })
        .eq("id", simulation_id);
      return new Response(
        JSON.stringify({ error: "insufficient_credits", message: "Sem créditos de IA disponíveis" }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Helper: estorna o crédito em qualquer falha após o débito
    const refundCredit = async (reason: string) => {
      try {
        await admin.rpc("refund_ai_credit", {
          _account_id: sim.account_id,
          _reference_id: simulation_id,
          _reason: reason,
        });
      } catch (e) {
        console.error("Failed to refund credit:", e);
      }
    };

    // Mark processing
    await admin
      .from("ai_simulations")
      .update({ status: "processing", error_message: null })
      .eq("id", simulation_id);

    // Load product + variant
    const { data: product } = await admin
      .from("products")
      .select(
        "id, name, description, description_long, brand, category, subcategory, product_group, unit, weight, weight_unit, image_url, price_default, variant_options",
      )
      .eq("id", sim.product_id)
      .single();

    if (!product) {
      await refundCredit("Produto não encontrado");
      await admin
        .from("ai_simulations")
        .update({ status: "failed", error_message: "Produto não encontrado" })
        .eq("id", simulation_id);
      return new Response(JSON.stringify({ error: "Product not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let variantInfo = "";
    let variantImageUrl: string | null = null;
    if (sim.variant_id) {
      const { data: variant } = await admin
        .from("product_variants")
        .select("id, attributes, sku")
        .eq("id", sim.variant_id)
        .maybeSingle();
      if (variant) {
        const attrs = Object.entries(variant.attributes || {})
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ");
        variantInfo = attrs ? ` (variação: ${attrs})` : "";
        const { data: vImgs } = await admin
          .from("product_variant_images")
          .select("image_url")
          .eq("variant_id", variant.id)
          .order("sort_order", { ascending: true })
          .limit(1);
        variantImageUrl = vImgs?.[0]?.image_url || null;
      }
    }

    const productImageUrl = variantImageUrl || product.image_url;

    // ============ STEP 1: Generate composite image ============
    const productLabel = `${product.name}${variantInfo}`;
    const sizeContext =
      sim.space_width_cm || sim.space_height_cm
        ? ` Espaço disponível aproximado: ${sim.space_width_cm || "?"}cm de largura por ${sim.space_height_cm || "?"}cm de altura.`
        : "";
    const userExtra = sim.user_notes ? ` Observações do usuário: ${sim.user_notes}.` : "";

    const imagePrompt = `You are a professional interior visualization AI. Insert the EXACT product shown in the second image into the real customer environment shown in the first image.

PRODUCT: "${productLabel}"${product.brand ? ` — brand: ${product.brand}` : ""}${product.category ? ` — category: ${product.category}` : ""}.
${product.description ? `Description: ${product.description}` : ""}

CRITICAL REQUIREMENTS:
- Preserve the customer's environment EXACTLY as shown in the first image — same walls, floor, lighting, furniture, perspective and camera angle.
- Place the product naturally and realistically in a sensible location within that environment.
- Match the environment's lighting, shadows, perspective and color temperature on the inserted product.
- The product MUST look identical to the reference photo: same shape, same colors, same materials, same proportions.
- Do NOT replace or remove any existing furniture unless strictly necessary.
- Do NOT add watermarks, text overlays, brand stamps, or labels.
- Output a single ultra-realistic photograph, as if the product was really there.
${sizeContext}${userExtra}

Return ONLY the final composited photograph.`;

    const imgContent: any[] = [
      { type: "text", text: imagePrompt },
      { type: "image_url", image_url: { url: sim.environment_image_url } },
    ];
    if (productImageUrl) {
      imgContent.push({ type: "image_url", image_url: { url: productImageUrl } });
    }

    const imgResp = await fetch(AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        messages: [{ role: "user", content: imgContent }],
        modalities: ["image", "text"],
      }),
    });

    if (!imgResp.ok) {
      const status = imgResp.status;
      const txt = await imgResp.text();
      console.error("Image gen error:", status, txt);
      let errMsg = "Erro ao gerar imagem da simulação";
      if (status === 429) errMsg = "Limite de requisições de IA atingido. Tente novamente em alguns segundos.";
      else if (status === 402) errMsg = "Créditos de IA insuficientes na workspace.";
      await refundCredit(errMsg);
      await admin
        .from("ai_simulations")
        .update({ status: "failed", error_message: errMsg })
        .eq("id", simulation_id);
      return new Response(JSON.stringify({ error: errMsg }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const imgData = await imgResp.json();
    const generatedDataUrl: string | undefined =
      imgData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!generatedDataUrl) {
      await refundCredit("IA não retornou imagem");
      await admin
        .from("ai_simulations")
        .update({ status: "failed", error_message: "IA não retornou imagem" })
        .eq("id", simulation_id);
      return new Response(JSON.stringify({ error: "No image generated" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upload generated image
    const m = generatedDataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
    if (!m) throw new Error("Invalid image data");
    const ext = m[1] === "jpeg" ? "jpg" : m[1];
    const bin = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
    const path = `${sim.account_id}/${simulation_id}/generated.${ext}`;
    const { error: upErr } = await admin.storage
      .from("ai-simulations")
      .upload(path, bin, { contentType: `image/${m[1]}`, upsert: true });
    if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);
    const { data: pub } = admin.storage.from("ai-simulations").getPublicUrl(path);
    const generatedUrl = pub.publicUrl;

    // ============ STEP 2: Suggest similar products from real catalog ============
    let candidates: any[] = [];
    if (product.category) {
      const { data } = await admin
        .from("products")
        .select("id, name, price_default, image_url, category, subcategory, product_group, brand, description")
        .eq("account_id", sim.account_id)
        .eq("is_active", true)
        .eq("category", product.category)
        .neq("id", product.id)
        .limit(20);
      candidates = data || [];
    }
    if (candidates.length < 3 && product.product_group) {
      const { data } = await admin
        .from("products")
        .select("id, name, price_default, image_url, category, subcategory, product_group, brand, description")
        .eq("account_id", sim.account_id)
        .eq("is_active", true)
        .eq("product_group", product.product_group)
        .neq("id", product.id)
        .limit(20);
      const existing = new Set(candidates.map((c) => c.id));
      for (const c of data || []) if (!existing.has(c.id)) candidates.push(c);
    }

    // ============ STEP 3: Analysis + recommendations ============
    const analysisPrompt = `Você é um consultor comercial especialista em ambientação. Analise objetivamente se o produto abaixo combina com o ambiente do cliente.

PRODUTO ESCOLHIDO:
- Nome: ${product.name}${variantInfo}
- Categoria: ${product.category || "n/d"}${product.subcategory ? ` / ${product.subcategory}` : ""}
- Marca: ${product.brand || "n/d"}
- Descrição: ${product.description || product.description_long || "n/d"}
- Preço: R$ ${Number(product.price_default).toFixed(2)}
${sizeContext}

PRODUTOS ALTERNATIVOS DISPONÍVEIS NO CATÁLOGO DA LOJA (use SOMENTE estes IDs nas recomendações; NÃO invente produtos):
${candidates
  .map(
    (c, i) =>
      `${i + 1}. id=${c.id} | nome="${c.name}" | preço=R$ ${Number(c.price_default).toFixed(2)} | categoria=${c.category || "n/d"}${c.subcategory ? "/" + c.subcategory : ""}${c.brand ? " | marca=" + c.brand : ""}`,
  )
  .join("\n") || "(nenhum produto similar disponível)"}

Responda apenas chamando a função analyze_simulation.`;

    const tools = [
      {
        type: "function",
        function: {
          name: "analyze_simulation",
          description: "Análise comercial da simulação no ambiente",
          parameters: {
            type: "object",
            properties: {
              fits_well: {
                type: "string",
                enum: ["sim", "parcial", "nao"],
                description: "O produto encaixa bem no ambiente?",
              },
              size_assessment: {
                type: "string",
                enum: ["adequado", "pequeno", "grande", "indefinido"],
                description: "Avaliação do tamanho do produto para o espaço",
              },
              harmony_score: {
                type: "integer",
                minimum: 0,
                maximum: 10,
                description: "Nota de harmonia visual de 0 a 10",
              },
              summary: {
                type: "string",
                description:
                  "Resumo objetivo (2 a 4 frases) explicando se vale a pena para o cliente, sem enrolação",
              },
              pros: {
                type: "array",
                items: { type: "string" },
                description: "Pontos positivos da escolha",
              },
              cons: {
                type: "array",
                items: { type: "string" },
                description: "Possíveis ressalvas",
              },
              suggestions: {
                type: "array",
                description:
                  "Até 3 produtos do catálogo (use APENAS os IDs fornecidos) que podem encaixar melhor ou complementar",
                items: {
                  type: "object",
                  properties: {
                    product_id: { type: "string", description: "id do produto do catálogo" },
                    reason: { type: "string", description: "Por que recomenda" },
                  },
                  required: ["product_id", "reason"],
                  additionalProperties: false,
                },
              },
            },
            required: ["fits_well", "size_assessment", "harmony_score", "summary", "pros", "cons", "suggestions"],
            additionalProperties: false,
          },
        },
      },
    ];

    const txtResp = await fetch(AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: TEXT_MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: analysisPrompt },
              { type: "image_url", image_url: { url: generatedUrl } },
            ],
          },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "analyze_simulation" } },
      }),
    });

    let analysis: any = null;
    let suggestions: any[] = [];
    if (txtResp.ok) {
      const txtData = await txtResp.json();
      const call = txtData.choices?.[0]?.message?.tool_calls?.[0];
      if (call?.function?.arguments) {
        try {
          analysis = JSON.parse(call.function.arguments);
        } catch (e) {
          console.error("Failed to parse analysis JSON:", e);
        }
      }
    } else {
      console.error("Text analysis failed:", txtResp.status, await txtResp.text());
    }

    if (analysis?.suggestions) {
      const validIds = new Set(candidates.map((c) => c.id));
      const enriched = (analysis.suggestions as any[])
        .filter((s) => validIds.has(s.product_id))
        .map((s) => {
          const p = candidates.find((c) => c.id === s.product_id);
          return p ? { ...s, name: p.name, price: Number(p.price_default), image_url: p.image_url } : null;
        })
        .filter(Boolean);
      suggestions = enriched;
    }

    // Persist final
    await admin
      .from("ai_simulations")
      .update({
        status: "succeeded",
        generated_image_url: generatedUrl,
        analysis,
        suggestions,
      })
      .eq("id", simulation_id);

    return new Response(
      JSON.stringify({ success: true, simulation_id, generated_image_url: generatedUrl, analysis, suggestions }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("simulate-product-environment error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
