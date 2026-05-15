import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const normalizeDigits = (value: string) => value.replace(/\D/g, '');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
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
    const accessKey = normalizeDigits(body?.access_key || '');
    const requestedStoreId = body?.store_id || null;

    if (accessKey.length !== 44) {
      throw new Error('Informe uma chave de acesso válida com 44 dígitos');
    }

    const { data: memberships, error: membershipsError } = await supabase
      .from('memberships')
      .select('account_id')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (membershipsError) throw membershipsError;

    const accountIds = [...new Set((memberships || []).map((item) => item.account_id).filter(Boolean))];
    if (accountIds.length === 0) {
      return jsonResponse({ found: false, message: 'Nenhuma conta ativa encontrada para o usuário.' });
    }

    let storesQuery = supabase
      .from('stores')
      .select('id, name, cnpj, account_id, nfeio_settings!inner(api_key, environment, is_active)')
      .in('account_id', accountIds)
      .eq('nfeio_settings.is_active', true);

    if (requestedStoreId) {
      storesQuery = storesQuery.eq('id', requestedStoreId);
    }

    const { data: stores, error: storesError } = await storesQuery;
    if (storesError) throw storesError;

    if (!stores || stores.length === 0) {
      return jsonResponse({ found: false, message: 'Nenhuma loja com integração fiscal ativa foi encontrada.' });
    }

    const { data: localDoc, error: localDocError } = await supabase
      .from('fiscal_documents')
      .select('id, sale_id, store_id, type, provider_id, nfe_number, status, access_key, purpose, ref_fiscal_document_id, return_note_id, pdf_url, xml_url, created_at, sales(id, total, created_at, order_number, customer_id, customers(name, document)), stores(name)')
      .eq('purpose', 'normal')
      .limit(1);

    if (localDocError) throw localDocError;

    const matchedLocal = (localDoc || []).find((doc: any) => normalizeDigits(doc.access_key || '') === accessKey);
    if (matchedLocal) {
      return jsonResponse({ found: true, source: 'local', document: matchedLocal });
    }

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

      const rawText = await response.text();
      let payload: any = null;

      try {
        payload = rawText ? JSON.parse(rawText) : null;
      } catch {
        payload = null;
      }

      if (!response.ok) {
        const code = payload?.codigo || '';
        if (response.status === 404 || code === 'nao_encontrado' || code === 'permissao_negada') {
          continue;
        }
        continue;
      }

      return jsonResponse({
        found: true,
        source: 'remote',
        document: {
          id: `remote-${accessKey}`,
          sale_id: null,
          store_id: store.id,
          type: 'nfe',
          provider_id: null,
          nfe_number: payload?.numero ? String(payload.numero) : null,
          status: 'issued',
          access_key: accessKey,
          purpose: 'normal',
          ref_fiscal_document_id: null,
          return_note_id: null,
          pdf_url: null,
          xml_url: null,
          created_at: payload?.data_emissao || new Date().toISOString(),
          source: 'remote',
          can_emit_return: false,
          remote_party_name: payload?.emitente?.nome || payload?.nome_emitente || 'NF-e localizada',
          lookup_message: 'A chave foi localizada no backend fiscal, mas essa nota antiga não está vinculada a uma venda local. A emissão automática de devolução neste módulo funciona apenas para notas emitidas e salvas no sistema.',
          stores: { name: store.name },
          sales: { total: Number(payload?.valor_total || 0), customers: { name: payload?.emitente?.nome || payload?.nome_emitente || 'NF-e localizada', document: payload?.emitente?.cnpj || payload?.emitente?.cpf || null } },
        },
      });
    }

    return jsonResponse({
      found: false,
      message: 'A chave não foi localizada nas lojas com integração fiscal ativa. Se esta for uma nota antiga de fornecedor/entrada, o módulo atual de devolução automática ainda não consegue emitir a devolução a partir dela.',
    });
  } catch (error) {
    console.error('Error in lookup-fiscal-document-by-key:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    );
  }
});

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  });
}