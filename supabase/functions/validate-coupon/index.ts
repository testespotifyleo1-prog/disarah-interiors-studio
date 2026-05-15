// Public coupon validator for the e-commerce storefront.
// Looks up the customer by phone within the store's account, then validates the coupon.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function normalizePhone(p: string) {
  return (p || '').replace(/\D/g, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { slug, code, phone, subtotal } = await req.json();
    if (!slug || !code || !phone) {
      return new Response(JSON.stringify({ error: 'Informe slug, code e phone' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Resolve store/account from slug
    const { data: settings } = await supabase
      .from('store_ecommerce_settings')
      .select('account_id, store_id')
      .eq('slug', slug)
      .eq('is_enabled', true)
      .maybeSingle();
    if (!settings) {
      return new Response(JSON.stringify({ error: 'Loja não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Find the customer by phone (digits only) within this account
    const phoneDigits = normalizePhone(phone);
    const { data: customers } = await supabase
      .from('customers')
      .select('id, name, phone')
      .eq('account_id', settings.account_id)
      .limit(50);
    const customer = (customers || []).find((c: any) => normalizePhone(c.phone || '') === phoneDigits);
    if (!customer) {
      return new Response(JSON.stringify({ error: 'Cliente não localizado pelo telefone informado. Cupons são pessoais e exigem cadastro.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data, error } = await supabase.rpc('validate_birthday_coupon', {
      _code: code,
      _account_id: settings.account_id,
      _customer_id: customer.id,
      _subtotal: Number(subtotal) || 0,
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, coupon: data, customer_id: customer.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
