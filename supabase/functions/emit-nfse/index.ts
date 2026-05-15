import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const auth = req.headers.get('Authorization');
    if (!auth) throw new Error('Missing authorization');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(auth.replace('Bearer ', ''));
    if (authErr || !user) throw new Error('Unauthorized');

    const { sale_id, description: customDescription, service_value: customValue } = await req.json();
    if (!sale_id) throw new Error('sale_id is required');

    const { data: sale, error: saleErr } = await supabase
      .from('sales')
      .select('*, stores(id, name, cnpj, ie, address_json), customers(name, document, email, phone, address_json)')
      .eq('id', sale_id).single();
    if (saleErr || !sale) throw new Error('Venda não encontrada');
    if (!sale.customers) throw new Error('NFS-e requer um cliente vinculado.');

    const { data: cfg, error: cfgErr } = await supabase
      .from('nfeio_settings')
      .select('*').eq('store_id', sale.store_id).eq('is_active', true).single();
    if (cfgErr || !cfg) throw new Error('Configuração fiscal ausente');
    if (!cfg.nfse_enabled) throw new Error('NFS-e não está habilitada para esta loja');
    if (!cfg.nfse_service_code) throw new Error('Código de serviço (NFS-e) não configurado');

    const baseUrl = cfg.environment === 'prod'
      ? 'https://api.focusnfe.com.br'
      : 'https://homologacao.focusnfe.com.br';

    const ref = `nfse-${sale_id}`;
    const store = sale.stores || {};
    const storeAddr = (store.address_json || {}) as any;
    const cust = sale.customers as any;
    const custAddr = (cust.address_json || {}) as any;
    const valor = Number(customValue || sale.total || 0);
    const aliquota = Number(cfg.nfse_aliquota || 0);
    const valorIss = Math.round(valor * (aliquota / 100) * 100) / 100;

    const payload = {
      data_emissao: new Date().toISOString(),
      prestador: {
        cnpj: String(store.cnpj || '').replace(/\D/g, ''),
        inscricao_municipal: String((storeAddr.inscricao_municipal || '')).replace(/\D/g, '') || undefined,
        codigo_municipio: storeAddr.codigo_municipio || undefined,
      },
      tomador: {
        cnpj: cust.document && cust.document.replace(/\D/g, '').length === 14 ? cust.document.replace(/\D/g, '') : undefined,
        cpf: cust.document && cust.document.replace(/\D/g, '').length === 11 ? cust.document.replace(/\D/g, '') : undefined,
        razao_social: cust.name,
        email: cust.email || undefined,
        endereco: {
          logradouro: custAddr.street || '',
          numero: custAddr.number || 'S/N',
          complemento: custAddr.complement || undefined,
          bairro: custAddr.district || custAddr.neighborhood || '',
          codigo_municipio: custAddr.codigo_municipio || undefined,
          uf: custAddr.state || '',
          cep: (custAddr.zip || custAddr.cep || '').replace(/\D/g, ''),
        },
      },
      servico: {
        aliquota,
        discriminacao: customDescription || cfg.nfse_item_description || `Serviço referente venda ${sale_id.slice(0, 8)}`,
        iss_retido: cfg.nfse_iss_retido ? 'true' : 'false',
        item_lista_servico: cfg.nfse_service_code,
        codigo_cnae: cfg.nfse_cnae || undefined,
        codigo_tributario_municipio: cfg.nfse_service_code,
        valor_servicos: valor,
        valor_iss: valorIss,
      },
    };

    console.log('NFS-e payload:', JSON.stringify(payload));

    const resp = await fetch(`${baseUrl}/v2/nfse?ref=${encodeURIComponent(ref)}`, {
      method: 'POST',
      headers: { 'Authorization': 'Basic ' + btoa(cfg.api_key + ':'), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await resp.text();
    let data: any; try { data = JSON.parse(text); } catch { throw new Error(`Resposta inválida: ${text.substring(0, 200)}`); }

    if (!resp.ok) {
      const erros = Array.isArray(data.erros) ? data.erros.map((e: any) => e.mensagem).join('; ') : '';
      throw new Error(`Focus NFSe: ${erros || data.mensagem || JSON.stringify(data)}`);
    }

    let status = 'processing';
    let pdf: string | null = null, xml: string | null = null;
    if (data.status === 'autorizado') {
      status = 'issued';
      if (data.caminho_xml_nota_fiscal) xml = `${baseUrl}${data.caminho_xml_nota_fiscal}`;
      if (data.url) pdf = data.url;
    }

    const { data: doc, error: docErr } = await supabase.from('fiscal_documents').insert({
      sale_id, store_id: sale.store_id, type: 'nfse', provider: 'focusnfe',
      provider_id: ref, status, pdf_url: pdf, xml_url: xml,
    }).select().single();
    if (docErr) throw new Error('Falha ao registrar documento');

    return new Response(JSON.stringify({ success: true, document: doc }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('emit-nfse error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
