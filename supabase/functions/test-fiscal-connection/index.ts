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

    const { store_id } = await req.json();
    if (!store_id) throw new Error('store_id is required');

    // Get store CNPJ
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('cnpj, name')
      .eq('id', store_id)
      .single();

    if (storeError || !store) throw new Error('Loja não encontrada');

    // Get fiscal settings
    const { data: settings, error: settingsError } = await supabase
      .from('nfeio_settings')
      .select('api_key, environment')
      .eq('store_id', store_id)
      .eq('is_active', true)
      .single();

    if (settingsError || !settings) {
      return new Response(
        JSON.stringify({ success: false, message: 'Configurações fiscais não encontradas ou inativas para esta loja.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const baseUrl = settings.environment === 'prod'
      ? 'https://api.focusnfe.com.br'
      : 'https://homologacao.focusnfe.com.br';

    // Focus NFe: GET /v2/empresas to list authorized companies
    const focusResponse = await fetch(`${baseUrl}/v2/empresas`, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + btoa(settings.api_key + ':'),
      },
    });

    const responseText = await focusResponse.text();
    console.log('Focus NFe test connection response:', focusResponse.status, responseText.substring(0, 500));

    if (!focusResponse.ok) {
      // 403 = token invalid, 401 = unauthorized
      if (focusResponse.status === 403 || focusResponse.status === 401) {
        return new Response(
          JSON.stringify({ success: false, message: 'Token inválido ou sem permissão. Verifique o token da API.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
      return new Response(
        JSON.stringify({ success: false, message: `Erro ao conectar com Focus NFe (HTTP ${focusResponse.status}).` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    let companies: any[];
    try {
      companies = JSON.parse(responseText);
    } catch {
      return new Response(
        JSON.stringify({ success: false, message: 'Resposta inesperada da Focus NFe.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Check if the store's CNPJ is among authorized companies
    const storeCnpjDigits = (store.cnpj || '').replace(/\D/g, '');
    const found = Array.isArray(companies) && companies.some((c: any) => {
      const companyCnpj = (c.cnpj || c.cnpj_emitente || '').replace(/\D/g, '');
      return companyCnpj === storeCnpjDigits;
    });

    if (!found) {
      const registeredCnpjs = Array.isArray(companies)
        ? companies.map((c: any) => (c.cnpj || c.cnpj_emitente || 'N/A')).join(', ')
        : 'nenhum';

      return new Response(
        JSON.stringify({
          success: false,
          message: `Token válido, mas o CNPJ ${storeCnpjDigits} da loja "${store.name}" não está autorizado nesta conta Focus NFe. CNPJs autorizados: ${registeredCnpjs}.`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Conexão OK! Token válido e CNPJ ${storeCnpjDigits} autorizado no ambiente ${settings.environment === 'prod' ? 'Produção' : 'Homologação'}.`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, message: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
