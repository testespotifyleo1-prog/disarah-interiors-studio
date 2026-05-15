import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Reenvia NFC-es marcadas como contingência que ainda não foram autorizadas
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: pending } = await supabase
      .from('fiscal_documents')
      .select('id, provider_id, store_id')
      .eq('contingency_mode', true)
      .neq('status', 'issued')
      .neq('status', 'cancelled')
      .lt('retry_count', 10)
      .limit(50);

    if (!pending || pending.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let resolved = 0;
    for (const doc of pending) {
      try {
        const { data: settings } = await supabase
          .from('nfeio_settings').select('api_key, environment')
          .eq('store_id', doc.store_id).eq('is_active', true).single();
        if (!settings || !doc.provider_id) continue;

        const baseUrl = settings.environment === 'prod'
          ? 'https://api.focusnfe.com.br'
          : 'https://homologacao.focusnfe.com.br';

        const resp = await fetch(`${baseUrl}/v2/nfce/${doc.provider_id}`, {
          headers: { 'Authorization': 'Basic ' + btoa(settings.api_key + ':') },
        });
        const json = await resp.json().catch(() => ({}));

        const update: any = {
          retry_count: (doc as any).retry_count + 1 || 1,
          last_retry_at: new Date().toISOString(),
        };

        if (json.status === 'autorizado') {
          update.status = 'issued';
          update.transmitted_at = new Date().toISOString();
          if (json.chave_nfe) update.access_key = json.chave_nfe;
          if (json.numero) update.nfe_number = String(json.numero);
          if (json.caminho_danfe) update.pdf_url = `${baseUrl}${json.caminho_danfe}`;
          if (json.caminho_xml_nota_fiscal) update.xml_url = `${baseUrl}${json.caminho_xml_nota_fiscal}`;
          resolved++;
        }
        await supabase.from('fiscal_documents').update(update).eq('id', doc.id);
      } catch (e) {
        console.error('retry error', doc.id, e);
      }
    }

    return new Response(JSON.stringify({ success: true, processed: pending.length, resolved }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
