import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  // Adiciona DDI 55 se vier sem (10/11 dígitos -> Brasil)
  if (digits.length === 10 || digits.length === 11) return "55" + digits;
  return digits;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { account_id, store_id, phone, name, save_as_customer } = await req.json();
    if (!account_id || !store_id || !phone) {
      return new Response(JSON.stringify({ error: "account_id, store_id e phone são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalized = normalizePhone(phone);
    if (normalized.length < 12 || normalized.length > 13) {
      return new Response(JSON.stringify({ error: "Número inválido. Use DDD + número (ex: 11999998888)." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: settings } = await supabase
      .from("chatbot_settings").select("*").eq("store_id", store_id).maybeSingle();
    if (!settings?.z_api_instance_id || !settings?.z_api_instance_token || !settings?.z_api_client_token) {
      return new Response(JSON.stringify({ error: "Z-API não configurada para esta loja" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const zapiBase = `https://api.z-api.io/instances/${settings.z_api_instance_id}/token/${settings.z_api_instance_token}`;
    const zapiHeaders = { "Client-Token": settings.z_api_client_token, "Content-Type": "application/json" };

    // 1) Verifica se número existe no WhatsApp
    let exists = false;
    try {
      const checkResp = await fetch(`${zapiBase}/phone-exists/${normalized}`, { headers: zapiHeaders });
      if (checkResp.ok) {
        const check = await checkResp.json();
        // Z-API retorna { exists: true } ou array
        exists = check?.exists === true || check?.[0]?.exists === true;
      }
    } catch (e) {
      console.log("[add-contact] phone-exists fail", e);
    }

    if (!exists) {
      return new Response(JSON.stringify({
        error: "not_on_whatsapp",
        message: "Este número não está cadastrado no WhatsApp.",
      }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2) Busca foto e pushname
    let profilePic: string | null = null;
    let pushname: string | null = null;
    try {
      const picResp = await fetch(`${zapiBase}/profile-picture?phone=${normalized}`, { headers: zapiHeaders });
      if (picResp.ok) {
        const pic = await picResp.json();
        profilePic = pic?.link || pic?.url || pic?.profilePicture || null;
      }
    } catch (_) {}
    try {
      const metaResp = await fetch(`${zapiBase}/contacts/${normalized}`, { headers: zapiHeaders });
      if (metaResp.ok) {
        const meta = await metaResp.json();
        pushname = meta?.name || meta?.pushname || meta?.short || null;
      }
    } catch (_) {}

    // 3) Se solicitado, cria/atualiza customer no ERP
    let customerId: string | null = null;
    if (save_as_customer && name) {
      const { data: existing } = await supabase
        .from("customers").select("id")
        .eq("account_id", account_id)
        .or(`phone.eq.${normalized},phone.ilike.%${normalized.slice(-9)}%`)
        .limit(1).maybeSingle();
      if (existing?.id) {
        customerId = existing.id;
        await supabase.from("customers").update({ name }).eq("id", existing.id);
      } else {
        const { data: created, error: cErr } = await supabase
          .from("customers").insert({ account_id, name, phone: normalized })
          .select("id").single();
        if (cErr) console.error("[add-contact] customer insert", cErr);
        customerId = created?.id || null;
      }
    }

    // 4) Cria/encontra conversa
    const { data: existingConv } = await supabase
      .from("chat_conversations").select("*")
      .eq("store_id", store_id).eq("phone", normalized).maybeSingle();

    let conversation = existingConv;
    if (!conversation) {
      const { data: created, error: convErr } = await supabase
        .from("chat_conversations").insert({
          account_id, store_id, phone: normalized,
          customer_name: name || null,
          customer_id: customerId,
          customer_pushname: pushname,
          profile_pic_url: profilePic,
          profile_fetched_at: new Date().toISOString(),
          is_ai_active: false,
          status: "active",
          last_message_at: new Date().toISOString(),
        }).select("*").single();
      if (convErr) {
        console.error("[add-contact] conv insert", convErr);
        return new Response(JSON.stringify({ error: convErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      conversation = created;
    } else {
      const updates: Record<string, unknown> = {
        profile_pic_url: profilePic ?? conversation.profile_pic_url,
        customer_pushname: pushname ?? conversation.customer_pushname,
        profile_fetched_at: new Date().toISOString(),
      };
      if (name) updates.customer_name = name;
      if (customerId) updates.customer_id = customerId;
      await supabase.from("chat_conversations").update(updates).eq("id", conversation.id);
      conversation = { ...conversation, ...updates };
    }

    return new Response(JSON.stringify({
      ok: true, conversation, exists_on_whatsapp: true, profile_pic_url: profilePic, pushname,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[whatsapp-add-contact] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
