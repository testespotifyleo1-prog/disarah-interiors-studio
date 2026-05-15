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

    const { fiscal_document_id, justificativa } = await req.json();
    if (!fiscal_document_id) throw new Error('fiscal_document_id is required');

    const justif = justificativa || 'Cancelamento solicitado pelo emissor';
    if (justif.length < 15 || justif.length > 255) {
      throw new Error('Justificativa deve ter entre 15 e 255 caracteres.');
    }

    console.log(`Cancelling fiscal document: ${fiscal_document_id}`);

    const { data: doc, error: docError } = await supabase
      .from('fiscal_documents')
      .select('*')
      .eq('id', fiscal_document_id)
      .single();

    if (docError || !doc) throw new Error('Documento fiscal não encontrado');
    if (!doc.provider_id) throw new Error('Documento sem referência do provedor.');
    if (doc.status !== 'issued') throw new Error('Somente notas autorizadas podem ser canceladas.');

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

    const docType = doc.type === 'nfce' ? 'nfce' : 'nfe';
    const ref = doc.provider_id;

    console.log(`Cancelling ${docType} ref: ${ref} via Focus NFe`);

    // Focus NFe cancel: DELETE /v2/nfe/REFERENCIA with {"justificativa":"..."}
    const focusResponse = await fetch(
      `${baseUrl}/v2/${docType}/${encodeURIComponent(ref)}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': 'Basic ' + btoa(focusToken + ':'),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ justificativa: justif }),
      }
    );

    const responseText = await focusResponse.text();
    console.log('Focus NFe cancel response:', responseText);

    let focusData: any;
    try {
      focusData = JSON.parse(responseText);
    } catch {
      focusData = { raw: responseText };
    }

    if (!focusResponse.ok) {
      throw new Error(`Erro ao cancelar: ${focusData.mensagem || JSON.stringify(focusData)}`);
    }

    const focusStatus = focusData.status || '';
    if (focusStatus === 'cancelado' || focusResponse.ok) {
      // Update fiscal document
      const updateData: Record<string, any> = { status: 'cancelled' };
      if (focusData.caminho_xml_cancelamento) {
        updateData.xml_url = `${baseUrl}${focusData.caminho_xml_cancelamento}`;
      }

      await supabase
        .from('fiscal_documents')
        .update(updateData)
        .eq('id', fiscal_document_id);

      console.log(`Document ${fiscal_document_id} cancelled successfully`);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Nota fiscal cancelada com sucesso.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error in cancel-fiscal-document:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
