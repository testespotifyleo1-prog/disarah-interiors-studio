import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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

    const { fiscal_document_id } = await req.json();
    if (!fiscal_document_id) throw new Error('fiscal_document_id is required');

    console.log(`Checking status for fiscal document: ${fiscal_document_id}`);

    const { data: doc, error: docError } = await supabase
      .from('fiscal_documents')
      .select('*')
      .eq('id', fiscal_document_id)
      .single();

    if (docError || !doc) throw new Error('Documento fiscal não encontrado');
    if (!doc.provider_id) throw new Error('Documento sem referência do provedor.');

    // Get fiscal settings
    const { data: nfSettings, error: nfError } = await supabase
      .from('nfeio_settings')
      .select('*')
      .eq('store_id', doc.store_id)
      .eq('is_active', true)
      .single();

    if (nfError || !nfSettings) throw new Error('Configurações fiscais não encontradas.');

    const focusToken = nfSettings.api_key;
    const baseUrl = nfSettings.environment === 'prod'
      ? 'https://api.focusnfe.com.br'
      : 'https://homologacao.focusnfe.com.br';

    // Determine endpoint based on doc type
    const docType = doc.type === 'nfce' ? 'nfce' : 'nfe';
    const ref = doc.provider_id;

    console.log(`Polling Focus NFe for ${docType} ref: ${ref}`);

    const focusResponse = await fetch(
      `${baseUrl}/v2/${docType}/${encodeURIComponent(ref)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': 'Basic ' + btoa(focusToken + ':'),
        },
      }
    );

    const responseText = await focusResponse.text();
    console.log('Focus NFe status response:', responseText);

    let focusData: any;
    try {
      focusData = JSON.parse(responseText);
    } catch {
      throw new Error(`Resposta inválida da API. Status: ${focusResponse.status}`);
    }

    if (!focusResponse.ok) {
      throw new Error(`Erro Focus NFe: ${focusData.mensagem || JSON.stringify(focusData)}`);
    }

    // Map Focus NFe status to our status
    const focusStatus = focusData.status || '';
    const statusMap: Record<string, string> = {
      'autorizado': 'issued',
      'cancelado': 'cancelled',
      'processando_autorizacao': 'processing',
      'erro_autorizacao': 'error',
      'denegado': 'denied',
    };

    const newStatus = statusMap[focusStatus] || doc.status;

    // Extract URLs and access key
    let pdfUrl = doc.pdf_url;
    let xmlUrl = doc.xml_url;
    let accessKey = doc.access_key;
    let errorMessage: string | null = null;
    let nfeNumber: string | null = doc.nfe_number || null;

    if (newStatus === 'issued') {
      if (focusData.caminho_danfe) pdfUrl = `${baseUrl}${focusData.caminho_danfe}`;
      if (focusData.caminho_xml_nota_fiscal) xmlUrl = `${baseUrl}${focusData.caminho_xml_nota_fiscal}`;
      accessKey = focusData.chave_nfe || accessKey;
      nfeNumber = focusData.numero ? String(focusData.numero) : nfeNumber;
    }

    if (newStatus === 'error' || newStatus === 'denied') {
      errorMessage = focusData.mensagem_sefaz || focusData.mensagem || null;
    }

    // Update the fiscal document
    const updateData: Record<string, any> = { status: newStatus };
    if (accessKey) updateData.access_key = accessKey;
    if (nfeNumber) updateData.nfe_number = nfeNumber;
    if (pdfUrl) updateData.pdf_url = pdfUrl;
    if (xmlUrl) updateData.xml_url = xmlUrl;

    const { error: updateError } = await supabase
      .from('fiscal_documents')
      .update(updateData)
      .eq('id', fiscal_document_id);

    if (updateError) throw new Error('Erro ao atualizar documento fiscal');

    const statusLabels: Record<string, string> = {
      'processing': 'Em processamento',
      'issued': 'Autorizada',
      'cancelled': 'Cancelada',
      'denied': 'Denegada',
      'error': 'Erro na SEFAZ',
    };

    return new Response(
      JSON.stringify({
        success: true,
        status: newStatus,
        status_label: statusLabels[newStatus] || newStatus,
        pdf_url: pdfUrl || null,
        xml_url: xmlUrl || null,
        access_key: accessKey,
        nfe_number: nfeNumber,
        focus_status: focusStatus,
        error_message: errorMessage,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error in check-fiscal-status:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
