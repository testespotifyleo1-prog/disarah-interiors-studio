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

    const { store_id } = await req.json();
    if (!store_id) throw new Error('store_id obrigatório');

    const { data: store } = await supabase.from('stores').select('cnpj, account_id').eq('id', store_id).single();
    if (!store) throw new Error('Loja não encontrada');

    const { data: settings } = await supabase
      .from('nfeio_settings').select('api_key, environment')
      .eq('store_id', store_id).eq('is_active', true).single();
    if (!settings) throw new Error('Configuração fiscal não encontrada');

    const baseUrl = settings.environment === 'prod'
      ? 'https://api.focusnfe.com.br'
      : 'https://homologacao.focusnfe.com.br';

    const cnpj = (store.cnpj || '').replace(/\D/g, '');

    // Focus: GET /v2/nfes_destinadas?cnpj=...
    const resp = await fetch(`${baseUrl}/v2/nfes_destinadas?cnpj=${cnpj}`, {
      headers: { 'Authorization': 'Basic ' + btoa(settings.api_key + ':') },
    });
    const text = await resp.text();
    let json: any; try { json = JSON.parse(text); } catch { json = []; }
    if (!resp.ok) throw new Error(`Focus: ${json.mensagem || text}`);

    const list = Array.isArray(json) ? json : [];
    let inserted = 0;
    for (const nfe of list) {
      const chave = nfe.chave_nfe || nfe.chave;
      if (!chave) continue;
      const { error } = await supabase.from('nfe_destination_manifest').upsert({
        account_id: store.account_id, store_id,
        chave_nfe: chave,
        cnpj_emitente: nfe.cnpj_emitente,
        nome_emitente: nfe.nome_emitente || nfe.razao_social_emitente,
        numero_nfe: String(nfe.numero || ''),
        serie_nfe: String(nfe.serie || ''),
        valor_nfe: Number(nfe.valor_total) || 0,
        data_emissao: nfe.data_emissao || null,
      }, { onConflict: 'store_id,chave_nfe', ignoreDuplicates: true });
      if (!error) inserted++;
    }

    return new Response(JSON.stringify({ success: true, total: list.length, new: inserted }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
