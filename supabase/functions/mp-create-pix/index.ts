// Cria cobrança PIX dinâmica via Mercado Pago para uma loja
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Auth opcional: PDV envia token; e-commerce não.

    const body = await req.json();
    const { store_id, amount, description, sale_id, external_reference, payer_email, source = 'pdv' } = body;

    if (!store_id || !amount || amount <= 0) {
      return new Response(JSON.stringify({ error: 'Parâmetros inválidos' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Busca conexão MP da loja
    const { data: conn, error: connError } = await supabase
      .from('mp_connections')
      .select('*')
      .eq('store_id', store_id)
      .maybeSingle();

    if (connError || !conn || conn.status !== 'connected' || !conn.access_token) {
      return new Response(JSON.stringify({ error: 'Loja sem Mercado Pago conectado' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const extRef = external_reference || `${source}-${sale_id || crypto.randomUUID()}`;
    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/mp-webhook`;

    // Cria pagamento PIX no Mercado Pago
    const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${conn.access_token}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({
        transaction_amount: Number(amount),
        description: description || `Venda ${sale_id || ''}`,
        payment_method_id: 'pix',
        external_reference: extRef,
        notification_url: webhookUrl,
        payer: {
          email: payer_email || 'cliente@typoserp.com.br',
        },
        date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      }),
    });

    const mpData = await mpRes.json();
    if (!mpRes.ok) {
      console.error('MP PIX error:', mpData);
      return new Response(JSON.stringify({ error: mpData.message || 'Erro ao criar PIX no Mercado Pago', details: mpData }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const tx = mpData.point_of_interaction?.transaction_data;

    // Salva no banco
    const { data: paymentRow, error: insErr } = await supabase
      .from('mp_payments')
      .insert({
        account_id: conn.account_id,
        store_id: conn.store_id,
        connection_id: conn.id,
        sale_id: sale_id || null,
        external_reference: extRef,
        source,
        method: 'pix',
        amount: Number(amount),
        status: mpData.status || 'pending',
        mp_payment_id: String(mpData.id),
        pix_qr_code: tx?.qr_code || null,
        pix_qr_code_base64: tx?.qr_code_base64 || null,
        pix_copy_paste: tx?.qr_code || null,
        pix_expires_at: mpData.date_of_expiration || null,
        payer_email: payer_email || null,
        raw_payload: mpData,
      })
      .select()
      .single();

    if (insErr) {
      console.error('Insert error:', insErr);
    }

    return new Response(JSON.stringify({
      success: true,
      payment: paymentRow,
      qr_code: tx?.qr_code,
      qr_code_base64: tx?.qr_code_base64,
      mp_payment_id: mpData.id,
      expires_at: mpData.date_of_expiration,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('mp-create-pix error', e);
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
