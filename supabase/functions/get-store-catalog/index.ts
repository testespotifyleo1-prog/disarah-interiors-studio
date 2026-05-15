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
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");
    const lookupPhone = url.searchParams.get("lookup_phone");
    const singleProductId = url.searchParams.get("product_id");

    if (!slug) {
      return new Response(JSON.stringify({ error: "slug is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: settings, error: settingsError } = await supabase
      .from("store_ecommerce_settings")
      .select("*, stores(id, name, cnpj, pix_key, pix_key_type, address_json)")
      .eq("slug", slug)
      .eq("is_enabled", true)
      .maybeSingle();

    if (settingsError || !settings) {
      return new Response(JSON.stringify({ error: "Loja não encontrada" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const accountId = settings.account_id;
    const storeId = settings.store_id;

    // Fetch Mercado Pago connection (public_key + enabled methods + fees)
    const { data: mpConn } = await supabase
      .from("mp_connections")
      .select("public_key, enabled_methods, status, environment, credit_fee_percent, debit_fee_percent")
      .eq("store_id", storeId)
      .maybeSingle();
    const mpConfig = mpConn && mpConn.status === "connected" && mpConn.public_key
      ? {
          public_key: mpConn.public_key,
          enabled_methods: mpConn.enabled_methods || ["pix", "credit_card", "debit_card"],
          environment: mpConn.environment || "production",
          credit_fee_percent: Number(mpConn.credit_fee_percent || 0),
          debit_fee_percent: Number(mpConn.debit_fee_percent || 0),
        }
      : null;

    // Fetch the account's menu_theme so the storefront can render the right icon set
    const { data: accountRow } = await supabase
      .from("accounts")
      .select("menu_theme")
      .eq("id", accountId)
      .maybeSingle();
    const menuTheme = (accountRow?.menu_theme === "furniture" ? "furniture" : "party");

    // Order lookup by phone
    if (lookupPhone) {
      const cleanPhone = lookupPhone.replace(/\D/g, "");
      const { data: customers } = await supabase
        .from("customers")
        .select("id")
        .eq("account_id", accountId)
        .ilike("phone", `%${cleanPhone.slice(-8)}%`);

      const customerIds = (customers || []).map((c: any) => c.id);
      let orders: any[] = [];

      if (customerIds.length > 0) {
        const { data: salesData } = await supabase
          .from("sales")
          .select("id, order_number, total, status, created_at, source")
          .eq("account_id", accountId)
          .in("customer_id", customerIds)
          .order("created_at", { ascending: false })
          .limit(20);
        orders = salesData || [];

        if (orders.length > 0) {
          const saleIds = orders.map((o: any) => o.id);
          const { data: pickingData } = await supabase
            .from("picking_orders")
            .select("sale_id, public_token, status, tracking_code")
            .in("sale_id", saleIds);
          const byId: Record<string, any> = {};
          (pickingData || []).forEach((p: any) => { byId[p.sale_id] = p; });
          orders = orders.map((o: any) => ({
            ...o,
            tracking_token: byId[o.id]?.public_token || null,
            tracking_status: byId[o.id]?.status || null,
            tracking_code: byId[o.id]?.tracking_code || null,
          }));
        }
      }

      return new Response(JSON.stringify({ orders }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fast path: fetch a single product (used when opening product link from WhatsApp)
    if (singleProductId) {
      const { data: p } = await supabase
        .from("products")
        .select("id, name, price_default, sku, unit, gtin, image_url, description, brand, category, promo_price, promo_starts_at, promo_ends_at")
        .eq("id", singleProductId)
        .eq("account_id", accountId)
        .eq("is_active", true)
        .maybeSingle();
      if (!p) {
        return new Response(JSON.stringify({ error: "Produto não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: invRow } = await supabase
        .from("inventory")
        .select("qty_on_hand")
        .eq("store_id", storeId)
        .eq("product_id", p.id)
        .is("variant_id", null)
        .maybeSingle();
      const { data: imgs } = await supabase
        .from("product_images")
        .select("image_url, sort_order")
        .eq("product_id", p.id)
        .order("sort_order");
      const { data: variants } = await supabase
        .from("product_variants")
        .select("id, sku, gtin, price, attributes, is_active")
        .eq("product_id", p.id)
        .eq("is_active", true);
      const variantIds = (variants || []).map((v: any) => v.id);
      const variantImagesById = new Map<string, string[]>();
      const variantInventoryById = new Map<string, number>();
      if (variantIds.length > 0) {
        const { data: vimgs } = await supabase
          .from("product_variant_images")
          .select("variant_id, image_url, sort_order")
          .in("variant_id", variantIds)
          .order("sort_order");
        for (const img of vimgs || []) {
          const arr = variantImagesById.get(img.variant_id) || [];
          arr.push(img.image_url);
          variantImagesById.set(img.variant_id, arr);
        }
        const { data: vinv } = await supabase
          .from("inventory")
          .select("variant_id, qty_on_hand")
          .eq("store_id", storeId)
          .in("variant_id", variantIds);
        for (const row of vinv || []) {
          if (row.variant_id) variantInventoryById.set(row.variant_id, (variantInventoryById.get(row.variant_id) || 0) + Number(row.qty_on_hand || 0));
        }
      }
      const variantsOut = (variants || []).map((v: any) => ({
        id: v.id, sku: v.sku, gtin: v.gtin,
        price: Number(v.price) || 0,
        attributes: v.attributes || {},
        images: variantImagesById.get(v.id) || [],
        qty_available: variantInventoryById.get(v.id) || 0,
      }));
      let price_min: number | null = null, price_max: number | null = null;
      if (variantsOut.length > 0) {
        const prices = variantsOut.map((v: any) => v.price).filter((n: number) => n > 0);
        if (prices.length > 0) { price_min = Math.min(...prices); price_max = Math.max(...prices); }
      }
      const product = {
        ...p,
        qty_available: Number(invRow?.qty_on_hand || 0),
        gallery: (imgs || []).map((i: any) => i.image_url),
        variants: variantsOut,
        price_min, price_max,
      };
      return new Response(JSON.stringify({
        store: {
          id: storeId,
          name: settings.store_name || settings.stores?.name,
          primary_color: settings.primary_color,
          logo_url: settings.logo_url,
          whatsapp_number: settings.whatsapp_number,
          show_prices: settings.show_prices ?? true,
          show_whatsapp_button: settings.show_whatsapp_button ?? true,
        },
        product,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch ALL products recursively to overcome 1000-row limit
    let allProducts: any[] = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price_default, sku, unit, gtin, image_url, description, brand, category, promo_price, promo_starts_at, promo_ends_at")
        .eq("account_id", accountId)
        .eq("is_active", true)
        .order("name")
        .range(from, from + pageSize - 1);
      if (error || !data || data.length === 0) break;
      allProducts = allProducts.concat(data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    const { data: inventory } = await supabase
      .from("inventory")
      .select("product_id, qty_on_hand")
      .eq("store_id", storeId);

    const inventoryMap = new Map((inventory || []).map((i: any) => [i.product_id, i.qty_on_hand]));

    // Fetch additional product images (gallery) for all products
    const productIds = allProducts.map((p: any) => p.id);
    const galleryMap = new Map<string, string[]>();
    const variantsByProduct = new Map<string, any[]>();
    const variantImagesById = new Map<string, string[]>();
    const variantInventoryById = new Map<string, number>();

    if (productIds.length > 0) {
      // Chunk to avoid IN clause limits
      const chunkSize = 500;
      for (let i = 0; i < productIds.length; i += chunkSize) {
        const chunk = productIds.slice(i, i + chunkSize);
        const { data: imgs } = await supabase
          .from("product_images")
          .select("product_id, image_url, sort_order")
          .in("product_id", chunk)
          .order("sort_order");
        for (const img of imgs || []) {
          const arr = galleryMap.get(img.product_id) || [];
          arr.push(img.image_url);
          galleryMap.set(img.product_id, arr);
        }

        // Variants for these products
        const { data: variants } = await supabase
          .from("product_variants")
          .select("id, product_id, sku, gtin, price, attributes, is_active")
          .in("product_id", chunk)
          .eq("is_active", true);
        for (const v of variants || []) {
          const arr = variantsByProduct.get(v.product_id) || [];
          arr.push(v);
          variantsByProduct.set(v.product_id, arr);
        }
      }

      // Variant images & inventory (by variant_id)
      const allVariantIds: string[] = [];
      for (const arr of variantsByProduct.values()) for (const v of arr) allVariantIds.push(v.id);
      for (let i = 0; i < allVariantIds.length; i += 500) {
        const chunk = allVariantIds.slice(i, i + 500);
        const { data: vimgs } = await supabase
          .from("product_variant_images")
          .select("variant_id, image_url, sort_order")
          .in("variant_id", chunk)
          .order("sort_order");
        for (const img of vimgs || []) {
          const arr = variantImagesById.get(img.variant_id) || [];
          arr.push(img.image_url);
          variantImagesById.set(img.variant_id, arr);
        }
        const { data: vinv } = await supabase
          .from("inventory")
          .select("variant_id, qty_on_hand")
          .eq("store_id", storeId)
          .in("variant_id", chunk);
        for (const row of vinv || []) {
          if (row.variant_id) {
            variantInventoryById.set(row.variant_id, (variantInventoryById.get(row.variant_id) || 0) + Number(row.qty_on_hand || 0));
          }
        }
      }
    }

    const catalog = allProducts.map((p: any) => {
      const variantRows = variantsByProduct.get(p.id) || [];
      const variants = variantRows.map((v: any) => ({
        id: v.id,
        sku: v.sku,
        gtin: v.gtin,
        price: Number(v.price) || 0,
        attributes: v.attributes || {},
        images: variantImagesById.get(v.id) || [],
        qty_available: variantInventoryById.get(v.id) || 0,
      }));
      let price_min: number | null = null;
      let price_max: number | null = null;
      if (variants.length > 0) {
        const prices = variants.map((v: any) => v.price).filter((n: number) => n > 0);
        if (prices.length > 0) {
          price_min = Math.min(...prices);
          price_max = Math.max(...prices);
        }
      }
      return {
        ...p,
        qty_available: inventoryMap.get(p.id) || 0,
        gallery: galleryMap.get(p.id) || [],
        variants,
        price_min,
        price_max,
      };
    });

    const featuredIds: string[] = settings.featured_product_ids || [];

    // Build featured: diversified selection with images
    let featuredProducts: any[];
    if (featuredIds.length > 0) {
      featuredProducts = catalog.filter((p: any) => featuredIds.includes(p.id));
    } else {
      // Pick products with images, diversified by category/name prefix
      const withImages = catalog.filter((p: any) => p.image_url);
      
      // Group by a rough "type" (first word of name or category)
      const typeGroups = new Map<string, any[]>();
      for (const p of withImages) {
        const typeKey = p.category || p.name.split(" ")[0].toUpperCase();
        if (!typeGroups.has(typeKey)) typeGroups.set(typeKey, []);
        typeGroups.get(typeKey)!.push(p);
      }
      
      // Round-robin pick from each group to diversify
      const picked: any[] = [];
      const groups = Array.from(typeGroups.values());
      const indices = groups.map(() => 0);
      const maxPicks = 12;
      let round = 0;
      while (picked.length < maxPicks && round < 20) {
        for (let g = 0; g < groups.length && picked.length < maxPicks; g++) {
          if (indices[g] < groups[g].length) {
            // Prefer in-stock
            const group = groups[g];
            const inStock = group.filter((x: any) => x.qty_available > 0);
            const source = inStock.length > indices[g] ? inStock : group;
            if (indices[g] < source.length) {
              picked.push(source[indices[g]]);
            }
            indices[g]++;
          }
        }
        round++;
      }
      
      // If we got fewer than 12, fill with any image products
      if (picked.length < maxPicks) {
        const pickedIds = new Set(picked.map((p: any) => p.id));
        for (const p of withImages) {
          if (picked.length >= maxPicks) break;
          if (!pickedIds.has(p.id)) picked.push(p);
        }
      }
      
      featuredProducts = picked;
    }

    // Sort catalog: diversified - images first, then interleave by type
    const withPhoto = catalog.filter((p: any) => p.image_url);
    const withoutPhoto = catalog.filter((p: any) => !p.image_url);
    
    // Interleave withPhoto by category/type for variety
    const photoGroups = new Map<string, any[]>();
    for (const p of withPhoto) {
      const key = p.category || p.name.split(" ")[0].toUpperCase();
      if (!photoGroups.has(key)) photoGroups.set(key, []);
      photoGroups.get(key)!.push(p);
    }
    const interleaved: any[] = [];
    const pGroups = Array.from(photoGroups.values());
    const pIdx = pGroups.map(() => 0);
    let anyLeft = true;
    while (anyLeft) {
      anyLeft = false;
      for (let g = 0; g < pGroups.length; g++) {
        if (pIdx[g] < pGroups[g].length) {
          interleaved.push(pGroups[g][pIdx[g]]);
          pIdx[g]++;
          anyLeft = true;
        }
      }
    }
    
    const sortedCatalog = [...interleaved, ...withoutPhoto];

    // Detect which shipping integrations are active for this account (used by checkout)
    const [meRes, uberRes] = await Promise.all([
      supabase.from("melhor_envio_connections").select("id").eq("account_id", accountId).eq("is_active", true).maybeSingle(),
      supabase.from("uber_direct_connections").select("id").eq("account_id", accountId).eq("is_active", true).maybeSingle(),
    ]);
    const liveShipping = {
      melhor_envio: !!meRes.data,
      uber_direct: !!uberRes.data,
    };

    return new Response(JSON.stringify({
      store: {
        id: storeId,
        account_id: accountId,
        live_shipping: liveShipping,
        name: settings.store_name || settings.stores?.name,
        banner_text: settings.banner_text,
        description: settings.description,
        whatsapp_number: settings.whatsapp_number,
        primary_color: settings.primary_color,
        logo_url: settings.logo_url,
        banner_image_url: settings.banner_image_url,
        hero_subtitle: settings.hero_subtitle,
        show_prices: settings.show_prices ?? true,
        show_whatsapp_button: settings.show_whatsapp_button ?? true,
        categories: settings.categories || [],
        inline_banners: settings.inline_banners || [],
        header_menu: settings.header_menu || [],
        footer_cnpj: settings.footer_cnpj || null,
        footer_address: settings.footer_address || null,
        footer_phone: settings.footer_phone || null,
        footer_email: settings.footer_email || null,
        policy_privacy: settings.policy_privacy || null,
        policy_terms: settings.policy_terms || null,
        policy_purchase: settings.policy_purchase || null,
        policy_exchange: settings.policy_exchange || null,
        policy_shipping: settings.policy_shipping || null,
        about_us: settings.about_us || null,
        delivery_options: settings.delivery_options || [],
        payment_methods: settings.payment_methods || [],
        menu_theme: menuTheme,
        mercado_pago: mpConfig,
      },
      products: sortedCatalog,
      featured: featuredProducts,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
