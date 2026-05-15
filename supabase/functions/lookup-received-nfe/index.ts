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

    const body = await req.json();
    const accessKey = (body?.access_key || '').replace(/\D/g, '');
    const requestedStoreId = body?.store_id || null;

    if (accessKey.length !== 44) {
      throw new Error('Chave de acesso deve ter 44 dígitos');
    }

    // Check if already exists as a fiscal entry
    const { data: existingEntry } = await supabase
      .from('fiscal_entries')
      .select('id, status, store_id, supplier_id, nfe_number, access_key, stores(name), suppliers(name, cnpj)')
      .or(`access_key.eq.${accessKey}`)
      .limit(1);

    if (existingEntry && existingEntry.length > 0) {
      const entry = existingEntry[0];
      return jsonOk({
        found: true,
        source: 'local',
        entry_id: entry.id,
        entry_status: entry.status,
        message: entry.status === 'confirmed'
          ? 'Entrada fiscal já existe e está confirmada. Selecione-a na lista.'
          : `Entrada fiscal já existe com status "${entry.status}".`,
      });
    }

    // Get user's memberships to find stores with fiscal settings
    const { data: memberships } = await supabase
      .from('memberships')
      .select('account_id')
      .eq('user_id', user.id)
      .eq('is_active', true);

    const accountIds = [...new Set((memberships || []).map(m => m.account_id).filter(Boolean))];
    if (accountIds.length === 0) throw new Error('Nenhuma conta ativa');

    let storesQuery = supabase
      .from('stores')
      .select('id, name, cnpj, account_id, nfeio_settings!inner(api_key, environment, is_active)')
      .in('account_id', accountIds)
      .eq('nfeio_settings.is_active', true);

    if (requestedStoreId) {
      storesQuery = storesQuery.eq('id', requestedStoreId);
    }

    const { data: stores } = await storesQuery;
    if (!stores || stores.length === 0) {
      return jsonOk({ found: false, message: 'Nenhuma loja com integração fiscal ativa.' });
    }

    // Try to find the NF-e in Focus NFe nfes_recebidas
    for (const store of stores as any[]) {
      const settings = Array.isArray(store.nfeio_settings) ? store.nfeio_settings[0] : store.nfeio_settings;
      if (!settings?.api_key) continue;

      const baseUrl = settings.environment === 'prod'
        ? 'https://api.focusnfe.com.br'
        : 'https://homologacao.focusnfe.com.br';

      const response = await fetch(`${baseUrl}/v2/nfes_recebidas/${accessKey}.json`, {
        method: 'GET',
        headers: {
          Authorization: 'Basic ' + btoa(`${settings.api_key}:`),
        },
      });

      if (!response.ok) {
        const code = response.status;
        console.log(`Focus NFe lookup for store ${store.id}: status ${code}`);
        if (code === 404) continue;
        continue;
      }

      const payload = await response.json();
      console.log('Focus NFe received NF-e payload:', JSON.stringify(payload, null, 2));

      // Extract data from the received NF-e
      const emitente = payload.emitente || {};
      const items = payload.itens || payload.items || [];
      const nfeNumber = payload.numero ? String(payload.numero) : null;
      const nfeSeries = payload.serie ? String(payload.serie) : null;
      const issueDate = payload.data_emissao ? payload.data_emissao.substring(0, 10) : null;
      const totalProducts = Number(payload.valor_produtos || 0);
      const totalFreight = Number(payload.valor_frete || 0);
      const totalDiscount = Number(payload.valor_desconto || 0);
      const totalNfe = Number(payload.valor_total || payload.valor_nota || 0);

      // Find or create supplier
      const supplierCnpj = (emitente.cnpj || '').replace(/\D/g, '');
      const supplierName = emitente.nome || emitente.razao_social || 'Fornecedor NF-e';
      const supplierTradeName = emitente.nome_fantasia || null;

      let supplierId: string | null = null;
      if (supplierCnpj) {
        const { data: existingSupplier } = await supabase
          .from('suppliers')
          .select('id')
          .eq('account_id', store.account_id)
          .eq('cnpj', supplierCnpj)
          .limit(1);

        if (existingSupplier && existingSupplier.length > 0) {
          supplierId = existingSupplier[0].id;
        } else {
          const supplierAddr = emitente.endereco || {};
          const { data: newSupplier } = await supabase
            .from('suppliers')
            .insert({
              account_id: store.account_id,
              cnpj: supplierCnpj,
              name: supplierName,
              trade_name: supplierTradeName,
              address_json: {
                street: supplierAddr.logradouro || '',
                number: supplierAddr.numero || '',
                neighborhood: supplierAddr.bairro || '',
                city: supplierAddr.municipio || '',
                state: supplierAddr.uf || '',
                zip: supplierAddr.cep || '',
              },
            })
            .select('id')
            .single();

          if (newSupplier) supplierId = newSupplier.id;
        }
      }

      // Create the fiscal entry
      const { data: newEntry, error: entryError } = await supabase
        .from('fiscal_entries')
        .insert({
          account_id: store.account_id,
          store_id: store.id,
          supplier_id: supplierId,
          access_key: accessKey,
          nfe_number: nfeNumber,
          nfe_series: nfeSeries,
          issue_date: issueDate,
          total_products: totalProducts,
          total_freight: totalFreight,
          total_discount: totalDiscount,
          total_nfe: totalNfe,
          status: 'confirmed',
          created_by: user.id,
          confirmed_by: user.id,
          confirmed_at: new Date().toISOString(),
          notes: `Importada automaticamente via chave de acesso (devolução ao fornecedor)`,
        })
        .select('id')
        .single();

      if (entryError) {
        console.error('Error creating fiscal entry:', entryError);
        throw new Error('Erro ao criar entrada fiscal: ' + entryError.message);
      }

      // Create entry items
      const parsedItems = (items || []).map((item: any, index: number) => {
        const prod = item.produto || item;
        return {
          fiscal_entry_id: newEntry.id,
          description: prod.descricao || prod.nome || `Item ${index + 1}`,
          xml_code: prod.codigo || prod.codigo_produto || String(index + 1),
          ncm: prod.ncm || null,
          cfop: prod.cfop || null,
          unit: prod.unidade || prod.unidade_comercial || 'UN',
          quantity: Number(prod.quantidade || prod.quantidade_comercial || 1),
          unit_price: Number(prod.valor_unitario || prod.valor_unitario_comercial || 0),
          total_line: Number(prod.valor_total || prod.valor_bruto || 0),
          matched: false,
          created_product: false,
        };
      });

      if (parsedItems.length > 0) {
        // Try to match products by name or NCM
        for (const item of parsedItems) {
          const { data: matchedProduct } = await supabase
            .from('products')
            .select('id')
            .eq('account_id', store.account_id)
            .ilike('name', item.description)
            .limit(1);

          if (matchedProduct && matchedProduct.length > 0) {
            item.product_id = matchedProduct[0].id;
            item.matched = true;
          }
        }

        await supabase.from('fiscal_entry_items').insert(parsedItems);
      }

      // Also increase inventory for matched items
      for (const item of parsedItems) {
        if (item.product_id) {
          const { data: inv } = await supabase
            .from('inventory')
            .select('id, qty_on_hand')
            .eq('store_id', store.id)
            .eq('product_id', item.product_id)
            .maybeSingle();

          if (inv) {
            await supabase
              .from('inventory')
              .update({ qty_on_hand: inv.qty_on_hand + item.quantity, updated_at: new Date().toISOString() })
              .eq('id', inv.id);
          } else {
            await supabase
              .from('inventory')
              .insert({ store_id: store.id, product_id: item.product_id, qty_on_hand: item.quantity });
          }
        }
      }

      return jsonOk({
        found: true,
        source: 'remote',
        entry_id: newEntry.id,
        entry_status: 'confirmed',
        nfe_number: nfeNumber,
        supplier_name: supplierName,
        total_nfe: totalNfe,
        items_count: parsedItems.length,
        message: `NF-e ${nfeNumber || accessKey.substring(0, 10) + '...'} localizada e importada automaticamente!`,
      });
    }

    return jsonOk({
      found: false,
      message: 'Chave de acesso não encontrada no provedor fiscal. Verifique se a chave está correta e se a nota foi emitida contra o CNPJ de uma das suas lojas.',
    });
  } catch (error) {
    console.error('Error in lookup-received-nfe:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    );
  }
});

function jsonOk(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version', 'Content-Type': 'application/json' },
    status: 200,
  });
}
