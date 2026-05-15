import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const MAX_ATTEMPTS = 5;
// minutes for next attempt by current attempt count
const BACKOFF = [1, 5, 30, 120, 720];

async function hmacSha256(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

interface Delivery {
  id: string;
  endpoint_id: string;
  event: string;
  payload: any;
  attempt: number;
}

async function deliverOne(d: Delivery) {
  const { data: ep } = await supabase
    .from('webhook_endpoints')
    .select('url, secret, is_active, failure_count')
    .eq('id', d.endpoint_id).maybeSingle();

  if (!ep || !ep.is_active) {
    await supabase.from('webhook_deliveries').update({
      delivered_at: new Date().toISOString(),
      error: 'endpoint inativo ou removido',
    }).eq('id', d.id);
    return;
  }

  const body = JSON.stringify({ event: d.event, data: d.payload, timestamp: new Date().toISOString() });
  const signature = await hmacSha256(ep.secret, body);

  let status = 0;
  let respText = '';
  let errMsg: string | null = null;
  try {
    const resp = await fetch(ep.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Typos-Event': d.event,
        'X-Typos-Signature': `sha256=${signature}`,
        'User-Agent': 'TyposERP-Webhook/1.0',
      },
      body,
      signal: AbortSignal.timeout(15000),
    });
    status = resp.status;
    respText = (await resp.text()).slice(0, 2000);
  } catch (e: any) {
    errMsg = e.message ?? String(e);
  }

  const success = status >= 200 && status < 300;
  const nextAttempt = d.attempt + 1;

  if (success) {
    await supabase.from('webhook_deliveries').update({
      status_code: status, response_body: respText, attempt: nextAttempt,
      delivered_at: new Date().toISOString(),
    }).eq('id', d.id);
    await supabase.from('webhook_endpoints').update({
      last_success_at: new Date().toISOString(), failure_count: 0,
    }).eq('id', d.endpoint_id);
  } else if (nextAttempt >= MAX_ATTEMPTS) {
    await supabase.from('webhook_deliveries').update({
      status_code: status, response_body: respText, attempt: nextAttempt,
      delivered_at: new Date().toISOString(),
      error: errMsg ?? `HTTP ${status}`,
    }).eq('id', d.id);
    const newFailures = (ep.failure_count ?? 0) + 1;
    await supabase.from('webhook_endpoints').update({
      last_failure_at: new Date().toISOString(),
      failure_count: newFailures,
      is_active: newFailures >= 20 ? false : true,
    }).eq('id', d.endpoint_id);
  } else {
    const minutes = BACKOFF[d.attempt] ?? 720;
    const next = new Date(Date.now() + minutes * 60_000).toISOString();
    await supabase.from('webhook_deliveries').update({
      status_code: status || null, response_body: respText, attempt: nextAttempt,
      next_attempt_at: next, error: errMsg ?? `HTTP ${status}`,
    }).eq('id', d.id);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const { data: pending, error } = await supabase
    .from('webhook_deliveries')
    .select('id, endpoint_id, event, payload, attempt')
    .is('delivered_at', null)
    .lte('next_attempt_at', new Date().toISOString())
    .order('next_attempt_at', { ascending: true })
    .limit(50);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const list = (pending ?? []) as Delivery[];
  await Promise.allSettled(list.map(deliverOne));

  return new Response(JSON.stringify({ processed: list.length }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
