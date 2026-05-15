import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization');
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) throw new Error('Unauthorized');

    const { store_id, modelo, serie, numero_inicial, numero_final, justificativa } = await req.json();
    if (!store_id || !modelo || serie == null || !numero_inicial || !numero_final || !justificativa)
      throw new Error('Campos obrigatórios faltando');
    if (justificativa.length < 15 || justificativa.length > 255)
      throw new Error('Justificativa deve ter 15 a 255 caracteres');
    if (!['55', '65'].includes(String(modelo)))
      throw new Error('Modelo deve ser 55 (NF-e) ou 65 (NFC-e)');

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
    const path = modelo === '65' ? 'nfce/inutilizacao' : 'nfe/inutilizacao';

    const { data: invRow } = await supabase.from('fiscal_invalidations').insert({
      account_id: store.account_id, store_id, user_id: user.id,
      modelo: String(modelo), serie, numero_inicial, numero_final,
      justificativa, status: 'processing'
    }).select().single();

    const focusBody = {
      cnpj, serie: Number(serie),
      numero_inicial: Number(numero_inicial),
      numero_final: Number(numero_final),
      justificativa,
    };

    const resp = await fetch(`${baseUrl}/v2/${path}`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(settings.api_key + ':'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(focusBody),
    });
    const text = await resp.text();
    let json: any; try { json = JSON.parse(text); } catch { json = { raw: text }; }

    if (!resp.ok) {
      await supabase.from('fiscal_invalidations').update({
        status: 'error', error_message: json.mensagem || text, response_json: json
      }).eq('id', invRow!.id);
      throw new Error(`Focus NFe: ${json.mensagem || text}`);
    }

    await supabase.from('fiscal_invalidations').update({
      status: 'completed',
      protocolo: json.numero_protocolo || json.protocolo,
      provider_ref: json.ref,
      xml_url: json.caminho_xml ? `${baseUrl}${json.caminho_xml}` : null,
      response_json: json,
    }).eq('id', invRow!.id);

    return new Response(JSON.stringify({ success: true, invalidation: invRow, protocolo: json.numero_protocolo }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
