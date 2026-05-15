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

    const body = await req.json();
    const {
      store_id, uf_carregamento, uf_descarregamento,
      municipio_carregamento, municipio_descarregamento,
      veiculo_placa, veiculo_uf, veiculo_tara, veiculo_rntrc,
      motorista_nome, motorista_cpf,
      peso_total, valor_total,
      documentos_vinculados, // [{chave: '...', valor: 0}]
      origem_tipo, origem_id, serie,
    } = body;

    if (!store_id || !uf_carregamento || !uf_descarregamento || !veiculo_placa || !motorista_nome || !motorista_cpf)
      throw new Error('Campos obrigatórios faltando');
    if (!Array.isArray(documentos_vinculados) || documentos_vinculados.length === 0)
      throw new Error('Informe pelo menos uma chave de NF-e/NFC-e vinculada');

    const { data: store } = await supabase.from('stores').select('cnpj, account_id').eq('id', store_id).single();
    if (!store) throw new Error('Loja não encontrada');

    const { data: settings } = await supabase
      .from('nfeio_settings').select('api_key, environment')
      .eq('store_id', store_id).eq('is_active', true).single();
    if (!settings) throw new Error('Configuração fiscal não encontrada');

    const baseUrl = settings.environment === 'prod'
      ? 'https://api.focusnfe.com.br'
      : 'https://homologacao.focusnfe.com.br';

    // Cria registro local
    const { data: row } = await supabase.from('mdfe_documents').insert({
      account_id: store.account_id, store_id, user_id: user.id,
      serie: serie || 1,
      uf_carregamento, uf_descarregamento,
      municipio_carregamento, municipio_descarregamento,
      veiculo_placa: veiculo_placa.replace(/[^A-Z0-9]/gi, '').toUpperCase(),
      veiculo_uf, veiculo_tara, veiculo_rntrc,
      motorista_nome, motorista_cpf: (motorista_cpf || '').replace(/\D/g, ''),
      peso_total: peso_total || 0,
      valor_total: valor_total || 0,
      documentos_vinculados,
      origem_tipo, origem_id,
      status: 'processing',
    }).select().single();

    const ref = `mdfe-${row!.id}`;

    const focusBody = {
      cnpj_emit: (store.cnpj || '').replace(/\D/g, ''),
      serie: serie || 1,
      modal: '1', // Rodoviário
      uf_ini: uf_carregamento,
      uf_fim: uf_descarregamento,
      municipio_carregamento: municipio_carregamento ? [municipio_carregamento] : undefined,
      municipio_descarregamento: documentos_vinculados.map((d: any) => ({
        municipio: municipio_descarregamento || d.municipio,
        uf: uf_descarregamento,
        nfe: documentos_vinculados.filter((x: any) => (x.municipio || municipio_descarregamento) === (d.municipio || municipio_descarregamento)).map((x: any) => ({ chave: x.chave })),
      })),
      veiculo_tracao: {
        placa: veiculo_placa.replace(/[^A-Z0-9]/gi, '').toUpperCase(),
        uf: veiculo_uf,
        tara: veiculo_tara || 0,
        rntrc: veiculo_rntrc || undefined,
      },
      motorista: [{
        nome: motorista_nome,
        cpf: (motorista_cpf || '').replace(/\D/g, ''),
      }],
      valor_carga: Number(valor_total) || 0,
      peso_bruto_carga: Number(peso_total) || 0,
      unidade_peso: '01', // KG
    };

    const resp = await fetch(`${baseUrl}/v2/mdfe?ref=${ref}`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(settings.api_key + ':'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(focusBody),
    });
    const text = await resp.text();
    let json: any; try { json = JSON.parse(text); } catch { json = { raw: text }; }

    if (!resp.ok && resp.status !== 202) {
      await supabase.from('mdfe_documents').update({
        status: 'error',
        error_message: json.mensagem || JSON.stringify(json),
        response_json: json,
      }).eq('id', row!.id);
      throw new Error(`Focus MDF-e: ${json.mensagem || text}`);
    }

    await supabase.from('mdfe_documents').update({
      provider_ref: ref,
      status: json.status === 'autorizado' ? 'authorized' : 'processing',
      chave: json.chave_mdfe || null,
      numero: json.numero ? Number(json.numero) : null,
      protocolo: json.protocolo || null,
      pdf_url: json.caminho_pdf ? `${baseUrl}${json.caminho_pdf}` : null,
      xml_url: json.caminho_xml ? `${baseUrl}${json.caminho_xml}` : null,
      response_json: json,
    }).eq('id', row!.id);

    return new Response(JSON.stringify({ success: true, mdfe_id: row!.id, status: json.status }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
