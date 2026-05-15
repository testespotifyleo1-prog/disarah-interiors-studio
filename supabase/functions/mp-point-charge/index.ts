// Cobra na maquininha Point do Mercado Pago (cartão crédito/débito)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Missing auth' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { store_id, amount, sale_id, method = 'credit_card', installments = 1 } = await req.json();
    if (!store_id || !amount) return new Response(JSON.stringify({ error: 'Parâmetros inválidos' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: conn } = await supabase.from('mp_connections').select('*').eq('store_id', store_id).maybeSingle();
    if (!conn?.access_token || !conn?.point_device_id) {
      return new Response(JSON.stringify({ error: 'Maquininha Point não configurada para esta loja' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const extRef = `point-${sale_id || crypto.randomUUID()}`;

    const pointRes = await fetch(`https://api.mercadopago.com/point/integration-api/devices/${conn.point_device_id}/payment-intents`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${conn.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(Number(amount) * 100), // Point usa centavos
        additional_info: {
          external_reference: extRef,
          print_on_terminal: true,
        },
        payment: {
          installments: Number(installments) || 1,
          type: method === 'debit_card' ? 'debit_card' : 'credit_card',
          installments_cost: 'seller',
        },
      }),
    });

    const pointData = await pointRes.json();
    if (!pointRes.ok) {
      console.error('Point error', pointData);
      return new Response(JSON.stringify({ error: pointData.message || 'Erro ao enviar para maquininha', details: pointData }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: paymentRow } = await supabase.from('mp_payments').insert({
      account_id: conn.account_id,
      store_id: conn.store_id,
      connection_id: conn.id,
      sale_id: sale_id || null,
      external_reference: extRef,
      source: 'point',
      method,
      amount: Number(amount),
      status: 'pending',
      mp_payment_id: pointData.id || null,
      installments,
      point_device_id: conn.point_device_id,
      raw_payload: pointData,
    }).select().single();

    return new Response(JSON.stringify({ success: true, payment: paymentRow, intent: pointData }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('mp-point-charge error', e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
