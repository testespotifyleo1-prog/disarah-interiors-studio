import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { store_id } = await req.json();
    if (!store_id) {
      return new Response(JSON.stringify({ ok: false, error: "store_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: settings } = await supabase
      .from("chatbot_settings").select("*").eq("store_id", store_id).maybeSingle();

    if (!settings?.z_api_instance_id || !settings?.z_api_instance_token || !settings?.z_api_client_token) {
      return new Response(JSON.stringify({
        ok: false, configured: false,
        error: "Z-API não configurada para esta loja. Vá em Configurações do Chatbot.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const base = `https://api.z-api.io/instances/${settings.z_api_instance_id}/token/${settings.z_api_instance_token}`;
    const headers = { "Client-Token": settings.z_api_client_token };

    const checks = {
      connected: { ok: false, detail: "" as string | null },
      phone_exists: { ok: false, detail: "" as string | null },
      profile_lookup: { ok: false, detail: "" as string | null },
    };

    // 1) Status da instância
    try {
      const r = await fetch(`${base}/status`, { headers });
      const j = await r.json().catch(() => ({}));
      checks.connected.ok = r.ok && (j?.connected === true || j?.session === true || j?.status === "connected");
      checks.connected.detail = checks.connected.ok ? "Instância conectada" : (j?.error || j?.message || "Instância desconectada — escaneie o QR Code");
    } catch (e) {
      checks.connected.detail = `Falha de rede: ${(e as Error).message}`;
    }

    // 2) phone-exists com número de teste (próprio número Z-API ou um fixo válido)
    const testPhone = "5511999999999";
    try {
      const r = await fetch(`${base}/phone-exists/${testPhone}`, { headers });
      checks.phone_exists.ok = r.ok;
      checks.phone_exists.detail = r.ok ? "Endpoint phone-exists respondendo" : `HTTP ${r.status}`;
    } catch (e) {
      checks.phone_exists.detail = `Falha: ${(e as Error).message}`;
    }

    // 3) profile-picture (mesmo que retorne vazio, basta não dar erro de auth)
    try {
      const r = await fetch(`${base}/profile-picture?phone=${testPhone}`, { headers });
      checks.profile_lookup.ok = r.ok || r.status === 404;
      checks.profile_lookup.detail = checks.profile_lookup.ok ? "Endpoint de perfil respondendo" : `HTTP ${r.status}`;
    } catch (e) {
      checks.profile_lookup.detail = `Falha: ${(e as Error).message}`;
    }

    const ok = checks.connected.ok && checks.phone_exists.ok && checks.profile_lookup.ok;

    return new Response(JSON.stringify({ ok, configured: true, checks }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
