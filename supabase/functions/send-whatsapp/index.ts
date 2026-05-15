import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SendKind = "text" | "image" | "audio" | "sticker" | "document" | "video";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    const {
      conversation_id,
      message,
      image_url,
      audio_url,
      sticker_url,
      document_url,
      video_url,
      document_filename,
    } = body as Record<string, string | undefined>;

    if (!conversation_id) {
      return new Response(JSON.stringify({ error: "conversation_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine kind
    let kind: SendKind = "text";
    if (audio_url) kind = "audio";
    else if (sticker_url) kind = "sticker";
    else if (image_url) kind = "image";
    else if (video_url) kind = "video";
    else if (document_url) kind = "document";

    if (kind === "text" && !message?.trim()) {
      return new Response(JSON.stringify({ error: "message or media required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: conversation, error: convErr } = await supabase
      .from("chat_conversations").select("*").eq("id", conversation_id).single();
    if (convErr || !conversation) {
      return new Response(JSON.stringify({ error: "Conversation not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: settings } = await supabase
      .from("chatbot_settings").select("*").eq("store_id", conversation.store_id).single();

    if (!settings?.z_api_instance_id || !settings?.z_api_instance_token || !settings?.z_api_client_token) {
      return new Response(JSON.stringify({ error: "Z-API not configured for this store" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const zapiBase = `https://api.z-api.io/instances/${settings.z_api_instance_id}/token/${settings.z_api_instance_token}`;
    const zapiHeaders = {
      "Content-Type": "application/json",
      "Client-Token": settings.z_api_client_token,
    };

    let endpoint = "";
    let payload: Record<string, unknown> = { phone: conversation.phone };
    let storedType = kind === "text" ? "text" : kind;
    let storedMedia: string | null = null;
    let storedContent = message || "";

    switch (kind) {
      case "audio":
        endpoint = "send-audio";
        payload.audio = audio_url;
        storedMedia = audio_url!;
        storedContent = message || "🎙️ Áudio";
        storedType = "audio";
        break;
      case "sticker":
        endpoint = "send-sticker";
        payload.sticker = sticker_url;
        storedMedia = sticker_url!;
        storedContent = "🎨 Sticker";
        storedType = "sticker";
        break;
      case "image":
        endpoint = "send-image";
        payload.image = image_url;
        payload.caption = message || "";
        storedMedia = image_url!;
        storedContent = message || "📷 Imagem";
        storedType = "image";
        break;
      case "video":
        endpoint = "send-video";
        payload.video = video_url;
        payload.caption = message || "";
        storedMedia = video_url!;
        storedContent = message || "🎥 Vídeo";
        storedType = "video";
        break;
      case "document":
        endpoint = "send-document/pdf";
        payload.document = document_url;
        payload.fileName = document_filename || "documento.pdf";
        storedMedia = document_url!;
        storedContent = message || `📎 ${document_filename || "Documento"}`;
        storedType = "document";
        break;
      case "text":
      default:
        endpoint = "send-text";
        payload.message = message;
        break;
    }

    const sendResp = await fetch(`${zapiBase}/${endpoint}`, {
      method: "POST", headers: zapiHeaders, body: JSON.stringify(payload),
    });
    const sendResult = await sendResp.json().catch(() => ({}));
    if (!sendResp.ok) {
      console.error("[send-whatsapp] Z-API error:", sendResp.status, sendResult);
      return new Response(JSON.stringify({ error: "Z-API send failed", details: sendResult }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("chat_messages").insert({
      conversation_id: conversation.id,
      direction: "outbound",
      content: storedContent,
      message_type: storedType,
      is_ai_generated: false,
      media_url: storedMedia,
      z_api_message_id: sendResult?.messageId || sendResult?.id || null,
    });

    await supabase.from("chat_conversations")
      .update({ is_ai_active: false, last_message_at: new Date().toISOString() })
      .eq("id", conversation.id);

    return new Response(JSON.stringify({ ok: true, sendResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[send-whatsapp] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
