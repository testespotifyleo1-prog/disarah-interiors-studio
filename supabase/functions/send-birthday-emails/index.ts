// Birthday campaign sender — runs hourly, sends emails via Resend Connector Gateway (typoserp.com.br)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const FROM_EMAIL = 'noreply@typoserp.com.br';
const DEFAULT_FROM_NAME = 'Typos! ERP';

interface Setting {
  id: string;
  account_id: string;
  store_id: string;
  enabled: boolean;
  send_email: boolean;
  email_subject: string;
  email_message: string;
  email_html_template: string | null;
  template_mode: 'default' | 'html';
  coupon_enabled: boolean;
  coupon_code: string | null;
  coupon_description: string | null;
  coupon_valid_days: number;
  coupon_discount_type: 'percent' | 'fixed';
  coupon_discount_value: number;
  coupon_prefix: string | null;
  send_hour: number;
  from_name: string | null;
  reply_to: string | null;
}

function renderVariables(text: string, vars: Record<string, string>) {
  let out = text || '';
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{${k}}`, v ?? '');
  }
  return out;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function buildDefaultHtml(s: Setting, customerName: string, storeName: string, vars: Record<string, string>, logoUrl: string | null) {
  const message = renderVariables(s.email_message, vars);
  const messageHtml = escapeHtml(message).replace(/\n/g, '<br>');
  const logoBlock = logoUrl
    ? `<div style="text-align:center;margin-bottom:20px;"><img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(storeName)}" style="max-height:70px;max-width:220px;display:inline-block;" /></div>`
    : '';

  const couponBlock = s.coupon_enabled && vars.cupom
    ? `
      <div style="margin:24px 0;padding:20px;border:2px dashed #C45E1A;border-radius:12px;text-align:center;background:#FFF7F0;">
        <p style="margin:0 0 6px;font-size:13px;color:#666;text-transform:uppercase;letter-spacing:1px;">Seu presente</p>
        <p style="margin:0 0 8px;font-size:28px;font-weight:bold;color:#C45E1A;letter-spacing:2px;">${escapeHtml(vars.cupom)}</p>
        ${s.coupon_description ? `<p style="margin:0 0 8px;font-size:14px;color:#333;">${escapeHtml(vars.oferta)}</p>` : ''}
        <p style="margin:0;font-size:12px;color:#999;">Válido até ${escapeHtml(vars.validade)}</p>
      </div>` : '';

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="background:#fff;border-radius:16px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
      ${logoBlock}
      <h1 style="margin:0 0 8px;color:#C45E1A;font-size:28px;">🎉 Feliz Aniversário, ${escapeHtml(vars.primeiro_nome)}!</h1>
      <p style="margin:0 0 20px;color:#444;font-size:16px;line-height:1.6;">${messageHtml}</p>
      ${couponBlock}
      <p style="margin:24px 0 0;font-size:13px;color:#999;text-align:center;">Com carinho,<br><strong>${escapeHtml(storeName)}</strong></p>
    </div>
    <p style="text-align:center;font-size:11px;color:#bbb;margin-top:16px;">Você recebeu este e-mail porque é cliente cadastrado da ${escapeHtml(storeName)}.</p>
  </div>
</body></html>`;
}

function buildCustomHtml(template: string, vars: Record<string, string>, logoUrl: string | null) {
  // Inject logo URL as a variable for use in custom templates
  const varsWithLogo = {
    ...vars,
    logo: logoUrl || '',
    logo_img: logoUrl ? `<img src="${logoUrl}" alt="${vars.loja || ''}" style="max-height:70px;max-width:220px;display:block;margin:0 auto 16px;" />` : '',
  };
  const rendered = renderVariables(template, varsWithLogo);
  if (/<html[\s>]/i.test(rendered)) return rendered;
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#ffffff;font-family:'Segoe UI',Arial,sans-serif;">${rendered}</body></html>`;
}

function getStoreLogoUrl(logoPath: string | null | undefined): string | null {
  if (!logoPath) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/store-assets/${logoPath}`;
}

async function sendResend(to: string, subject: string, html: string, fromName: string | null, replyTo: string | null) {
  const from = `${fromName || DEFAULT_FROM_NAME} <${FROM_EMAIL}>`;
  const body: Record<string, unknown> = { from, to: [to], subject, html };
  if (replyTo) body.reply_to = replyTo;

  // Prefer connector gateway when LOVABLE_API_KEY is present (Resend managed by connector)
  const useGateway = !!LOVABLE_API_KEY;
  const url = useGateway
    ? 'https://connector-gateway.lovable.dev/resend/emails'
    : 'https://api.resend.com/emails';

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (useGateway) {
    headers['Authorization'] = `Bearer ${LOVABLE_API_KEY}`;
    headers['X-Connection-Api-Key'] = RESEND_API_KEY || '';
  } else {
    headers['Authorization'] = `Bearer ${RESEND_API_KEY}`;
  }

  const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Resend ${r.status}: ${JSON.stringify(data)}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY não configurado. Conecte o Resend em Connectors.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const now = new Date();
  const month = now.getUTCMonth() + 1;
  const day = now.getUTCDate();
  const year = now.getUTCFullYear();
  const brHour = (now.getUTCHours() - 3 + 24) % 24;

  // Body overrides
  let forceStore: string | null = null;
  let dryRun = false;
  let testEmail: string | null = null;
  let previewOnly = false;
  try {
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      forceStore = body.force_store_id || null;
      dryRun = !!body.dry_run;
      testEmail = body.test_email || null;
      previewOnly = !!body.preview_only;
    }
  } catch (_) {}

  // ---- TEST EMAIL MODE: send sample to a specific address ----
  if (testEmail && forceStore) {
    const { data: cfg } = await supabase
      .from('birthday_campaign_settings')
      .select('*')
      .eq('store_id', forceStore)
      .maybeSingle();
    if (!cfg) {
      return new Response(JSON.stringify({ error: 'Configuração não encontrada para esta loja' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const s = cfg as Setting;
    const { data: storeRow } = await supabase.from('stores').select('name, logo_path').eq('id', s.store_id).maybeSingle();
    const storeName = storeRow?.name || 'Nossa loja';
    const logoUrl = getStoreLogoUrl((storeRow as any)?.logo_path);
    const customerName = 'Cliente Teste';
    const validUntil = new Date(); validUntil.setDate(validUntil.getDate() + s.coupon_valid_days);
    const sampleCode = `${(s.coupon_prefix || 'ANIVER').toUpperCase()}-EXEMPLO1`;
    const offerText = s.coupon_enabled
      ? (s.coupon_discount_type === 'percent'
          ? `${s.coupon_discount_value}% OFF`
          : `R$ ${Number(s.coupon_discount_value).toFixed(2)} de desconto`)
        + (s.coupon_description ? ` — ${s.coupon_description}` : '')
      : '';
    const vars = {
      nome: customerName, primeiro_nome: customerName.split(' ')[0], loja: storeName,
      cupom: sampleCode, oferta: offerText,
      validade: validUntil.toLocaleDateString('pt-BR'),
    };
    const subject = '[TESTE] ' + renderVariables(s.email_subject, vars);
    const html = s.template_mode === 'html' && s.email_html_template
      ? buildCustomHtml(s.email_html_template, vars, logoUrl)
      : buildDefaultHtml(s, customerName, storeName, vars, logoUrl);

    if (previewOnly) {
      return new Response(JSON.stringify({ success: true, subject, html }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    try {
      const result = await sendResend(testEmail, subject, html, s.from_name, s.reply_to);
      return new Response(JSON.stringify({ success: true, mode: 'test', to: testEmail, resend: result }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ success: false, error: e.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  // ---- BATCH MODE ----
  const { data: settingsRows, error: sErr } = await supabase
    .from('birthday_campaign_settings').select('*').eq('enabled', true);
  if (sErr) {
    return new Response(JSON.stringify({ error: sErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const settings = (settingsRows as Setting[]).filter(s =>
    s.send_email && (forceStore ? s.store_id === forceStore : s.send_hour === brHour)
  );

  let totalSent = 0;
  let totalSkipped = 0;
  const errors: string[] = [];

  for (const s of settings) {
    const { data: storeRow } = await supabase.from('stores').select('name, logo_path').eq('id', s.store_id).maybeSingle();
    const storeName = storeRow?.name || 'Nossa loja';
    const logoUrl = getStoreLogoUrl((storeRow as any)?.logo_path);

    const { data: customers, error: cErr } = await supabase
      .from('customers')
      .select('id, name, email, birth_date')
      .eq('account_id', s.account_id)
      .not('email', 'is', null)
      .not('birth_date', 'is', null);
    if (cErr) { errors.push(`store ${s.store_id}: ${cErr.message}`); continue; }

    const todays = (customers || []).filter((c: any) => {
      if (!c.birth_date) return false;
      const [_y, m, d] = c.birth_date.split('-').map(Number);
      return m === month && d === day;
    });

    for (const c of todays as any[]) {
      // Skip only if there's a SUCCESSFUL send for this year (allow retry on failures)
      const { data: logHit } = await supabase
        .from('birthday_send_log').select('id, status')
        .eq('store_id', s.store_id).eq('customer_id', c.id)
        .eq('channel', 'email').eq('sent_year', year)
        .in('status', ['sent', 'dry_run'])
        .maybeSingle();
      if (logHit) { totalSkipped++; continue; }

      const validUntil = new Date(); validUntil.setDate(validUntil.getDate() + s.coupon_valid_days);
      const validUntilIso = validUntil.toISOString().slice(0, 10);

      // Generate a UNIQUE single-use coupon code for this customer if coupons enabled
      let couponCode = '';
      let offerText = '';
      if (s.coupon_enabled) {
        const { data: existing } = await supabase
          .from('birthday_coupons')
          .select('code, valid_until')
          .eq('customer_id', c.id)
          .eq('account_id', s.account_id)
          .eq('source', 'birthday')
          .eq('status', 'active')
          .gte('valid_until', new Date().toISOString().slice(0, 10))
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existing?.code) {
          couponCode = existing.code;
        } else {
          const { data: codeData, error: codeErr } = await supabase
            .rpc('generate_unique_birthday_coupon_code', { _prefix: s.coupon_prefix || 'ANIVER' });
          if (codeErr || !codeData) {
            errors.push(`coupon-gen ${c.email}: ${codeErr?.message || 'falha ao gerar código'}`);
            continue;
          }
          couponCode = codeData as string;
          if (!dryRun) {
            const { error: insErr } = await supabase.from('birthday_coupons').insert({
              account_id: s.account_id, store_id: s.store_id, customer_id: c.id,
              code: couponCode,
              discount_type: s.coupon_discount_type || 'percent',
              discount_value: s.coupon_discount_value || 0,
              description: s.coupon_description || null,
              valid_until: validUntilIso, status: 'active', source: 'birthday',
            });
            if (insErr) { errors.push(`coupon-ins ${c.email}: ${insErr.message}`); continue; }
          }
        }
        offerText = (s.coupon_discount_type === 'percent'
          ? `${s.coupon_discount_value}% OFF`
          : `R$ ${Number(s.coupon_discount_value).toFixed(2)} de desconto`)
          + (s.coupon_description ? ` — ${s.coupon_description}` : '');
      }

      const vars = {
        nome: c.name, primeiro_nome: c.name.split(' ')[0] || c.name, loja: storeName,
        cupom: couponCode, oferta: offerText,
        validade: validUntil.toLocaleDateString('pt-BR'),
      };
      const subject = renderVariables(s.email_subject, vars);
      const html = s.template_mode === 'html' && s.email_html_template
        ? buildCustomHtml(s.email_html_template, vars, logoUrl)
        : buildDefaultHtml(s, c.name, storeName, vars, logoUrl);

      try {
        if (!dryRun) await sendResend(c.email, subject, html, s.from_name, s.reply_to);
        await supabase.from('birthday_send_log').insert({
          account_id: s.account_id, store_id: s.store_id, customer_id: c.id,
          channel: 'email', sent_year: year, status: dryRun ? 'dry_run' : 'sent',
        });
        totalSent++;
      } catch (e: any) {
        await supabase.from('birthday_send_log').insert({
          account_id: s.account_id, store_id: s.store_id, customer_id: c.id,
          channel: 'email', sent_year: year, status: 'failed', error: e.message?.slice(0, 500),
        });
        errors.push(`${c.email}: ${e.message}`);
      }
    }
  }

  return new Response(JSON.stringify({
    success: true, processed_settings: settings.length, sent: totalSent, skipped: totalSkipped,
    errors_count: errors.length, errors: errors.slice(0, 20), br_hour: brHour, date: `${year}-${month}-${day}`,
  }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
