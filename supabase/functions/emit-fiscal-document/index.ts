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

    const { sale_id, type } = await req.json();
    if (!sale_id || !type) throw new Error('sale_id and type are required');
    if (!['nfe', 'nfce'].includes(type)) throw new Error('type must be "nfe" or "nfce"');

    // Get sale details
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select(`
        *,
        stores(id, name, cnpj, ie, address_json),
        customers(name, document, email, phone, address_json),
        sale_items(*, products(name, sku, ncm, cfop_default, unit, gtin, price_default)),
        payments(*)
      `)
      .eq('id', sale_id)
      .single();

    if (saleError || !sale) throw new Error('Sale not found');

    if (type === 'nfe' && !sale.customers) {
      throw new Error('NF-e requer um cliente vinculado à venda.');
    }

    if (type === 'nfe' && sale.customers) {
      const addr = sale.customers.address_json as any;
      if (!addr || !addr.street || !addr.city || !addr.state) {
        throw new Error('Cliente sem endereço completo para NF-e.');
      }
    }

    // Get fiscal settings
    const { data: nfSettings, error: nfError } = await supabase
      .from('nfeio_settings')
      .select('*')
      .eq('store_id', sale.store_id)
      .eq('is_active', true)
      .single();

    if (nfError || !nfSettings) throw new Error('Configurações fiscais não encontradas.');

    const focusToken = nfSettings.api_key;
    const baseUrl = nfSettings.environment === 'prod'
      ? 'https://api.focusnfe.com.br'
      : 'https://homologacao.focusnfe.com.br';

    // Generate unique ref from sale_id
    const ref = `${type}-${sale_id}`;

    const { data: existingIssuedDoc } = await supabase
      .from('fiscal_documents')
      .select('*')
      .eq('external_id', ref)
      .in('status', ['issued', 'authorized', 'completed'])
      .maybeSingle();

    if (existingIssuedDoc) {
      return new Response(
        JSON.stringify({ success: true, document: existingIssuedDoc, message: 'Documento fiscal já autorizado.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`Emitting ${type} for sale ${sale_id} via Focus NFe, ref: ${ref}`);

    const endpoint = type === 'nfe' ? '/v2/nfe' : '/v2/nfce';
    const invoicePayload = buildFocusPayload(sale, type);
    console.log('Payload:', JSON.stringify(invoicePayload, null, 2));

    const focusResponse = await fetch(
      `${baseUrl}${endpoint}?ref=${encodeURIComponent(ref)}`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(focusToken + ':'),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invoicePayload),
      }
    );

    const responseText = await focusResponse.text();
    console.log('Focus NFe raw response:', responseText);

    let focusData: any;
    try {
      focusData = JSON.parse(responseText);
    } catch {
      console.error('Failed to parse Focus NFe response:', responseText);
      throw new Error(`Resposta inválida da API fiscal. Status: ${focusResponse.status}. Resposta: ${responseText.substring(0, 200)}`);
    }

    if (!focusResponse.ok) {
      console.error('Focus NFe error:', focusData);
      const errosDetail = Array.isArray(focusData.erros)
        ? focusData.erros.map((e: any) => e.mensagem).join('; ')
        : '';
      const rawMsg = errosDetail || focusData.mensagem || focusData.codigo || JSON.stringify(focusData);

      // If already authorized for this ref, fetch the existing document instead of failing
      const normalizedMsg = String(rawMsg)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      const alreadyAuthorized = focusData.codigo === 'already_processed'
        || focusData.codigo === 'nota_fiscal_ja_autorizada'
        || normalizedMsg.includes('ja foi autorizada')
        || normalizedMsg.includes('already processed')
        || normalizedMsg.includes('duplicad');

      if (alreadyAuthorized) {
        console.log('Nota já autorizada, consultando via GET para sincronizar.');
        const getResp = await fetch(`${baseUrl}${endpoint}/${encodeURIComponent(ref)}`, {
          headers: { 'Authorization': 'Basic ' + btoa(focusToken + ':') },
        });
        const getText = await getResp.text();
        try {
          focusData = JSON.parse(getText);
        } catch {
          throw new Error(`Nota já autorizada, mas falha ao consultar: ${getText.substring(0, 200)}`);
        }
        if (!getResp.ok) {
          console.warn('Nota já autorizada, mas consulta falhou. Salvando como autorizada com a resposta original.', focusData);
          focusData = {
            ...focusData,
            status: 'autorizado',
            codigo: focusData.codigo || 'already_processed',
            mensagem: focusData.mensagem || 'A nota fiscal já foi autorizada',
          };
        }
        // fall through to status handling below
      } else {
        throw new Error(`Erro ao emitir nota fiscal. Detalhe: ${rawMsg}`);
      }
    }

    // Focus NFe returns different statuses:
    // NFCe (sync): status = "autorizado" or error
    // NFe (async): status = "processando_autorizacao"
    const focusStatus = focusData.status || '';
    let fiscalDocStatus = 'processing';
    let pdfUrl: string | null = null;
    let xmlUrl: string | null = null;
    let accessKey: string | null = null;
    let nfeNumber: string | null = null;

    if (focusStatus === 'autorizado') {
      fiscalDocStatus = 'issued';
      if (focusData.caminho_danfe) pdfUrl = `${baseUrl}${focusData.caminho_danfe}`;
      if (focusData.caminho_xml_nota_fiscal) xmlUrl = `${baseUrl}${focusData.caminho_xml_nota_fiscal}`;
      accessKey = focusData.chave_nfe || null;
      nfeNumber = focusData.numero ? String(focusData.numero) : null;
    }

    // Upsert by external_id to avoid duplicates when re-syncing an already authorized note
    const { data: existing } = await supabase
      .from('fiscal_documents')
      .select('id')
      .eq('external_id', ref)
      .maybeSingle();

    const docPayload = {
      sale_id,
      store_id: sale.store_id,
      doc_type: type,
      external_id: ref,
      status: fiscalDocStatus,
      pdf_url: pdfUrl,
      xml_url: xmlUrl,
      access_key: accessKey,
      number: nfeNumber ? Number(nfeNumber) : null,
      raw_response: focusData,
    };

    const query = existing
      ? supabase.from('fiscal_documents').update(docPayload).eq('id', existing.id).select().single()
      : supabase.from('fiscal_documents').insert(docPayload).select().single();

    const { data: fiscalDoc, error: docError } = await query;

    if (docError) { console.error('Upsert fiscal_documents error:', docError); throw new Error('Failed to save fiscal document record: ' + docError.message); }

    return new Response(
      JSON.stringify({ success: true, document: fiscalDoc, message: 'Documento fiscal enviado para processamento.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});

function buildFocusPayload(sale: any, type: string) {
  const isNFCe = type === 'nfce';
  const store = sale.stores || {};
  const storeAddr = (store.address_json || {}) as any;
  const ieRaw = String(store.ie ?? '').trim().toUpperCase();
  const ieDigits = ieRaw.replace(/\D/g, '');
  const inscricaoEstadualEmitente = ieRaw === 'ISENTO' ? 'ISENTO' : ieDigits || null;

  // ── Interstate detection ──
  const storeUf = (storeAddr.state || '').toUpperCase().trim();
  const customerAddr = ((sale.customers?.address_json || {}) as any);
  const customerUf = (customerAddr.state || '').toUpperCase().trim();
  const isInterstate = !isNFCe && storeUf && customerUf && storeUf !== customerUf;

  console.log(`[FISCAL] Store UF: ${storeUf}, Customer UF: ${customerUf}, Interstate: ${isInterstate}`);

  // ── CFOP adjustment for interstate operations ──
  // Intrastate: starts with 5 (5102, 5405, etc.)
  // Interstate: starts with 6 (6102, 6405, etc.)
  const adjustCfop = (cfopStr: string): number => {
    const cfop = parseInt(cfopStr.replace(/\D/g, ''), 10);
    if (!isInterstate) return cfop;
    // Convert 5xxx → 6xxx for interstate
    const cfopString = String(cfop);
    if (cfopString.startsWith('5')) {
      const adjusted = parseInt('6' + cfopString.substring(1), 10);
      console.log(`[FISCAL] CFOP adjusted: ${cfop} → ${adjusted} (interstate: ${storeUf} → ${customerUf})`);
      return adjusted;
    }
    return cfop;
  };

  // ── Helper: round to exactly 2 decimal places ──
  const toMoney = (value: number) => Math.round((Number(value) || 0) * 100) / 100;

  // ── Payment methods mapping ──
  const formasPagamento = (sale.payments || []).map((p: any) => {
    let forma = '99';
    if (p.method === 'cash') forma = '01';
    else if (p.method === 'pix') forma = '17';
    else if (p.method === 'card') {
      forma = p.card_type === 'credit' ? '03' : '04';
    } else if (p.method === 'crediario') forma = '05';
    return { forma_pagamento: forma, valor_pagamento: toMoney(p.paid_value) };
  });
  if (formasPagamento.length === 0) {
    formasPagamento.push({ forma_pagamento: '99', valor_pagamento: toMoney(sale.total) });
  }

  const saleItems = sale.sale_items || [];
  const totalDiscount = toMoney(Number(sale.discount) || 0);
  const rawFreight = toMoney(Number(sale.delivery_fee) || 0);

  // ── Distribute an amount proportionally across items (in cents to avoid float errors) ──
  const distributeAmountByItems = (amount: number) => {
    if (amount <= 0 || saleItems.length === 0) return saleItems.map(() => 0);
    const totalCents = Math.round(amount * 100);
    const weights = saleItems.map((i: any) => Number(i.total_line) || 0);
    const totalWeight = weights.reduce((sum: number, w: number) => sum + w, 0);

    if (totalWeight <= 0) {
      const base = Math.floor(totalCents / saleItems.length);
      const remainder = totalCents - base * saleItems.length;
      return saleItems.map((_: any, idx: number) => (base + (idx === saleItems.length - 1 ? remainder : 0)) / 100);
    }

    const distributed = weights.map((w: number) => Math.floor((totalCents * w) / totalWeight));
    const partial = distributed.reduce((sum: number, c: number) => sum + c, 0);
    distributed[distributed.length - 1] += totalCents - partial;
    return distributed.map((cents: number) => cents / 100);
  };

  // Distribute discount across items
  const discountPerItem = distributeAmountByItems(totalDiscount);

  // For NF-e: freight is highlighted in header + distributed to items
  // For NFC-e: freight CANNOT be highlighted (modalidade_frete must be 9)
  //   → We adjust valor_unitario to absorb the freight, keeping valor_bruto = unit * qty
  const highlightFreight = !isNFCe && rawFreight > 0;
  const absorbFreight = isNFCe && rawFreight > 0;
  const freightPerItem = highlightFreight ? distributeAmountByItems(rawFreight) : saleItems.map(() => 0);
  const absorbedFreightPerItem = absorbFreight ? distributeAmountByItems(rawFreight) : saleItems.map(() => 0);

  // ── Build items ──
  const items = saleItems.map((item: any, index: number) => {
    const product = item.products || {};
    const rawNcm = (product.ncm || '').replace(/\D/g, '').padStart(8, '0').substring(0, 8);
    const ncm = rawNcm === '00000000' ? '94039090' : rawNcm;
    const cfop = adjustCfop(product.cfop_default || '5102');
    const unit = (product.unit || 'UN').toUpperCase().substring(0, 6);
    const qty = Number(item.qty);

    // SEFAZ RULE: valor_bruto MUST equal valor_unitario_comercial × quantidade_comercial
    // When absorbing freight (NFC-e), we adjust the unit price to include the freight portion
    let unitPrice: number;
    let valorBruto: number;

    if (absorbedFreightPerItem[index] > 0) {
      // Add freight to item total, then recalculate unit price
      const adjustedTotal = toMoney(item.total_line + absorbedFreightPerItem[index]);
      // Calculate unit price that when multiplied by qty gives adjustedTotal
      unitPrice = toMoney(adjustedTotal / qty);
      // Ensure valor_bruto = unitPrice * qty exactly
      valorBruto = toMoney(unitPrice * qty);
      // If rounding causes a difference, adjust the last cent on unitPrice
      if (valorBruto !== adjustedTotal) {
        // Adjust: make valor_bruto match by tweaking unit price
        // The difference should be at most 1 cent per item
        valorBruto = adjustedTotal;
        unitPrice = toMoney(adjustedTotal / qty);
        // Final recalc to ensure consistency
        valorBruto = toMoney(unitPrice * qty);
      }
    } else {
      unitPrice = toMoney(Number(item.unit_price));
      valorBruto = toMoney(unitPrice * qty);
    }

    const itemPayload: any = {
      numero_item: index + 1,
      codigo_produto: product.sku || product.id?.substring(0, 8) || String(index + 1),
      descricao: item.presentation_name
        ? `${product.name || 'Produto'} - ${item.presentation_name}`
        : (product.name || 'Produto'),
      cfop,
      unidade_comercial: unit,
      quantidade_comercial: qty,
      valor_unitario_comercial: unitPrice,
      valor_unitario_tributavel: unitPrice,
      unidade_tributavel: unit,
      codigo_ncm: ncm,
      quantidade_tributavel: qty,
      valor_bruto: valorBruto,
      icms_situacao_tributaria: 102,
      icms_origem: 0,
      pis_situacao_tributaria: '07',
      cofins_situacao_tributaria: '07',
    };

    if (freightPerItem[index] > 0) itemPayload.valor_frete = toMoney(freightPerItem[index]);
    if (discountPerItem[index] > 0) itemPayload.valor_desconto = toMoney(discountPerItem[index]);

    return itemPayload;
  });

  // ── Validate: valor_bruto === unit * qty for each item ──
  items.forEach((item: any, idx: number) => {
    const expected = toMoney(item.valor_unitario_comercial * item.quantidade_comercial);
    if (expected !== item.valor_bruto) {
      console.warn(`[SEFAZ] Item ${idx + 1}: valor_bruto (${item.valor_bruto}) != unit (${item.valor_unitario_comercial}) * qty (${item.quantidade_comercial}) = ${expected}. Correcting.`);
      item.valor_bruto = expected;
    }
  });

  // ── Calculate totals from actual item values ──
  const sumValorBruto = toMoney(items.reduce((s: number, i: any) => s + i.valor_bruto, 0));
  const sumDiscount = toMoney(items.reduce((s: number, i: any) => s + (i.valor_desconto || 0), 0));
  const sumFreight = toMoney(items.reduce((s: number, i: any) => s + (i.valor_frete || 0), 0));

  // ── Build payload ──
  const storeCnpj = (store.cnpj || '').replace(/\D/g, '');
  
  // idDest: 1=interna, 2=interestadual, 3=exterior
  const indicadorDestino = isInterstate ? 2 : 1;
  
  const payload: any = {
    natureza_operacao: isInterstate ? 'VENDA INTERESTADUAL' : 'VENDA',
    data_emissao: new Date().toISOString(),
    tipo_documento: 1,
    finalidade_emissao: 1,
    consumidor_final: 1,
    presenca_comprador: isNFCe ? 1 : (sale.source === 'ecommerce' ? 2 : 1),
    local_destino: indicadorDestino,
    cnpj_emitente: storeCnpj,
  };

  // Add customer data for NF-e
  if (!isNFCe && sale.customers) {
    const customer = sale.customers;
    const custAddr = (customer.address_json || {}) as any;
    const doc = (customer.document || '').replace(/\D/g, '');
    payload.nome_destinatario = customer.name;
    if (doc.length === 11) payload.cpf_destinatario = doc;
    else if (doc.length === 14) payload.cnpj_destinatario = doc;
    if (custAddr.street) {
      payload.logradouro_destinatario = custAddr.street;
      payload.numero_destinatario = custAddr.number || 'S/N';
      payload.bairro_destinatario = custAddr.neighborhood || custAddr.district || 'Centro';
      payload.municipio_destinatario = custAddr.city || '';
      payload.uf_destinatario = custAddr.state || '';
      payload.cep_destinatario = (custAddr.zip || custAddr.postalCode || '').replace(/\D/g, '');
      payload.codigo_pais_destinatario = '1058';
      payload.pais_destinatario = 'BRASIL';
    }
    if (customer.email) payload.email_destinatario = customer.email;

    // Inscrição Estadual do destinatário (obrigatório para PJ)
    // 1=Contribuinte ICMS, 2=Contribuinte isento, 9=Não contribuinte
    if (doc.length === 14) {
      const ieRawCust = String(custAddr.ie || '').trim().toUpperCase();
      const ieDigitsCust = ieRawCust.replace(/\D/g, '');
      if (ieRawCust === 'ISENTO') {
        payload.indicador_inscricao_estadual_destinatario = 2;
      } else if (ieDigitsCust.length > 0) {
        payload.indicador_inscricao_estadual_destinatario = 1;
        payload.inscricao_estadual_destinatario = ieDigitsCust;
      } else {
        payload.indicador_inscricao_estadual_destinatario = 9;
      }
    } else if (doc.length === 11) {
      payload.indicador_inscricao_estadual_destinatario = 9;
    }
  }

  if (inscricaoEstadualEmitente) {
    payload.inscricao_estadual_emitente = inscricaoEstadualEmitente;
  }

  // NFC-e: modalidade_frete MUST be 9 (sem frete)
  if (isNFCe) {
    payload.modalidade_frete = 9;
  } else {
    payload.modalidade_frete = rawFreight > 0 ? 0 : 9;
  }

  payload.items = items;
  payload.formas_pagamento = formasPagamento;

  // ── Totals: derived from items to guarantee consistency ──
  // valor_produtos = sum of valor_bruto of all items (SEFAZ rule)
  payload.valor_produtos = sumValorBruto;

  if (sumDiscount > 0) {
    payload.valor_desconto = sumDiscount;
  }

  if (highlightFreight && sumFreight > 0) {
    payload.valor_frete = sumFreight;
  }

  // valor_total = valor_produtos - desconto + frete (for NF-e with highlighted freight)
  // For NFC-e: freight was absorbed into items, so valor_total = valor_produtos - desconto
  if (highlightFreight) {
    payload.valor_total = toMoney(sumValorBruto - sumDiscount + sumFreight);
  } else {
    payload.valor_total = toMoney(sumValorBruto - sumDiscount);
  }

  // ── Log for debugging ──
  console.log('[SEFAZ] Totals check:', {
    sumValorBruto,
    sumDiscount,
    sumFreight,
    valorTotal: payload.valor_total,
    valorProdutos: payload.valor_produtos,
    isNFCe,
    highlightFreight,
    absorbFreight,
    rawFreight,
    totalDiscount,
    itemCount: items.length,
  });

  return payload;
}
