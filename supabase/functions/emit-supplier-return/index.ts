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

    const { supplier_return_id } = await req.json();
    if (!supplier_return_id) throw new Error('supplier_return_id é obrigatório');

    // Load supplier return with items
    const { data: sr, error: srError } = await supabase
      .from('supplier_returns')
      .select('*, supplier_return_items(*)')
      .eq('id', supplier_return_id)
      .single();

    if (srError || !sr) throw new Error('Devolução ao fornecedor não encontrada');
    if (sr.status !== 'draft') throw new Error('Apenas devoluções em rascunho podem ser emitidas');
    if (!sr.supplier_return_items || sr.supplier_return_items.length === 0) throw new Error('Nenhum item na devolução');

    // Verify role
    const { data: hasRole } = await supabase.rpc('has_account_role', {
      _user_id: user.id,
      _account_id: sr.account_id,
      _roles: ['owner', 'admin'],
    });
    if (!hasRole) throw new Error('Apenas admin/dono pode emitir NF-e de devolução ao fornecedor');

    // Get store
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, account_id, cnpj, ie, name, address_json')
      .eq('id', sr.store_id)
      .single();
    if (storeError || !store) throw new Error('Loja não encontrada');

    // Get fiscal entry (original purchase NF-e)
    const { data: fiscalEntry, error: feError } = await supabase
      .from('fiscal_entries')
      .select('*, suppliers(name, cnpj, address_json)')
      .eq('id', sr.fiscal_entry_id)
      .single();
    if (feError || !fiscalEntry) throw new Error('Entrada fiscal não encontrada');
    if (!fiscalEntry.access_key) throw new Error('Entrada fiscal sem chave de acesso. Não é possível emitir devolução.');

    // Get fiscal settings
    const { data: nfSettings, error: nfError } = await supabase
      .from('nfeio_settings')
      .select('*')
      .eq('store_id', sr.store_id)
      .eq('is_active', true)
      .single();
    if (nfError || !nfSettings) throw new Error('Configurações fiscais não encontradas para esta loja');

    const focusToken = nfSettings.api_key;
    const baseUrl = nfSettings.environment === 'prod'
      ? 'https://api.focusnfe.com.br'
      : 'https://homologacao.focusnfe.com.br';

    // Get product details for items
    const productIds = sr.supplier_return_items.map((i: any) => i.product_id);
    const { data: products } = await supabase
      .from('products')
      .select('id, name, sku, ncm, cfop_default, unit, gtin')
      .in('id', productIds);

    const productMap = new Map((products || []).map((p: any) => [p.id, p]));

    // Build the return payload
    const returnRef = `sr-${sr.id}-${Date.now()}`;
    const payload = buildSupplierReturnPayload(store, fiscalEntry, sr.supplier_return_items, productMap);
    console.log('Supplier return payload:', JSON.stringify(payload, null, 2));

    // Emit via Focus NFe
    const focusResponse = await fetch(
      `${baseUrl}/v2/nfe?ref=${encodeURIComponent(returnRef)}`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(focusToken + ':'),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    const responseText = await focusResponse.text();
    console.log('Focus NFe supplier return response:', responseText);

    let focusData: any;
    try {
      focusData = JSON.parse(responseText);
    } catch {
      throw new Error(`Resposta inválida do provedor fiscal. Status: ${focusResponse.status}`);
    }

    if (!focusResponse.ok) {
      const rawMsg = focusData.mensagem || focusData.codigo || JSON.stringify(focusData);
      throw new Error(`Erro ao emitir NF-e de devolução ao fornecedor: ${rawMsg}`);
    }

    const focusStatus = focusData.status || '';
    let fiscalDocStatus = 'processing';
    let pdfUrl: string | null = null;
    let xmlUrl: string | null = null;
    let returnAccessKey: string | null = null;
    let nfeNumber: string | null = null;

    if (focusStatus === 'autorizado') {
      fiscalDocStatus = 'issued';
      if (focusData.caminho_danfe) pdfUrl = `${baseUrl}${focusData.caminho_danfe}`;
      if (focusData.caminho_xml_nota_fiscal) xmlUrl = `${baseUrl}${focusData.caminho_xml_nota_fiscal}`;
      returnAccessKey = focusData.chave_nfe || null;
      nfeNumber = focusData.numero ? String(focusData.numero) : null;
    }

    // We need a sale_id for fiscal_documents. For supplier returns there's no sale.
    // We'll create the fiscal document referencing a dummy approach — 
    // Actually fiscal_documents requires sale_id NOT NULL. We need to track this differently.
    // Let's just update the supplier_return status and store the provider_id there.

    // Update supplier return status
    await supabase
      .from('supplier_returns')
      .update({
        status: fiscalDocStatus === 'issued' ? 'completed' : 'processing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', sr.id);

    // Decrease inventory for returned items
    if (fiscalDocStatus === 'issued' || focusStatus === 'processando_autorizacao') {
      for (const item of sr.supplier_return_items) {
        const { error: invError } = await supabase
          .from('inventory')
          .update({
            updated_at: new Date().toISOString(),
          })
          .eq('store_id', sr.store_id)
          .eq('product_id', item.product_id);

        // Use raw SQL approach via decrement
        // Actually let's just fetch and update
        const { data: inv } = await supabase
          .from('inventory')
          .select('id, qty_on_hand')
          .eq('store_id', sr.store_id)
          .eq('product_id', item.product_id)
          .single();

        if (inv) {
          await supabase
            .from('inventory')
            .update({
              qty_on_hand: Math.max(0, inv.qty_on_hand - item.qty),
              updated_at: new Date().toISOString(),
            })
            .eq('id', inv.id);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: fiscalDocStatus,
        provider_ref: returnRef,
        access_key: returnAccessKey,
        nfe_number: nfeNumber,
        pdf_url: pdfUrl,
        xml_url: xmlUrl,
        message: fiscalDocStatus === 'issued'
          ? 'NF-e de devolução ao fornecedor autorizada!'
          : 'NF-e enviada para processamento na SEFAZ.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error in emit-supplier-return:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});

function buildSupplierReturnPayload(
  store: any,
  fiscalEntry: any,
  returnItems: any[],
  productMap: Map<string, any>
) {
  const storeAddr = (store.address_json || {}) as any;

  const ufEmitente = (storeAddr.state || storeAddr.uf || '').toUpperCase().substring(0, 2);
  const cepEmitente = (storeAddr.postalCode || storeAddr.cep || storeAddr.zip || '').replace(/\D/g, '');
  const logradouroEmitente = storeAddr.street || storeAddr.logradouro || storeAddr.rua || '';
  const municipioEmitente = storeAddr.city || storeAddr.cidade || storeAddr.municipio || '';

  if (!ufEmitente || !cepEmitente || !logradouroEmitente || !municipioEmitente) {
    throw new Error('Endereço da loja incompleto. Cadastre logradouro, município, UF e CEP.');
  }

  // Build items
  const items = returnItems.map((item: any, index: number) => {
    const product = productMap.get(item.product_id) || {};
    const totalAmount = Number((item.qty * item.unit_price).toFixed(2));

    const rawNcm = (product.ncm || '').replace(/\D/g, '').padStart(8, '0');
    const ncm = rawNcm === '00000000' ? '94039090' : rawNcm;

    // CFOP for supplier return: 5202 (within state) or 6202 (interstate)
    const supplierAddr = (fiscalEntry.suppliers?.address_json || {}) as any;
    const supplierUf = (supplierAddr.state || supplierAddr.uf || '').toUpperCase().substring(0, 2);
    const returnCfop = (supplierUf && supplierUf !== ufEmitente) ? 6202 : 5202;

    const unit = (product.unit || 'UN').toUpperCase().substring(0, 6);

    return {
      numero_item: index + 1,
      codigo_produto: product.sku || product.id?.substring(0, 8) || String(index + 1),
      descricao: product.name || item.description || 'Produto',
      cfop: returnCfop,
      unidade_comercial: unit,
      quantidade_comercial: item.qty,
      valor_unitario_comercial: item.unit_price,
      valor_unitario_tributavel: item.unit_price,
      unidade_tributavel: unit,
      codigo_ncm: ncm,
      quantidade_tributavel: item.qty,
      valor_bruto: totalAmount,
      icms_situacao_tributaria: 102,
      icms_origem: 0,
      pis_situacao_tributaria: '07',
      cofins_situacao_tributaria: '07',
    };
  });

  // Ensure total consistency
  const totalItems = items.reduce((sum: number, i: any) => sum + i.valor_bruto, 0);
  const totalRounded = Number(totalItems.toFixed(2));

  const payload: any = {
    natureza_operacao: 'DEVOLUCAO DE COMPRA',
    data_emissao: new Date().toISOString(),
    tipo_documento: 1, // Saída (we are returning TO supplier)
    finalidade_emissao: 4, // Devolução
    consumidor_final: 0,
    presenca_comprador: 0,
    modalidade_frete: 9, // Sem frete
    // Emitente (our store)
    cnpj_emitente: (store.cnpj || '').replace(/\D/g, ''),
    nome_emitente: store.name || '',
    logradouro_emitente: logradouroEmitente,
    numero_emitente: storeAddr.number || storeAddr.numero || 'S/N',
    bairro_emitente: storeAddr.neighborhood || storeAddr.district || storeAddr.bairro || 'Centro',
    municipio_emitente: municipioEmitente,
    uf_emitente: ufEmitente,
    cep_emitente: cepEmitente,
    regime_tributario_emitente: 1,
    // Reference to original purchase NF-e
    notas_referenciadas: [{ chave_nfe: fiscalEntry.access_key.replace(/\D/g, '').substring(0, 44) }],
    // No payment for returns
    formas_pagamento: [{ forma_pagamento: '90', valor_pagamento: 0 }],
    items,
  };

  // IE emitente
  const ieRaw = String(store.ie ?? '').trim().toUpperCase();
  const ieDigits = ieRaw.replace(/\D/g, '');
  const inscricaoEstadualEmitente = ieRaw === 'ISENTO' ? 'ISENTO' : ieDigits || null;
  if (inscricaoEstadualEmitente) {
    payload.inscricao_estadual_emitente = inscricaoEstadualEmitente;
  }

  // Destinatário (supplier)
  if (fiscalEntry.suppliers) {
    const supplier = fiscalEntry.suppliers;
    const supplierCnpj = (supplier.cnpj || '').replace(/\D/g, '');
    if (supplierCnpj.length === 14) payload.cnpj_destinatario = supplierCnpj;
    else if (supplierCnpj.length === 11) payload.cpf_destinatario = supplierCnpj;

    payload.nome_destinatario = supplier.name;
    payload.indicador_inscricao_estadual_destinatario = 9;

    const addr = (supplier.address_json || {}) as any;
    if (addr) {
      const logradouro = addr.street || addr.logradouro || addr.rua || 'Endereco nao informado';
      const numero = addr.number || addr.numero || 'S/N';
      const bairro = addr.neighborhood || addr.district || addr.bairro || 'Centro';
      const municipio = addr.city || addr.cidade || addr.municipio || '';
      const uf = (addr.state || addr.uf || '').toUpperCase().substring(0, 2);
      const cep = (addr.postalCode || addr.cep || addr.zip || '').replace(/\D/g, '');

      if (logradouro) payload.logradouro_destinatario = logradouro.substring(0, 60);
      if (numero) payload.numero_destinatario = String(numero).substring(0, 10);
      if (bairro) payload.bairro_destinatario = bairro.substring(0, 60);
      if (municipio) payload.municipio_destinatario = municipio.substring(0, 60);
      if (uf) payload.uf_destinatario = uf;
      if (cep) payload.cep_destinatario = cep;
      payload.codigo_pais_destinatario = '1058';
      payload.pais_destinatario = 'BRASIL';
    }
  }

  console.log(`Supplier return total: ${totalRounded}, items count: ${items.length}`);

  return payload;
}
