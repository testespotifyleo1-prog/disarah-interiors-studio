// Magalu Webhook — recebe atualizações de pedidos e estoque
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { corsHeaders, jsonResponse } from '../_shared/integrations.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const event = await req.json();
    console.log('[magalu-webhook]', JSON.stringify(event).slice(0, 500));
    // Persistência mínima — adapte conforme contrato Magalu
    await admin.from('webhook_events').insert({
      provider: 'magalu',
      event_type: event?.event || 'unknown',
      payload: event,
    }).catch(() => {});
    return jsonResponse({ received: true });
  } catch (e: any) {
    return jsonResponse({ error: e?.message || String(e) }, 500);
  }
});
