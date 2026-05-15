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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    // Valida JWT via getClaims (compatível com o novo sistema de signing-keys)
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: authError } = await userClient.auth.getClaims(token);
    if (authError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const caller = { id: claimsData.claims.sub as string };

    const body = await req.json();
    const { action, account_id } = body;

    if (!action || !account_id) {
      return new Response(JSON.stringify({ error: "Missing action or account_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is owner/admin
    const { data: callerMembership } = await admin
      .from("memberships").select("role").eq("user_id", caller.id)
      .eq("account_id", account_id).eq("is_active", true).single();

    if (!callerMembership || !["owner", "admin"].includes(callerMembership.role)) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === ACTION: list emails for given user_ids ===
    if (action === "list_emails") {
      const { user_ids } = body;
      if (!Array.isArray(user_ids)) {
        return new Response(JSON.stringify({ error: "user_ids must be array" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify all user_ids belong to this account
      const { data: members } = await admin.from("memberships")
        .select("user_id").eq("account_id", account_id).in("user_id", user_ids);
      const allowedIds = new Set((members || []).map((m: any) => m.user_id));

      const emailMap: Record<string, string> = {};
      for (const uid of user_ids) {
        if (!allowedIds.has(uid)) continue;
        const { data: u } = await admin.auth.admin.getUserById(uid);
        if (u?.user?.email) emailMap[uid] = u.user.email;
      }

      return new Response(JSON.stringify({ emails: emailMap }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === ACTION: update seller (name/email/role) ===
    if (action === "update") {
      const { seller_user_id, full_name, email, role } = body;
      if (!seller_user_id) {
        return new Response(JSON.stringify({ error: "Missing seller_user_id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify target user belongs to this account and is seller/manager
      const { data: targetMembership } = await admin.from("memberships")
        .select("id, role").eq("user_id", seller_user_id)
        .eq("account_id", account_id).single();
      if (!targetMembership) {
        return new Response(JSON.stringify({ error: "Colaborador não encontrado" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!["seller", "manager"].includes(targetMembership.role)) {
        return new Response(JSON.stringify({ error: "Só é possível editar vendedores ou gerentes" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update email in auth
      if (email && email.trim()) {
        const { error: emailErr } = await admin.auth.admin.updateUserById(seller_user_id, {
          email: email.trim(),
          email_confirm: true,
        });
        if (emailErr) {
          return new Response(JSON.stringify({ error: `Email: ${emailErr.message}` }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Update full_name in profiles
      if (full_name !== undefined) {
        await admin.from("profiles").update({ full_name: full_name.trim() })
          .eq("user_id", seller_user_id);
      }

      // Update role in memberships
      if (role && ["seller", "manager"].includes(role)) {
        await admin.from("memberships").update({ role })
          .eq("id", targetMembership.id);

        // Sync role_in_store on store_memberships
        await admin.from("store_memberships")
          .update({ role_in_store: role })
          .eq("user_id", seller_user_id);
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
