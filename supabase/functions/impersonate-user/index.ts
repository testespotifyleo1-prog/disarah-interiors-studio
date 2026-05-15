import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Validate caller is super_admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing authorization" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !caller?.email) return json({ error: "Invalid session" }, 401);

    const { data: sa } = await admin.from("super_admins").select("id").eq("email", caller.email).maybeSingle();
    if (!sa) return json({ error: "Acesso negado: somente super admins" }, 403);

    // 2. Parse target
    const body = await req.json().catch(() => ({}));
    const { target_user_id, account_id } = body as { target_user_id?: string; account_id?: string };

    let targetUserId = target_user_id;

    // If only account_id passed, resolve to owner
    if (!targetUserId && account_id) {
      const { data: acc } = await admin.from("accounts").select("owner_user_id").eq("id", account_id).maybeSingle();
      if (!acc?.owner_user_id) return json({ error: "Conta sem owner válido" }, 404);
      targetUserId = acc.owner_user_id;
    }

    if (!targetUserId) return json({ error: "Missing target_user_id or account_id" }, 400);

    // 3. Resolve target user email
    const { data: targetUser, error: tuErr } = await admin.auth.admin.getUserById(targetUserId);
    if (tuErr || !targetUser?.user?.email) return json({ error: "Usuário alvo não encontrado" }, 404);

    // 4. Generate magic link → extract hashed_token (email_otp)
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: targetUser.user.email,
    });
    if (linkErr || !linkData?.properties?.hashed_token) {
      return json({ error: linkErr?.message || "Falha ao gerar link" }, 500);
    }

    // 5. Log impersonation (best-effort)
    try {
      const { data: targetMembership } = await admin
        .from("memberships")
        .select("account_id")
        .eq("user_id", targetUserId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (targetMembership?.account_id) {
        await admin.from("activity_logs").insert({
          account_id: targetMembership.account_id,
          user_id: caller.id,
          user_name: `[SUPERADMIN] ${caller.email}`,
          action: "impersonate",
          entity_type: "session",
          details: { target_user_id: targetUserId, target_email: targetUser.user.email },
        });
      }
    } catch (_e) { /* ignore */ }

    return json({
      hashed_token: linkData.properties.hashed_token,
      email: targetUser.user.email,
      target_user_id: targetUserId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return json({ error: message }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
