import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_SCOPES = [
  'products:read', 'products:write',
  'stock:read', 'stock:write',
  'sales:read',
  'customers:read', 'customers:write',
  'stores:read',
];

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: ce } = await supabase.auth.getClaims(token);
    if (ce || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userId = claims.claims.sub as string;

    const body = await req.json().catch(() => null) as { account_id?: string; name?: string; scopes?: string[]; expires_at?: string | null; environment?: 'live' | 'test' } | null;
    if (!body?.account_id || !body?.name || !Array.isArray(body?.scopes)) {
      return new Response(JSON.stringify({ error: 'account_id, name e scopes são obrigatórios' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const environment = body.environment === 'test' ? 'test' : 'live';
    const scopes = body.scopes.filter(s => ALLOWED_SCOPES.includes(s));
    if (scopes.length === 0) {
      return new Response(JSON.stringify({ error: 'Selecione ao menos um escopo válido' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Authorization check via has_account_role
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: roleOk } = await admin.rpc('has_account_role', {
      _user_id: userId, _account_id: body.account_id, _roles: ['owner', 'admin'],
    });
    if (!roleOk) {
      return new Response(JSON.stringify({ error: 'Sem permissão' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const rawSecret = randomToken(32);
    const fullKey = `tps_${environment}_${rawSecret}`;
    const keyHash = await sha256Hex(fullKey);
    const keyPrefix = fullKey.slice(0, 16);

    const { data: inserted, error: ie } = await admin.from('api_keys').insert({
      account_id: body.account_id,
      name: body.name,
      key_prefix: keyPrefix,
      key_hash: keyHash,
      scopes,
      environment,
      created_by: userId,
      expires_at: body.expires_at || null,
    }).select('id, name, key_prefix, scopes, environment, created_at').single();

    if (ie) throw ie;

    return new Response(JSON.stringify({ ...inserted, key: fullKey }), {
      status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('api-key-create error', err);
    return new Response(JSON.stringify({ error: err.message ?? 'erro' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
