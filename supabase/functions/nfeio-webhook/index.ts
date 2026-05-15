import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// This webhook now handles Focus NFe callbacks
// Focus NFe sends a POST with the reference and status when a document is processed
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const payload = await req.json();
    console.log('Focus NFe webhook received:', JSON.stringify(payload, null, 2));

    // Log the webhook event
    await supabase.from('webhook_events').insert({
      provider: 'focusnfe',
      event_type: payload.status || 'unknown',
      payload_json: payload,
      status: 'received',
    });

    // Focus NFe webhook payload contains: cnpj_emitente, ref, status, chave_nfe, etc.
    const ref = payload.ref;
    if (!ref) {
      console.warn('Webhook without ref, ignoring');
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    console.log(`Processing webhook for ref: ${ref}, status: ${payload.status}`);

    // Find the fiscal document by provider_id (which stores the ref)
    const { data: doc, error: docError } = await supabase
      .from('fiscal_documents')
      .select('*')
      .eq('provider_id', ref)
      .single();

    if (docError || !doc) {
      console.warn(`No fiscal document found for ref: ${ref}`);
      return new Response(JSON.stringify({ ok: true, message: 'Document not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Map Focus NFe status to our status
    const focusStatus = payload.status || '';
    const statusMap: Record<string, string> = {
      'autorizado': 'issued',
      'cancelado': 'cancelled',
      'processando_autorizacao': 'processing',
      'erro_autorizacao': 'error',
      'denegado': 'denied',
    };

    const newStatus = statusMap[focusStatus] || doc.status;

    // Get settings to build full URLs
    const { data: nfSettings } = await supabase
      .from('nfeio_settings')
      .select('environment')
      .eq('store_id', doc.store_id)
      .eq('is_active', true)
      .single();

    const baseUrl = nfSettings?.environment === 'prod'
      ? 'https://api.focusnfe.com.br'
      : 'https://homologacao.focusnfe.com.br';

    // Build update data
    const updateData: Record<string, any> = { status: newStatus };

    if (payload.chave_nfe) updateData.access_key = payload.chave_nfe;
    if (payload.numero) updateData.nfe_number = String(payload.numero);
    if (payload.caminho_danfe) updateData.pdf_url = `${baseUrl}${payload.caminho_danfe}`;
    if (payload.caminho_xml_nota_fiscal) updateData.xml_url = `${baseUrl}${payload.caminho_xml_nota_fiscal}`;
    if (payload.caminho_xml_cancelamento) updateData.xml_url = `${baseUrl}${payload.caminho_xml_cancelamento}`;

    // Update the fiscal document
    const { error: updateError } = await supabase
      .from('fiscal_documents')
      .update(updateData)
      .eq('id', doc.id);

    if (updateError) {
      console.error('Error updating fiscal document:', updateError);
    } else {
      console.log(`Document ${doc.id} updated via webhook: status=${newStatus}`);
    }

    // Mark webhook as processed
    await supabase
      .from('webhook_events')
      .update({ status: 'processed', processed_at: new Date().toISOString() })
      .eq('payload_json->>ref', ref)
      .eq('status', 'received');

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
