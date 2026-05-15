import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { slug, customer_name, customer_phone, customer_document, address, items, notes, payment_preference, delivery_type, delivery_fee, coupon_code } = body;
    const deliveryFeeNum = Number(delivery_fee) || 0;

    if (!slug || !customer_name || !customer_phone || !items || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: "Dados obrigatórios: slug, customer_name, customer_phone, items" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get store settings
    const { data: settings } = await supabase
      .from("store_ecommerce_settings")
      .select("*, stores(id, account_id, name)")
      .eq("slug", slug)
      .eq("is_enabled", true)
      .maybeSingle();

    if (!settings || !settings.stores) {
      return new Response(JSON.stringify({ error: "Loja não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const accountId = settings.account_id;
    const storeId = settings.store_id;

    // Validate stock for all items
    const productIds = items.map((i: any) => i.product_id);
    const variantIds = items.map((i: any) => i.variant_id).filter(Boolean);
    const { data: products } = await supabase
      .from("products")
      .select("id, name, price_default, cost_default, unit")
      .eq("account_id", accountId)
      .eq("is_active", true)
      .in("id", productIds);

    if (!products || products.length !== new Set(productIds).size) {
      return new Response(JSON.stringify({ error: "Alguns produtos não foram encontrados" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Load variants if any item references one
    const variantsMap = new Map<string, any>();
    if (variantIds.length > 0) {
      const { data: variantRows } = await supabase
        .from("product_variants")
        .select("id, product_id, sku, price, cost, attributes, is_active")
        .in("id", variantIds);
      for (const v of variantRows || []) variantsMap.set(v.id, v);
    }

    // Inventory: by product (when no variant) and by variant
    const { data: inventory } = await supabase
      .from("inventory")
      .select("product_id, variant_id, qty_on_hand")
      .eq("store_id", storeId)
      .in("product_id", productIds);

    const productInvMap = new Map<string, number>();
    const variantInvMap = new Map<string, number>();
    for (const row of inventory || []) {
      if (row.variant_id) {
        variantInvMap.set(row.variant_id, (variantInvMap.get(row.variant_id) || 0) + Number(row.qty_on_hand || 0));
      } else {
        productInvMap.set(row.product_id, (productInvMap.get(row.product_id) || 0) + Number(row.qty_on_hand || 0));
      }
    }

    const outOfStock: string[] = [];
    for (const item of items) {
      const prod = products.find((p: any) => p.id === item.product_id);
      const variant = item.variant_id ? variantsMap.get(item.variant_id) : null;
      const available = item.variant_id
        ? (variantInvMap.get(item.variant_id) || 0)
        : (productInvMap.get(item.product_id) || 0);
      if (available < item.qty) {
        const variantLabel = variant ? ` (${Object.values(variant.attributes || {}).join(' / ')})` : '';
        outOfStock.push(`${prod?.name || item.product_id}${variantLabel} (disponível: ${available}, pedido: ${item.qty})`);
      }
    }

    if (outOfStock.length > 0) {
      return new Response(JSON.stringify({ error: "Produtos sem estoque suficiente", details: outOfStock }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Find or create customer
    let customerId: string | null = null;
    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("id")
      .eq("account_id", accountId)
      .eq("phone", customer_phone)
      .maybeSingle();

    if (existingCustomer) {
      customerId = existingCustomer.id;
      // Update address if provided
      if (address) {
        await supabase.from("customers").update({ address_json: address, name: customer_name }).eq("id", customerId);
      }
    } else {
      const { data: newCustomer } = await supabase
        .from("customers")
        .insert({
          account_id: accountId,
          name: customer_name,
          phone: customer_phone,
          document: customer_document || null,
          address_json: address || null,
        })
        .select("id")
        .single();
      customerId = newCustomer?.id || null;
    }

    // Get a seller user id for the ecommerce (use account owner)
    const { data: ownerAccount } = await supabase
      .from("accounts")
      .select("owner_user_id")
      .eq("id", accountId)
      .single();

    const sellerUserId = ownerAccount?.owner_user_id;
    if (!sellerUserId) {
      return new Response(JSON.stringify({ error: "Configuração inválida da loja" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Calculate totals
    let subtotal = 0;
    const saleItems: any[] = [];
    for (const item of items) {
      const prod = products.find((p: any) => p.id === item.product_id);
      if (!prod) continue;
      const variant = item.variant_id ? variantsMap.get(item.variant_id) : null;
      const unitPrice = variant ? Number(variant.price) : Number(prod.price_default);
      const unitCost = variant ? Number(variant.cost || 0) : Number(prod.cost_default || 0);
      const totalLine = unitPrice * item.qty;
      subtotal += totalLine;
      saleItems.push({
        product_id: item.product_id,
        variant_id: item.variant_id || null,
        qty: item.qty,
        unit_price: unitPrice,
        unit_cost: unitCost,
        total_line: totalLine,
      });
    }

    // Validate coupon (if provided) — must belong to this customer
    let couponDiscount = 0;
    let couponData: any = null;
    if (coupon_code && customerId) {
      const { data: cVal, error: cErr } = await supabase.rpc('validate_birthday_coupon', {
        _code: coupon_code,
        _account_id: accountId,
        _customer_id: customerId,
        _subtotal: subtotal,
      });
      if (cErr) {
        return new Response(JSON.stringify({ error: `Cupom inválido: ${cErr.message}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      couponData = cVal;
      couponDiscount = Number((cVal as any)?.discount_amount || 0);
    } else if (coupon_code && !customerId) {
      return new Response(JSON.stringify({ error: 'Cupom requer cliente cadastrado.' }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Create sale
    const totalWithDelivery = Math.max(0, subtotal - couponDiscount + deliveryFeeNum);
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .insert({
        account_id: accountId,
        store_id: storeId,
        seller_user_id: sellerUserId,
        customer_id: customerId,
        status: "open",
        subtotal,
        total: totalWithDelivery,
        discount: couponDiscount,
        delivery_fee: deliveryFeeNum,
        source: "ecommerce",
        notes: [
          notes ? `Obs cliente: ${notes}` : null,
          payment_preference ? `Preferência pagamento: ${payment_preference}` : null,
          delivery_type ? `Tipo entrega: ${delivery_type}` : null,
          coupon_code ? `Cupom: ${coupon_code}` : null,
          address ? `Endereço: ${address.street || ''}, ${address.number || ''} - ${address.neighborhood || ''}, ${address.city || ''}-${address.state || ''} CEP: ${address.zip || ''}` : null,
        ].filter(Boolean).join('\n'),
      })
      .select("id, order_number")
      .single();

    if (saleError || !sale) {
      console.error("Sale error:", saleError);
      return new Response(JSON.stringify({ error: "Erro ao criar pedido" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Insert sale items
    const itemsWithSaleId = saleItems.map(si => ({ ...si, sale_id: sale.id }));
    await supabase.from("sale_items").insert(itemsWithSaleId);

    // Redeem coupon (mark as used)
    if (couponData && customerId) {
      await supabase.rpc('redeem_birthday_coupon', {
        _code: coupon_code,
        _account_id: accountId,
        _customer_id: customerId,
        _sale_id: sale.id,
      });
    }

    return new Response(JSON.stringify({
      success: true,
      order_number: sale.order_number,
      sale_id: sale.id,
      account_id: accountId,
      store_id: storeId,
      total: totalWithDelivery,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
