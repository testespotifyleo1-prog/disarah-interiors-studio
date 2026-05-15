// Cria pagamento com cartão (crédito/débito) no Mercado Pago via Checkout Transparente.
// Recebe um card_token gerado no front com MP.js (PCI-safe — número do cartão nunca entra no servidor).
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

    const body = await req.json();
    const {
      store_id, amount, sale_id,
      token, payment_method_id, payer_email, identification,
      installments = 1, issuer_id,
      method, // 'credit_card' | 'debit_card'
      source = 'ecommerce',
    } = body;

    if (!store_id || !amount || !token || !payment_method_id || !payer_email) {
      return new Response(JSON.stringify({ error: 'Parâmetros inválidos' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: conn } = await supabase
      .from('mp_connections')
      .select('*')
      .eq('store_id', store_id)
      .maybeSingle();

    if (!conn?.access_token || conn.status !== 'connected') {
      return new Response(JSON.stringify({ error: 'Loja sem Mercado Pago conectado' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const extRef = `${source}-${sale_id || crypto.randomUUID()}`;
    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/mp-webhook`;

    const mpBody: any = {
      transaction_amount: Number(amount),
      token,
      description: `Venda ${sale_id || ''}`.trim(),
      installments: Number(installments) || 1,
      payment_method_id,
      external_reference: extRef,
      notification_url: webhookUrl,
      payer: {
        email: payer_email,
        ...(identification ? { identification } : {}),
      },
    };
    if (issuer_id) mpBody.issuer_id = issuer_id;

    const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${conn.access_token}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify(mpBody),
    });

    const mpData = await mpRes.json();
    if (!mpRes.ok) {
      console.error('MP card error', mpData);
      return new Response(JSON.stringify({
        error: mpData.message || 'Erro no pagamento com cartão',
        details: mpData,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const cardMethod = mpData.payment_type_id === 'debit_card' ? 'debit_card' : 'credit_card';

    const { data: paymentRow } = await supabase.from('mp_payments').insert({
      account_id: conn.account_id,
      store_id: conn.store_id,
      connection_id: conn.id,
      sale_id: sale_id || null,
      external_reference: extRef,
      source,
      method: method || cardMethod,
      amount: Number(amount),
      status: mpData.status === 'approved' ? 'approved'
            : mpData.status === 'rejected' ? 'rejected'
            : 'pending',
      mp_payment_id: String(mpData.id),
      installments: Number(installments) || 1,
      card_brand: mpData.payment_method_id || null,
      payer_email,
      raw_payload: mpData,
      approved_at: mpData.status === 'approved' ? new Date().toISOString() : null,
    }).select().single();

    return new Response(JSON.stringify({
      success: mpData.status === 'approved',
      status: mpData.status,
      status_detail: mpData.status_detail,
      mp_payment_id: mpData.id,
      payment: paymentRow,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('mp-create-card error', e);
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
