import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Faz backup de XMLs (issued, sem backup) — pode ser chamado por cron OU manual
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Auth opcional: se vier do cron, sem header.
    let limitAccount: string | null = null;
    const auth = req.headers.get('Authorization');
    if (auth && auth.startsWith('Bearer ')) {
      const { data: { user } } = await supabase.auth.getUser(auth.replace('Bearer ', ''));
      if (user) {
        const body = await req.json().catch(() => ({}));
        limitAccount = body.account_id || null;
      }
    }

    // Pega documentos emitidos sem backup
    let q = supabase
      .from('fiscal_documents')
      .select('id, store_id, access_key, xml_url, type, stores!inner(account_id)')
      .eq('status', 'issued')
      .not('access_key', 'is', null)
      .not('xml_url', 'is', null)
      .limit(200);
    if (limitAccount) q = q.eq('stores.account_id', limitAccount);

    const { data: docs } = await q;
    if (!docs || docs.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let saved = 0, skipped = 0, errors = 0;
    for (const d of docs as any[]) {
      const accountId = d.stores.account_id;
      // Já existe?
      const { data: exists } = await supabase
        .from('fiscal_xml_backups').select('id').eq('account_id', accountId).eq('chave_nfe', d.access_key).maybeSingle();
      if (exists) { skipped++; continue; }

      try {
        // Pega settings da loja para Authorization
        const { data: s } = await supabase
          .from('nfeio_settings').select('api_key').eq('store_id', d.store_id).eq('is_active', true).single();
        if (!s) { errors++; continue; }

        const xmlResp = await fetch(d.xml_url, {
          headers: { 'Authorization': 'Basic ' + btoa(s.api_key + ':') },
        });
        if (!xmlResp.ok) { errors++; continue; }
        const xmlText = await xmlResp.text();
        const bytes = new TextEncoder().encode(xmlText);

        const date = new Date();
        const path = `${accountId}/${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${d.access_key}.xml`;

        const { error: upErr } = await supabase.storage.from('fiscal-xmls').upload(path, bytes, {
          contentType: 'application/xml', upsert: true,
        });
        if (upErr) { errors++; continue; }

        await supabase.from('fiscal_xml_backups').insert({
          account_id: accountId, store_id: d.store_id,
          fiscal_document_id: d.id, chave_nfe: d.access_key,
          storage_path: path, size_bytes: bytes.length,
        });
        saved++;
      } catch (e) {
        console.error('Backup error', d.id, e);
        errors++;
      }
    }

    return new Response(JSON.stringify({ success: true, processed: docs.length, saved, skipped, errors }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
