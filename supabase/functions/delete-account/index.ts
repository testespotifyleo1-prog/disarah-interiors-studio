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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !caller?.email) return json({ error: "Invalid session" }, 401);

    const { data: sa } = await admin
      .from("super_admins")
      .select("id")
      .eq("email", caller.email)
      .maybeSingle();
    if (!sa) return json({ error: "Acesso negado: somente super admins" }, 403);

    const body = await req.json().catch(() => ({}));
    const { account_id, confirm_name, delete_owner_user } = body as {
      account_id?: string;
      confirm_name?: string;
      delete_owner_user?: boolean;
    };

    if (!account_id) return json({ error: "account_id é obrigatório" }, 400);

    const { data: acc, error: accErr } = await admin
      .from("accounts")
      .select("id, name, owner_user_id")
      .eq("id", account_id)
      .maybeSingle();

    if (accErr || !acc) return json({ error: "Conta não encontrada" }, 404);

    if (!confirm_name || confirm_name.trim() !== acc.name.trim()) {
      return json({ error: "Confirmação inválida: digite exatamente o nome da empresa" }, 400);
    }

    const ownerUserId = acc.owner_user_id;

    // Run the wipe via SQL function
    const { error: delErr } = await admin.rpc("admin_delete_account", { _account_id: account_id });
    if (delErr) {
      console.error("admin_delete_account failed:", delErr);
      return json({ error: `Falha ao excluir: ${delErr.message}` }, 500);
    }

    let ownerDeleted = false;
    if (delete_owner_user && ownerUserId) {
      // Only delete the auth user if they don't own/belong to other active accounts
      const { data: otherAccs } = await admin
        .from("accounts")
        .select("id")
        .eq("owner_user_id", ownerUserId)
        .limit(1);
      const { data: otherMems } = await admin
        .from("memberships")
        .select("id")
        .eq("user_id", ownerUserId)
        .eq("is_active", true)
        .limit(1);

      if ((!otherAccs || otherAccs.length === 0) && (!otherMems || otherMems.length === 0)) {
        const { error: userDelErr } = await admin.auth.admin.deleteUser(ownerUserId);
        if (!userDelErr) ownerDeleted = true;
      }
    }

    return json({ success: true, owner_deleted: ownerDeleted, account_name: acc.name });
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
