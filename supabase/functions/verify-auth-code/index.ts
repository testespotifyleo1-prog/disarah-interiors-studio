import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHead = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHead });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { email, code, type, newPassword } = await req.json();

    if (!email || !code || !type) {
      return new Response(JSON.stringify({ error: "email, code and type are required" }), {
        status: 400, headers: { ...corsHead, "Content-Type": "application/json" },
      });
    }

    // Find matching unused code
    const { data: codes, error: fetchError } = await supabase
      .from("email_verification_codes")
      .select("*")
      .eq("email", email)
      .eq("code", code)
      .eq("type", type)
      .eq("used", false)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1);

    if (fetchError || !codes || codes.length === 0) {
      return new Response(JSON.stringify({ error: "Código inválido ou expirado" }), {
        status: 400, headers: { ...corsHead, "Content-Type": "application/json" },
      });
    }

    // Mark code as used
    await supabase
      .from("email_verification_codes")
      .update({ used: true })
      .eq("id", codes[0].id);

    if (type === "signup") {
      // Mark user's email as verified in profiles
      const { data: users } = await supabase.auth.admin.listUsers();
      const user = users?.users?.find((u: any) => u.email === email);
      if (user) {
        await supabase
          .from("profiles")
          .update({ email_verified: true })
          .eq("user_id", user.id);
      }

      return new Response(JSON.stringify({ success: true, message: "E-mail verificado com sucesso" }), {
        status: 200, headers: { ...corsHead, "Content-Type": "application/json" },
      });
    }

    if (type === "recovery") {
      if (!newPassword || newPassword.length < 6) {
        return new Response(JSON.stringify({ error: "Nova senha deve ter no mínimo 6 caracteres" }), {
          status: 400, headers: { ...corsHead, "Content-Type": "application/json" },
        });
      }

      // Find user and update password
      const { data: users } = await supabase.auth.admin.listUsers();
      const user = users?.users?.find((u: any) => u.email === email);
      if (!user) {
        return new Response(JSON.stringify({ error: "Usuário não encontrado" }), {
          status: 400, headers: { ...corsHead, "Content-Type": "application/json" },
        });
      }

      const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
        password: newPassword,
      });

      if (updateError) {
        console.error("Password update error:", updateError);
        return new Response(JSON.stringify({ error: "Erro ao atualizar senha" }), {
          status: 500, headers: { ...corsHead, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, message: "Senha atualizada com sucesso" }), {
        status: 200, headers: { ...corsHead, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Tipo inválido" }), {
      status: 400, headers: { ...corsHead, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHead, "Content-Type": "application/json" },
    });
  }
});
