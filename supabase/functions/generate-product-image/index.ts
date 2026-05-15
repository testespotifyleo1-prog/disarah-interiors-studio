import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let creditConsumed = false;
  let accountIdForRefund: string | null = null;
  let referenceIdForRefund: string | null = null;

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth: identify the calling user
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

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { product_id, product_name, account_id } = await req.json();
    if (!product_id || !product_name || !account_id) {
      return new Response(JSON.stringify({ error: "product_id, product_name and account_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify membership
    const { data: isMember } = await supabase.rpc("is_account_member", {
      _user_id: userId,
      _account_id: account_id,
    });
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Garante créditos mensais e debita 1 crédito ANTES de processar
    await supabase.rpc("grant_monthly_ai_credits", { _account_id: account_id });
    const { data: consumeRes, error: consumeErr } = await supabase.rpc("consume_ai_credit", {
      _account_id: account_id,
      _user_id: userId,
      _reference_id: product_id,
    });
    if (consumeErr || !(consumeRes as any)?.success) {
      return new Response(
        JSON.stringify({ error: "insufficient_credits", message: "Sem créditos de IA disponíveis" }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    creditConsumed = true;
    accountIdForRefund = account_id;
    referenceIdForRefund = product_id;

    console.log(`Generating image for: "${product_name}"`);

    const prompt = `Ultra-realistic product photograph of the exact real product: "${product_name}". This must look like a real photo taken with a DSLR camera, NOT an illustration or 3D render. The product should look exactly as it would in real life - real textures, real materials, real packaging with printed labels and branding. Shot on a clean white seamless background, soft diffused studio lighting, slight natural shadows, 85mm lens, f/2.8, commercial catalog photography. No watermarks, no text overlays, no logos added. The product must be the real commercially available item, photographed as-is.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      // Refund credit on AI failure
      if (creditConsumed && accountIdForRefund) {
        await supabase.rpc("refund_ai_credit", {
          _account_id: accountIdForRefund,
          _reference_id: referenceIdForRefund,
          _reason: `Falha IA (${status})`,
        }).catch((e) => console.error("Refund failed:", e));
        creditConsumed = false;
      }
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA da workspace insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResponse.text();
      console.error("AI error:", status, t);
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await aiResponse.json();
    const imageData = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageData) {
      throw new Error("No image generated by AI");
    }

    // Extract base64 data and upload to storage
    const base64Match = imageData.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
    if (!base64Match) throw new Error("Invalid image data format");

    const ext = base64Match[1] === "jpeg" ? "jpg" : base64Match[1];
    const base64Content = base64Match[2];
    const binaryData = Uint8Array.from(atob(base64Content), (c) => c.charCodeAt(0));

    const storagePath = `${account_id}/ai-${product_id}.${ext}`;
    
    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(storagePath, binaryData, {
        contentType: `image/${base64Match[1]}`,
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(storagePath);
    const publicUrl = urlData.publicUrl;

    // Update product with image URL
    const { error: updateError } = await supabase
      .from("products")
      .update({ image_url: publicUrl })
      .eq("id", product_id);

    if (updateError) {
      console.error("Update error:", updateError);
      throw new Error(`Product update failed: ${updateError.message}`);
    }

    console.log(`Image generated and saved for product ${product_id}`);

    return new Response(JSON.stringify({ success: true, image_url: publicUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    // Refund on any post-debit failure
    if (creditConsumed && accountIdForRefund) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        await supabase.rpc("refund_ai_credit", {
          _account_id: accountIdForRefund,
          _reference_id: referenceIdForRefund,
          _reason: msg,
        });
      } catch (e) {
        console.error("Refund failed:", e);
      }
    }
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
