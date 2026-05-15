import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await admin.auth.getUser(token);
    if (!caller?.email) return json({ error: "Invalid session" }, 401);

    // Verify super_admin
    const { data: sa } = await admin.from("super_admins").select("id").eq("email", caller.email).maybeSingle();
    if (!sa) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const userIds: string[] = Array.isArray(body.user_ids) ? body.user_ids : [];
    if (!userIds.length) return json({ emails: {} });

    const emails: Record<string, string> = {};
    // getUserById is per-user; batch in parallel with concurrency limit
    const concurrency = 10;
    for (let i = 0; i < userIds.length; i += concurrency) {
      const slice = userIds.slice(i, i + concurrency);
      await Promise.all(slice.map(async (uid) => {
        try {
          const { data } = await admin.auth.admin.getUserById(uid);
          if (data?.user?.email) emails[uid] = data.user.email;
        } catch (_e) { /* skip */ }
      }));
    }

    return json({ emails });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return json({ error: msg }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
