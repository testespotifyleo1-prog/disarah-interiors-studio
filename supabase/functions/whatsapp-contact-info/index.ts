import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { conversation_id } = await req.json();
    if (!conversation_id) {
      return new Response(JSON.stringify({ error: "conversation_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: conversation } = await supabase
      .from("chat_conversations").select("*").eq("id", conversation_id).single();
    if (!conversation) {
      return new Response(JSON.stringify({ error: "Conversation not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: settings } = await supabase
      .from("chatbot_settings").select("*").eq("store_id", conversation.store_id).single();
    if (!settings?.z_api_instance_id || !settings?.z_api_instance_token || !settings?.z_api_client_token) {
      return new Response(JSON.stringify({ error: "Z-API not configured" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const zapiBase = `https://api.z-api.io/instances/${settings.z_api_instance_id}/token/${settings.z_api_instance_token}`;
    const zapiHeaders = { "Client-Token": settings.z_api_client_token, "Content-Type": "application/json" };

    let profilePic: string | null = null;
    let pushname: string | null = null;

    // Profile pic
    try {
      const picResp = await fetch(`${zapiBase}/profile-picture?phone=${conversation.phone}`, { headers: zapiHeaders });
      if (picResp.ok) {
        const pic = await picResp.json();
        profilePic = pic?.link || pic?.url || pic?.profilePicture || null;
      }
    } catch (e) { console.log("[contact-info] pic fail", e); }

    // Pushname / name
    try {
      const metaResp = await fetch(`${zapiBase}/contacts/${conversation.phone}`, { headers: zapiHeaders });
      if (metaResp.ok) {
        const meta = await metaResp.json();
        pushname = meta?.name || meta?.pushname || meta?.short || null;
      }
    } catch (e) { console.log("[contact-info] meta fail", e); }

    await supabase.from("chat_conversations").update({
      profile_pic_url: profilePic,
      customer_pushname: pushname,
      profile_fetched_at: new Date().toISOString(),
    }).eq("id", conversation_id);

    return new Response(JSON.stringify({ ok: true, profile_pic_url: profilePic, pushname }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[whatsapp-contact-info] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
