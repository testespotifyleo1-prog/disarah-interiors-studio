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

    const { fiscal_document_id, correcao } = await req.json();
    if (!fiscal_document_id || !correcao) throw new Error('fiscal_document_id e correcao obrigatórios');
    if (correcao.length < 15 || correcao.length > 1000) throw new Error('Correção deve ter 15 a 1000 caracteres');

    const { data: doc } = await supabase.from('fiscal_documents').select('*').eq('id', fiscal_document_id).single();
    if (!doc) throw new Error('Documento não encontrado');
    if (doc.type !== 'nfe') throw new Error('Carta de Correção só para NF-e (modelo 55)');
    if (doc.status !== 'issued') throw new Error('Apenas NF-e autorizadas podem receber CC-e');
    if (!doc.provider_id) throw new Error('Documento sem referência do provedor');

    const { count: existing } = await supabase
      .from('fiscal_corrections').select('*', { count: 'exact', head: true })
      .eq('fiscal_document_id', fiscal_document_id);
    const sequencia = (existing || 0) + 1;
    if (sequencia > 20) throw new Error('Limite de 20 cartas de correção atingido');

    const { data: store } = await supabase.from('stores').select('account_id').eq('id', doc.store_id).single();
    const { data: settings } = await supabase
      .from('nfeio_settings').select('api_key, environment')
      .eq('store_id', doc.store_id).eq('is_active', true).single();
    if (!settings) throw new Error('Configuração fiscal não encontrada');

    const baseUrl = settings.environment === 'prod'
      ? 'https://api.focusnfe.com.br'
      : 'https://homologacao.focusnfe.com.br';

    const { data: corrRow } = await supabase.from('fiscal_corrections').insert({
      account_id: store!.account_id, store_id: doc.store_id,
      fiscal_document_id, user_id: user.id,
      sequencia, correcao_text: correcao,
      status: 'processing',
    }).select().single();

    const resp = await fetch(`${baseUrl}/v2/nfe/${doc.provider_id}/carta_correcao`, {
      method: 'POST',
      headers: { 'Authorization': 'Basic ' + btoa(settings.api_key + ':'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ correcao }),
    });
    const text = await resp.text();
    let json: any; try { json = JSON.parse(text); } catch { json = { raw: text }; }

    if (!resp.ok && resp.status !== 202) {
      await supabase.from('fiscal_corrections').update({
        status: 'error', error_message: json.mensagem || text, response_json: json,
      }).eq('id', corrRow!.id);
      throw new Error(`Focus: ${json.mensagem || text}`);
    }

    await supabase.from('fiscal_corrections').update({
      status: json.status === 'registrado' ? 'registered' : 'processing',
      protocolo: json.numero_protocolo || json.protocolo,
      provider_ref: json.ref,
      xml_url: json.caminho_xml_carta_correcao ? `${baseUrl}${json.caminho_xml_carta_correcao}` : null,
      pdf_url: json.caminho_pdf_carta_correcao ? `${baseUrl}${json.caminho_pdf_carta_correcao}` : null,
      response_json: json,
    }).eq('id', corrRow!.id);

    return new Response(JSON.stringify({ success: true, sequencia, correction_id: corrRow!.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
