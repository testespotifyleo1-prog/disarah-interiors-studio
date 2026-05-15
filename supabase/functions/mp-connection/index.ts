// Conecta/desconecta/testa credenciais do Mercado Pago de uma loja
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

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const body = await req.json();
    const {
      action, store_id, account_id, access_token, public_key, environment,
      enabled_methods, point_device_id, point_device_name,
      credit_fee_percent, debit_fee_percent,
    } = body;

    if (action === 'disconnect') {
      await supabase.from('mp_connections')
        .update({ status: 'disconnected', access_token: null, public_key: null, mp_user_id: null, nickname: null })
        .eq('store_id', store_id);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'connect' || action === 'test') {
      if (!access_token) return new Response(JSON.stringify({ error: 'access_token obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const meRes = await fetch('https://api.mercadopago.com/users/me', {
        headers: { 'Authorization': `Bearer ${access_token}` },
      });
      const me = await meRes.json();
      if (!meRes.ok) {
        return new Response(JSON.stringify({ error: 'Token inválido', details: me }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'test') {
        return new Response(JSON.stringify({ success: true, nickname: me.nickname, mp_user_id: String(me.id) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: existing } = await supabase.from('mp_connections').select('id').eq('store_id', store_id).maybeSingle();
      const payload: any = {
        account_id, store_id,
        access_token, public_key: public_key || null,
        mp_user_id: String(me.id), nickname: me.nickname,
        environment: environment || 'production',
        enabled_methods: enabled_methods || ['pix','credit_card','debit_card'],
        point_device_id: point_device_id || null,
        point_device_name: point_device_name || null,
        credit_fee_percent: Number(credit_fee_percent) || 0,
        debit_fee_percent: Number(debit_fee_percent) || 0,
        status: 'connected',
        connected_at: new Date().toISOString(),
        connected_by: user.id,
        last_error: null,
      };

      if (existing) {
        await supabase.from('mp_connections').update(payload).eq('id', existing.id);
      } else {
        await supabase.from('mp_connections').insert(payload);
      }

      return new Response(JSON.stringify({ success: true, nickname: me.nickname }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'list_devices') {
      // Lista maquininhas Point disponíveis na conta
      const { data: conn } = await supabase.from('mp_connections').select('access_token').eq('store_id', store_id).maybeSingle();
      if (!conn?.access_token) return new Response(JSON.stringify({ error: 'Loja não conectada' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const devRes = await fetch('https://api.mercadopago.com/point/integration-api/devices', {
        headers: { 'Authorization': `Bearer ${conn.access_token}` },
      });
      const devices = await devRes.json();
      return new Response(JSON.stringify({ success: true, devices }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Ação inválida' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('mp-connection error', e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
