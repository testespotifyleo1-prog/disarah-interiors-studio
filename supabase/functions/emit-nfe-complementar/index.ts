import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// NF-e Complementar (finalidade_emissao = 2): usada para complementar valor / imposto
// de uma NF-e já emitida (ex.: diferença de preço, ICMS-ST, frete posterior).
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const auth = req.headers.get('Authorization');
    if (!auth) throw new Error('Missing authorization');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(auth.replace('Bearer ', ''));
    if (authErr || !user) throw new Error('Unauthorized');

    const { ref_fiscal_document_id, valor_complementar, motivo, items } = await req.json();
    if (!ref_fiscal_document_id) throw new Error('ref_fiscal_document_id é obrigatório');
    if (!valor_complementar || Number(valor_complementar) <= 0) throw new Error('Valor complementar inválido');
    if (!motivo || String(motivo).length < 15) throw new Error('Motivo deve ter ao menos 15 caracteres');

    const { data: refDoc, error: refErr } = await supabase
      .from('fiscal_documents')
      .select('*, sales(*, stores(id, name, cnpj, ie, address_json), customers(name, document, email, phone, address_json))')
      .eq('id', ref_fiscal_document_id).single();
    if (refErr || !refDoc) throw new Error('Documento referência não encontrado');
    if (refDoc.type !== 'nfe' || refDoc.status !== 'issued' || !refDoc.access_key) {
      throw new Error('Documento referência precisa ser uma NF-e autorizada com chave de acesso');
    }

    const sale: any = refDoc.sales;
    const store = sale.stores || {};
    const storeAddr = (store.address_json || {}) as any;
    const cust = sale.customers || {};
    const custAddr = (cust.address_json || {}) as any;

    const { data: cfg, error: cfgErr } = await supabase
      .from('nfeio_settings').select('*').eq('store_id', sale.store_id).eq('is_active', true).single();
    if (cfgErr || !cfg) throw new Error('Configuração fiscal ausente');

    const baseUrl = cfg.environment === 'prod'
      ? 'https://api.focusnfe.com.br' : 'https://homologacao.focusnfe.com.br';
    const ref = `nfecomp-${ref_fiscal_document_id}-${Date.now()}`;
    const valor = Math.round(Number(valor_complementar) * 100) / 100;

    const itensPayload = (items && Array.isArray(items) && items.length > 0)
      ? items
      : [{
          numero_item: 1,
          codigo_produto: 'COMPL',
          descricao: motivo.substring(0, 120),
          cfop: 5949, ncm: '00000000', unidade_comercial: 'UN',
          quantidade_comercial: 1, valor_unitario_comercial: valor,
          valor_unitario_tributavel: valor, valor_bruto: valor,
          unidade_tributavel: 'UN', quantidade_tributavel: 1,
          icms_origem: 0, icms_situacao_tributaria: '102',
        }];

    const payload: any = {
      natureza_operacao: 'Nota Fiscal Complementar',
      data_emissao: new Date().toISOString(),
      tipo_documento: 1,
      finalidade_emissao: 2, // 2 = Complementar
      presenca_comprador: 1,
      cnpj_emitente: String(store.cnpj || '').replace(/\D/g, ''),
      nome_emitente: store.name,
      logradouro_emitente: storeAddr.street || '',
      numero_emitente: storeAddr.number || 'S/N',
      bairro_emitente: storeAddr.district || storeAddr.neighborhood || '',
      municipio_emitente: storeAddr.city || '',
      uf_emitente: storeAddr.state || '',
      cep_emitente: (storeAddr.zip || storeAddr.cep || '').replace(/\D/g, ''),
      inscricao_estadual_emitente: String(store.ie || '').replace(/\D/g, '') || undefined,
      nome_destinatario: cust.name,
      cpf_destinatario: cust.document && cust.document.replace(/\D/g, '').length === 11 ? cust.document.replace(/\D/g, '') : undefined,
      cnpj_destinatario: cust.document && cust.document.replace(/\D/g, '').length === 14 ? cust.document.replace(/\D/g, '') : undefined,
      logradouro_destinatario: custAddr.street || '',
      numero_destinatario: custAddr.number || 'S/N',
      bairro_destinatario: custAddr.district || custAddr.neighborhood || '',
      municipio_destinatario: custAddr.city || '',
      uf_destinatario: custAddr.state || '',
      cep_destinatario: (custAddr.zip || custAddr.cep || '').replace(/\D/g, ''),
      informacoes_adicionais_contribuinte: `Nota complementar referente NF-e ${refDoc.nfe_number || ''} chave ${refDoc.access_key}. Motivo: ${motivo}`,
      notas_referenciadas: [{ chave_nfe: refDoc.access_key }],
      items: itensPayload,
    };

    console.log('NF-e Complementar payload:', JSON.stringify(payload));
    const resp = await fetch(`${baseUrl}/v2/nfe?ref=${encodeURIComponent(ref)}`, {
      method: 'POST',
      headers: { 'Authorization': 'Basic ' + btoa(cfg.api_key + ':'), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await resp.text();
    let data: any; try { data = JSON.parse(text); } catch { throw new Error(`Resposta inválida: ${text.substring(0, 200)}`); }
    if (!resp.ok) {
      const erros = Array.isArray(data.erros) ? data.erros.map((e: any) => e.mensagem).join('; ') : '';
      throw new Error(`Focus NFe: ${erros || data.mensagem || JSON.stringify(data)}`);
    }

    let status = 'processing', pdf: string | null = null, xml: string | null = null, key: string | null = null, num: string | null = null;
    if (data.status === 'autorizado') {
      status = 'issued';
      if (data.caminho_danfe) pdf = `${baseUrl}${data.caminho_danfe}`;
      if (data.caminho_xml_nota_fiscal) xml = `${baseUrl}${data.caminho_xml_nota_fiscal}`;
      key = data.chave_nfe || null;
      num = data.numero ? String(data.numero) : null;
    }

    const { data: doc, error: docErr } = await supabase.from('fiscal_documents').insert({
      sale_id: sale.id, store_id: sale.store_id, type: 'nfe_complementar', provider: 'focusnfe',
      provider_id: ref, status, pdf_url: pdf, xml_url: xml, access_key: key, nfe_number: num,
      ref_fiscal_document_id, purpose: 'complementar',
    }).select().single();
    if (docErr) throw new Error('Falha ao registrar documento complementar');

    return new Response(JSON.stringify({ success: true, document: doc }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('emit-nfe-complementar error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
