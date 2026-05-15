import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// tipo_manifestacao: 'confirmacao' | 'ciencia' | 'desconhecimento' | 'nao_realizada'
const TIPO_MAP: Record<string, string> = {
  confirmacao: 'confirmacao',
  ciencia: 'ciencia',
  desconhecimento: 'desconhecimento',
  nao_realizada: 'nao_realizada',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const auth = req.headers.get('Authorization'); if (!auth) throw new Error('Missing authorization');
    const { data: { user } } = await supabase.auth.getUser(auth.replace('Bearer ', ''));
    if (!user) throw new Error('Unauthorized');

    const { manifest_id, tipo, justificativa } = await req.json();
    if (!manifest_id || !tipo) throw new Error('manifest_id e tipo obrigatórios');
    if (!TIPO_MAP[tipo]) throw new Error('Tipo inválido');
    if (tipo === 'nao_realizada' && (!justificativa || justificativa.length < 15))
      throw new Error('Justificativa de 15+ caracteres exigida para Operação Não Realizada');

    const { data: row } = await supabase.from('nfe_destination_manifest').select('*').eq('id', manifest_id).single();
    if (!row) throw new Error('Registro não encontrado');

    const { data: store } = await supabase.from('stores').select('cnpj').eq('id', row.store_id).single();
    const { data: settings } = await supabase
      .from('nfeio_settings').select('api_key, environment')
      .eq('store_id', row.store_id).eq('is_active', true).single();
    if (!settings) throw new Error('Configuração fiscal não encontrada');

    const baseUrl = settings.environment === 'prod'
      ? 'https://api.focusnfe.com.br'
      : 'https://homologacao.focusnfe.com.br';

    const cnpj = (store?.cnpj || '').replace(/\D/g, '');

    const resp = await fetch(`${baseUrl}/v2/nfes_destinadas/${row.chave_nfe}/manifestacao?cnpj=${cnpj}`, {
      method: 'POST',
      headers: { 'Authorization': 'Basic ' + btoa(settings.api_key + ':'), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: TIPO_MAP[tipo],
        justificativa: justificativa || undefined,
      }),
    });
    const text = await resp.text();
    let json: any; try { json = JSON.parse(text); } catch { json = { raw: text }; }
    if (!resp.ok) {
      await supabase.from('nfe_destination_manifest').update({
        status: 'error', error_message: json.mensagem || text, response_json: json,
      }).eq('id', manifest_id);
      throw new Error(`Focus: ${json.mensagem || text}`);
    }

    await supabase.from('nfe_destination_manifest').update({
      status: 'manifested',
      tipo_manifestacao: tipo,
      protocolo: json.numero_protocolo || json.protocolo,
      manifested_at: new Date().toISOString(),
      user_id: user.id,
      response_json: json,
    }).eq('id', manifest_id);

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
