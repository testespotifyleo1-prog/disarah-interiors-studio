import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const auth = req.headers.get('Authorization'); if (!auth) throw new Error('Missing authorization');
    const { data: { user } } = await supabase.auth.getUser(auth.replace('Bearer ', ''));
    if (!user) throw new Error('Unauthorized');

    const { mdfe_id, municipio_descarga, uf_descarga } = await req.json();
    if (!mdfe_id) throw new Error('mdfe_id obrigatório');

    const { data: doc } = await supabase.from('mdfe_documents').select('*').eq('id', mdfe_id).single();
    if (!doc) throw new Error('MDF-e não encontrado');
    if (!doc.provider_ref) throw new Error('MDF-e sem referência');

    const { data: settings } = await supabase
      .from('nfeio_settings').select('api_key, environment')
      .eq('store_id', doc.store_id).eq('is_active', true).single();
    if (!settings) throw new Error('Configuração fiscal não encontrada');

    const baseUrl = settings.environment === 'prod'
      ? 'https://api.focusnfe.com.br'
      : 'https://homologacao.focusnfe.com.br';

    const resp = await fetch(`${baseUrl}/v2/mdfe/${doc.provider_ref}/encerramento`, {
      method: 'POST',
      headers: { 'Authorization': 'Basic ' + btoa(settings.api_key + ':'), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        municipio: municipio_descarga || doc.municipio_descarregamento,
        uf: uf_descarga || doc.uf_descarregamento,
      }),
    });
    const text = await resp.text();
    let json: any; try { json = JSON.parse(text); } catch { json = { raw: text }; }
    if (!resp.ok) throw new Error(`Focus: ${json.mensagem || text}`);

    await supabase.from('mdfe_documents').update({
      status: 'closed',
      encerrado_em: new Date().toISOString(),
      response_json: json,
    }).eq('id', mdfe_id);

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
