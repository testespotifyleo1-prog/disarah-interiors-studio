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

    const url = new URL(req.url);
    const docId = url.searchParams.get('doc_id');
    const format = url.searchParams.get('format') || 'pdf';

    if (!docId) throw new Error('doc_id is required');

    // Get fiscal document
    const { data: doc, error: docError } = await supabase
      .from('fiscal_documents')
      .select('*')
      .eq('id', docId)
      .single();

    if (docError || !doc) throw new Error('Documento fiscal não encontrado');

    // For Focus NFe, the PDF/XML URLs are stored directly in the document
    // They are full URLs like https://api.focusnfe.com.br/arquivos/...
    const fileUrl = format === 'pdf' ? doc.pdf_url : doc.xml_url;

    if (!fileUrl) {
      throw new Error(`${format.toUpperCase()} não disponível para este documento.`);
    }

    // Get fiscal settings for authentication
    const { data: nfSettings, error: nfError } = await supabase
      .from('nfeio_settings')
      .select('*')
      .eq('store_id', doc.store_id)
      .eq('is_active', true)
      .single();

    if (nfError || !nfSettings) throw new Error('Configurações fiscais não encontradas.');

    const focusToken = nfSettings.api_key;

    console.log(`Downloading ${format} from Focus NFe: ${fileUrl}`);

    // Download the file with authentication
    const fileResponse = await fetch(fileUrl, {
      headers: {
        'Authorization': 'Basic ' + btoa(focusToken + ':'),
      },
    });

    if (!fileResponse.ok) {
      const errorText = await fileResponse.text();
      console.error(`Focus NFe ${format} download error:`, errorText);
      throw new Error(`${format.toUpperCase()} não disponível. Status: ${fileResponse.status}`);
    }

    const fileData = await fileResponse.arrayBuffer();
    
    // Detect actual content type from response or URL
    const responseContentType = fileResponse.headers.get('content-type') || '';
    const isHtml = responseContentType.includes('text/html') || fileUrl.endsWith('.html');
    
    let contentType: string;
    let fileExtension: string;
    
    if (format === 'xml') {
      contentType = 'text/xml';
      fileExtension = 'xml';
    } else if (isHtml) {
      // NFC-e from Focus NFe returns HTML DANFE, not PDF
      contentType = 'text/html';
      fileExtension = 'html';
    } else {
      contentType = 'application/pdf';
      fileExtension = 'pdf';
    }

    return new Response(fileData, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="nota-${doc.type}-${doc.id.substring(0, 8)}.${fileExtension}"`,
      },
      status: 200,
    });
  } catch (error) {
    console.error('Error in download-fiscal-file:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
