import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { campaign_id, store_id } = await req.json();
    if (!campaign_id) return json({ error: "campaign_id required" }, 400);

    const { data: campaign, error: cErr } = await supabase
      .from("reactivation_campaigns").select("*").eq("id", campaign_id).single();
    if (cErr || !campaign) return json({ error: "Campaign not found" }, 404);

    const targetList: string[] = Array.isArray(campaign.target_customer_ids) ? campaign.target_customer_ids : [];
    const useTargetList = targetList.length > 0;

    let customers: any[] = [];

    if (useTargetList) {
      const { data } = await supabase
        .from("customers")
        .select("id, name, phone")
        .in("id", targetList)
        .not("phone", "is", null);
      customers = data || [];
    } else {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - (campaign.inactive_days || 60));
      const cutoffISO = cutoff.toISOString();

      const { data } = await supabase.from("customers")
        .select("id, name, phone")
        .eq("account_id", campaign.account_id)
        .not("phone", "is", null)
        .limit(2000);
      const list = data || [];
      if (!list.length) return json({ sent: 0, eligible: 0 });

      const customerIds = list.map((c) => c.id);
      let salesQ = supabase.from("sales")
        .select("customer_id, created_at, store_id")
        .in("customer_id", customerIds)
        .gte("created_at", cutoffISO);
      const targetStoreForFilter = campaign.store_id || store_id;
      if (targetStoreForFilter) salesQ = salesQ.eq("store_id", targetStoreForFilter);
      const { data: recentSales } = await salesQ;
      const recentSet = new Set((recentSales || []).map((s: any) => s.customer_id));
      customers = list.filter(c => !recentSet.has(c.id));
    }

    if (!customers.length) return json({ sent: 0, eligible: 0 });

    // Skip those already contacted in last 30 days by this campaign
    const since = new Date(); since.setDate(since.getDate() - 30);
    const { data: alreadySent } = await supabase
      .from("reactivation_log")
      .select("customer_id")
      .eq("campaign_id", campaign_id)
      .gte("sent_at", since.toISOString());
    const sentSet = new Set((alreadySent || []).map((s: any) => s.customer_id));
    const eligible = customers.filter((c) => !sentSet.has(c.id));

    if (!eligible.length) return json({ sent: 0, eligible: 0, reason: "all_recently_contacted" });

    // Z-API config (segmentação por loja se informada)
    let targetStoreId = campaign.store_id || store_id;
    if (!targetStoreId) {
      const { data: anyStore } = await supabase.from("stores").select("id").eq("account_id", campaign.account_id).limit(1).single();
      targetStoreId = anyStore?.id;
    }
    const { data: settings } = await supabase
      .from("chatbot_settings").select("*").eq("store_id", targetStoreId).maybeSingle();

    if (!settings?.z_api_instance_id || !settings?.z_api_instance_token || !settings?.z_api_client_token) {
      return json({ error: "WhatsApp (Z-API) não configurado para esta loja" }, 400);
    }

    const zapiUrl = `https://api.z-api.io/instances/${settings.z_api_instance_id}/token/${settings.z_api_instance_token}/send-text`;
    const zapiHeaders = {
      "Content-Type": "application/json",
      "Client-Token": settings.z_api_client_token,
    };

    let sent = 0;
    const logs: any[] = [];

    for (const c of eligible) {
      const message = String(campaign.message_template || "").replace(/\{\{\s*nome\s*\}\}/gi, (c.name || "").split(" ")[0] || "");
      const phone = String(c.phone || "").replace(/\D/g, "");
      if (!phone) continue;
      try {
        const r = await fetch(zapiUrl, {
          method: "POST", headers: zapiHeaders,
          body: JSON.stringify({ phone, message }),
        });
        const ok = r.ok;
        logs.push({ campaign_id, customer_id: c.id, channel: "whatsapp", status: ok ? "sent" : "failed" });
        if (ok) sent++;
      } catch {
        logs.push({ campaign_id, customer_id: c.id, channel: "whatsapp", status: "failed" });
      }
    }

    if (logs.length) await supabase.from("reactivation_log").insert(logs);
    await supabase.from("reactivation_campaigns").update({ last_run_at: new Date().toISOString() }).eq("id", campaign_id);

    return json({ sent, eligible: eligible.length, total_customers: customers.length });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(b: any, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
