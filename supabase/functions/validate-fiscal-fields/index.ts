import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { product_name, unit, current_fields } = await req.json();

    if (!product_name || typeof product_name !== "string" || product_name.trim().length < 2) {
      return new Response(JSON.stringify({ error: "Nome do produto é obrigatório (mínimo 2 caracteres)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const currentFieldsInfo = current_fields
      ? `\nCampos atuais já preenchidos: ${JSON.stringify(current_fields)}`
      : "";

    const systemPrompt = `Você é um especialista fiscal brasileiro em NCM, CEST, CFOP, CSOSN, CST e tributação para o regime Simples Nacional e Lucro Presumido.

Sua tarefa: dado o nome de um produto e sua unidade de medida, sugira os campos fiscais corretos.

Regras:
- NCM deve ter 8 dígitos (formato: 0000.00.00)
- CEST deve ter 7 dígitos (formato: 00.000.00), se aplicável. Se não houver CEST obrigatório, retorne string vazia.
- CFOP padrão para revenda interna é 5102, para produção própria 5101.
- Para Simples Nacional: CSOSN mais comum é "102" (sem permissão de crédito). Use "500" se o produto tem ST.
- CST ICMS: use "00" para tributação normal, "60" para ST.
- CST PIS e COFINS: "49" para Simples Nacional, "01" para regime normal.
- CST IPI: "99" para não contribuinte, "50" para saída tributada.
- Alíquotas: para Simples Nacional, ICMS/PIS/COFINS/IPI geralmente ficam 0.
- Origem ICMS: "0" para produto nacional, "1" para importado.

Se o nome do produto for genérico demais, ambíguo, ou não interpretável (ex: "ABC123", "xxxx", "produto teste"), defina "ambiguous" como true e explique o motivo em "warning".

Responda APENAS com JSON válido neste formato exato, sem markdown:
{
  "ambiguous": false,
  "warning": "",
  "suggestions": {
    "ncm": "0000.00.00",
    "cest": "",
    "cfop_default": "5102",
    "origem_icms": "0",
    "cst_icms": "00",
    "csosn": "102",
    "cst_pis": "49",
    "cst_cofins": "49",
    "cst_ipi": "99",
    "aliq_icms": 0,
    "aliq_pis": 0,
    "aliq_cofins": 0,
    "aliq_ipi": 0
  },
  "explanation": "Breve explicação de porque esses valores foram sugeridos"
}`;

    const userPrompt = `Produto: "${product_name.trim()}"
Unidade: "${unit || "UN"}"${currentFieldsInfo}

Analise o produto e sugira os campos fiscais apropriados.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("Erro no serviço de IA");
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // Parse the JSON from AI response (strip markdown fences if present)
    let cleaned = content.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "").trim();
    }

    const parsed = JSON.parse(cleaned);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("validate-fiscal-fields error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
