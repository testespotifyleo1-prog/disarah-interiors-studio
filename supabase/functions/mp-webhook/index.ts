// Webhook do Mercado Pago: atualiza status dos pagamentos de forma idempotente.
// Mapeia: approved -> paid, rejected/cancelled -> failed/canceled.
// O trigger mp_payments_finalize_sale cuida de marcar a venda como paga (e baixar estoque).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const url = new URL(req.url);
    let body: any = {};
    try { body = await req.json(); } catch { /* MP às vezes envia query */ }

    const topic = body?.type || body?.topic || url.searchParams.get('type') || url.searchParams.get('topic');
    const dataId = body?.data?.id || url.searchParams.get('data.id') || url.searchParams.get('id');

    console.log('MP webhook in:', { topic, dataId });

    if (!dataId) return new Response('ok', { headers: corsHeaders });
    if (topic !== 'payment' && topic !== 'merchant_order') return new Response('ok', { headers: corsHeaders });

    if (topic === 'payment') {
      // Idempotência: sempre buscamos o estado mais recente direto na MP
      const { data: localPayment } = await supabase
        .from('mp_payments')
        .select('id, status, sale_id, connection_id, mp_connections(access_token)')
        .eq('mp_payment_id', String(dataId))
        .maybeSingle();

      const accessToken = (localPayment as any)?.mp_connections?.access_token;
      if (!accessToken) {
        console.warn('No local payment / token for MP payment', dataId);
        return new Response('ok', { headers: corsHeaders });
      }

      const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      const mpData = await mpRes.json();
      if (!mpRes.ok) {
        console.error('MP fetch err', mpData);
        return new Response('ok', { headers: corsHeaders });
      }

      // Mapear status MP -> nosso enum
      const rawStatus: string = mpData.status || 'pending';
      let mappedStatus: string = rawStatus;
      if (rawStatus === 'approved') mappedStatus = 'approved';
      else if (rawStatus === 'rejected') mappedStatus = 'rejected';
      else if (rawStatus === 'cancelled' || rawStatus === 'canceled') mappedStatus = 'cancelled';
      else if (rawStatus === 'refunded' || rawStatus === 'charged_back') mappedStatus = 'refunded';
      else mappedStatus = 'pending';

      // Idempotência: só atualiza se mudou ou se ainda não estava aprovado
      if (localPayment?.status === mappedStatus && mappedStatus !== 'approved') {
        return new Response('ok', { headers: corsHeaders });
      }

      const updateData: any = {
        status: mappedStatus,
        raw_payload: mpData,
        installments: mpData.installments || null,
        card_brand: mpData.payment_method_id || null,
        method:
          mpData.payment_type_id === 'credit_card' ? 'credit_card'
          : mpData.payment_type_id === 'debit_card' ? 'debit_card'
          : 'pix',
        updated_at: new Date().toISOString(),
      };
      if (mappedStatus === 'approved') updateData.approved_at = new Date().toISOString();

      const { error: upErr } = await supabase
        .from('mp_payments')
        .update(updateData)
        .eq('mp_payment_id', String(dataId));

      if (upErr) console.error('mp_payments update error', upErr);
      else console.log('MP payment', dataId, '->', mappedStatus);
    }

    return new Response('ok', { headers: corsHeaders });
  } catch (e) {
    console.error('mp-webhook error', e);
    return new Response('ok', { headers: corsHeaders });
  }
});
