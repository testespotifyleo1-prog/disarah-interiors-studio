import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Unauthorized');

    const { fiscal_document_id, items, return_note_id } = await req.json();
    if (!fiscal_document_id) throw new Error('fiscal_document_id é obrigatório');
    if (!items || !Array.isArray(items) || items.length === 0) throw new Error('Selecione ao menos um item para devolver');

    // Get original fiscal document
    const { data: originalDoc, error: docError } = await supabase
      .from('fiscal_documents')
      .select('*')
      .eq('id', fiscal_document_id)
      .single();

    if (docError || !originalDoc) throw new Error('Documento fiscal original não encontrado');
    if (originalDoc.status !== 'issued') throw new Error('Só é possível devolver NF-e autorizadas');
    if (!originalDoc.provider_id) throw new Error('Documento original sem referência do provedor');

    // Verify role
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, account_id, cnpj, ie, name, address_json')
      .eq('id', originalDoc.store_id)
      .single();

    if (storeError || !store) throw new Error('Loja não encontrada');

    const { data: hasRole } = await supabase.rpc('has_account_role', {
      _user_id: user.id,
      _account_id: store.account_id,
      _roles: ['owner', 'admin'],
    });
    if (!hasRole) throw new Error('Apenas admin/dono pode emitir NF-e de devolução');

    // Get fiscal settings
    const { data: nfSettings, error: nfError } = await supabase
      .from('nfeio_settings')
      .select('*')
      .eq('store_id', originalDoc.store_id)
      .eq('is_active', true)
      .single();

    if (nfError || !nfSettings) throw new Error('Configurações fiscais não encontradas');

    const focusToken = nfSettings.api_key;
    const baseUrl = nfSettings.environment === 'prod'
      ? 'https://api.focusnfe.com.br'
      : 'https://homologacao.focusnfe.com.br';

    // Get access key - first check DB, then query Focus NFe
    let accessKey = originalDoc.access_key;
    if (!accessKey) {
      console.log(`Fetching access key from Focus NFe for ref: ${originalDoc.provider_id}`);
      const detailRes = await fetch(
        `${baseUrl}/v2/nfe/${encodeURIComponent(originalDoc.provider_id)}`,
        {
          headers: { 'Authorization': 'Basic ' + btoa(focusToken + ':') },
        }
      );
      if (detailRes.ok) {
        const detail = await detailRes.json();
        accessKey = detail.chave_nfe || null;
        if (accessKey) {
          await supabase.from('fiscal_documents').update({ access_key: accessKey }).eq('id', fiscal_document_id);
          console.log(`Access key saved: ${accessKey}`);
        }
      } else {
        await detailRes.text(); // consume body
      }
    }

    if (!accessKey) throw new Error('Chave de acesso da NF-e original não encontrada. Consulte o status da nota primeiro.');

    // Get sale details
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select(`
        *,
        customers(name, document, email, phone, address_json),
        sale_items(*, products(name, sku, ncm, cfop_default, unit, gtin, price_default))
      `)
      .eq('id', originalDoc.sale_id)
      .single();

    if (saleError || !sale) throw new Error('Venda original não encontrada');

    // Build return payload
    const returnRef = `dev-${originalDoc.sale_id}-${Date.now()}`;
    const returnPayload = buildReturnPayload(sale, items, accessKey, store);
    console.log('Return payload:', JSON.stringify(returnPayload, null, 2));

    // Emit return via Focus NFe
    const focusResponse = await fetch(
      `${baseUrl}/v2/nfe?ref=${encodeURIComponent(returnRef)}`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(focusToken + ':'),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(returnPayload),
      }
    );

    const responseText = await focusResponse.text();
    console.log('Focus NFe return response:', responseText);

    let focusData: any;
    try {
      focusData = JSON.parse(responseText);
    } catch {
      throw new Error(`Resposta inválida. Status: ${focusResponse.status}`);
    }

    if (!focusResponse.ok) {
      const rawMsg = focusData.mensagem || focusData.codigo || JSON.stringify(focusData);
      throw new Error(`Erro ao emitir NF-e de devolução: ${rawMsg}`);
    }

    const focusStatus = focusData.status || '';
    let fiscalDocStatus = 'processing';
    let pdfUrl: string | null = null;
    let xmlUrl: string | null = null;
    let returnAccessKey: string | null = null;

    if (focusStatus === 'autorizado') {
      fiscalDocStatus = 'issued';
      if (focusData.caminho_danfe) pdfUrl = `${baseUrl}${focusData.caminho_danfe}`;
      if (focusData.caminho_xml_nota_fiscal) xmlUrl = `${baseUrl}${focusData.caminho_xml_nota_fiscal}`;
      returnAccessKey = focusData.chave_nfe || null;
    }

    // Save fiscal document for the return
    const { data: returnDoc, error: returnDocError } = await supabase
      .from('fiscal_documents')
      .insert({
        sale_id: originalDoc.sale_id,
        store_id: originalDoc.store_id,
        type: 'nfe',
        provider: 'focusnfe',
        provider_id: returnRef,
        status: fiscalDocStatus,
        pdf_url: pdfUrl,
        xml_url: xmlUrl,
        access_key: returnAccessKey,
        purpose: 'return',
        ref_fiscal_document_id: fiscal_document_id,
        return_note_id: return_note_id || null,
      })
      .select()
      .single();

    if (returnDocError) throw new Error('Erro ao salvar documento de devolução');

    return new Response(
      JSON.stringify({
        success: true,
        document: returnDoc,
        message: 'NF-e de devolução enviada para processamento.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error in emit-fiscal-return:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});

function buildReturnPayload(sale: any, returnItems: any[], accessKey: string, store: any) {
  const storeAddr = (store.address_json || {}) as any;

  // Validate required store address fields
  const ufEmitente = (storeAddr.state || storeAddr.uf || '').toUpperCase().substring(0, 2);
  const cepEmitente = (storeAddr.postalCode || storeAddr.cep || storeAddr.zip || '').replace(/\D/g, '');
  const logradouroEmitente = storeAddr.street || storeAddr.logradouro || storeAddr.rua || '';
  const municipioEmitente = storeAddr.city || storeAddr.cidade || storeAddr.municipio || '';

  if (!ufEmitente || !cepEmitente || !logradouroEmitente || !municipioEmitente) {
    throw new Error('Endereço da loja incompleto. Cadastre logradouro, município, UF e CEP nas configurações da loja antes de emitir NF-e de devolução.');
  }
  // Map return items by product_id
  const returnMap = new Map<string, number>();
  for (const ri of returnItems) {
    returnMap.set(ri.product_id, (returnMap.get(ri.product_id) || 0) + ri.qty);
  }

  const items = (sale.sale_items || [])
    .filter((item: any) => returnMap.has(item.product_id))
    .map((item: any, index: number) => {
      const product = item.products || {};
      const returnQty = returnMap.get(item.product_id) || 0;
      const totalAmount = returnQty * item.unit_price;

      const rawNcm = (product.ncm || '').replace(/\D/g, '').padStart(8, '0');
      const ncm = rawNcm === '00000000' ? '94039090' : rawNcm;

      // CFOP for return
      const originalCfop = (product.cfop_default || '5102').replace(/\D/g, '');
      let returnCfop = 1202;
      if (originalCfop.startsWith('6')) returnCfop = 2202;
      if (originalCfop.startsWith('7')) returnCfop = 3202;

      const unit = (product.unit || 'UN').toUpperCase().substring(0, 6);

      return {
        numero_item: index + 1,
        codigo_produto: product.sku || product.id?.substring(0, 8) || String(index + 1),
        descricao: product.name || 'Produto',
        cfop: returnCfop,
        unidade_comercial: unit,
        quantidade_comercial: returnQty,
        valor_unitario_comercial: item.unit_price,
        valor_unitario_tributavel: item.unit_price,
        unidade_tributavel: unit,
        codigo_ncm: ncm,
        quantidade_tributavel: returnQty,
        valor_bruto: totalAmount,
        icms_situacao_tributaria: 102,
        icms_origem: 0,
        pis_situacao_tributaria: '07',
        cofins_situacao_tributaria: '07',
      };
    });

  const payload: any = {
    natureza_operacao: 'DEVOLUCAO DE MERCADORIA',
    data_emissao: new Date().toISOString(),
    tipo_documento: 0, // Entrada
    finalidade_emissao: 4, // Devolução
    consumidor_final: 0,
    presenca_comprador: 0,
    modalidade_frete: 9,
    // Emitente
    cnpj_emitente: (store.cnpj || '').replace(/\D/g, ''),
    nome_emitente: store.name || '',
    logradouro_emitente: logradouroEmitente,
    numero_emitente: storeAddr.number || storeAddr.numero || 'S/N',
    bairro_emitente: storeAddr.neighborhood || storeAddr.district || storeAddr.bairro || 'Centro',
    municipio_emitente: municipioEmitente,
    uf_emitente: ufEmitente,
    cep_emitente: cepEmitente,
    regime_tributario_emitente: 1,
    // Reference to original NFe - strip "NFe" prefix, must be exactly 44 digits
    notas_referenciadas: [{ chave_nfe: accessKey.replace(/\D/g, '').substring(0, 44) }],
    // No payment for returns
    formas_pagamento: [{ forma_pagamento: '90', valor_pagamento: 0 }],
    items,
  };

  // IE emitente: only add if non-empty
  const ieRaw = String(store.ie ?? '').trim().toUpperCase();
  const ieDigits = ieRaw.replace(/\D/g, '');
  const inscricaoEstadualEmitente = ieRaw === 'ISENTO' ? 'ISENTO' : ieDigits || null;
  if (inscricaoEstadualEmitente) {
    payload.inscricao_estadual_emitente = inscricaoEstadualEmitente;
  }

  // Destinatário
  if (sale.customers) {
    const customer = sale.customers;
    const doc = (customer.document || '').replace(/\D/g, '');

    if (doc.length === 14) payload.cnpj_destinatario = doc;
    else if (doc.length === 11) payload.cpf_destinatario = doc;

    payload.nome_destinatario = customer.name;
    payload.indicador_inscricao_estadual_destinatario = 9;

    const addr = customer.address_json as any;
    if (addr) {
      const logradouro = addr.street || addr.logradouro || addr.rua || 'Endereco nao informado';
      const numero = addr.number || addr.numero || 'S/N';
      const bairro = addr.neighborhood || addr.district || addr.bairro || 'Centro';
      const municipio = addr.city || addr.cidade || addr.municipio || '';
      const uf = (addr.state || addr.uf || '').toUpperCase().substring(0, 2);
      const cep = (addr.postalCode || addr.cep || addr.zip || '').replace(/\D/g, '');

      payload.logradouro_destinatario = logradouro.substring(0, 60);
      payload.numero_destinatario = String(numero).substring(0, 10);
      payload.bairro_destinatario = bairro.substring(0, 60);
      payload.municipio_destinatario = municipio.substring(0, 60);
      payload.uf_destinatario = uf;
      payload.cep_destinatario = cep;
      payload.codigo_pais_destinatario = '1058';
      payload.pais_destinatario = 'BRASIL';
    }
  }

  return payload;
}
