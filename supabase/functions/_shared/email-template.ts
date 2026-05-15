// Shared HTML template builder for branded transactional/offer emails.
// Uses inline styles only — works in Gmail, Outlook, Apple Mail, etc.

export interface EmailBrand {
  storeName: string;
  logoUrl?: string | null; // public URL or null
  primaryColor?: string;   // hex, default brand orange
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  footerNote?: string | null;
}

export interface OfferEmailData {
  brand: EmailBrand;
  customerName?: string | null;
  headline: string;
  body: string;
  imageUrl?: string | null;
  highlightPrice?: string | null;
  highlightOldPrice?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
}

export interface FiscalEmailData {
  brand: EmailBrand;
  customerName?: string | null;
  documentType: "NFe" | "NFC-e";
  saleNumber?: string | number | null;
  total?: string | null;
  pdfUrl?: string | null;
  xmlUrl?: string | null;
  accessKey?: string | null;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const safe = (s: string | null | undefined) => (s ? escapeHtml(s) : "");
const nl2br = (s: string) => escapeHtml(s).replace(/\n/g, "<br/>");

function brandHeader(brand: EmailBrand): string {
  const color = brand.primaryColor || "#C45E1A";
  const logo = brand.logoUrl
    ? `<img src="${escapeHtml(brand.logoUrl)}" alt="${safe(brand.storeName)}" style="max-height:56px;max-width:200px;display:block;margin:0 auto;" />`
    : `<div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:26px;font-weight:800;color:${color};letter-spacing:-0.5px;text-align:center;">${safe(brand.storeName)}</div>`;
  return `
    <tr>
      <td align="center" style="padding:32px 24px 24px;background:#ffffff;border-bottom:3px solid ${color};">
        ${logo}
      </td>
    </tr>`;
}

function brandFooter(brand: EmailBrand): string {
  const lines: string[] = [];
  if (brand.address) lines.push(safe(brand.address));
  if (brand.phone) lines.push(safe(brand.phone));
  if (brand.website) lines.push(`<a href="${escapeHtml(brand.website)}" style="color:#888;text-decoration:underline;">${safe(brand.website)}</a>`);
  const tagline = brand.footerNote ? `<div style="margin-top:12px;font-style:italic;color:#aaa;">${safe(brand.footerNote)}</div>` : "";
  return `
    <tr>
      <td style="padding:24px;background:#f8f8f8;text-align:center;font-family:'Helvetica Neue',Arial,sans-serif;font-size:12px;color:#888;line-height:1.6;">
        <strong style="color:#555;">${safe(brand.storeName)}</strong><br/>
        ${lines.join(" &middot; ")}
        ${tagline}
        <div style="margin-top:14px;font-size:11px;color:#bbb;">Você está recebendo este email porque é cliente da nossa loja.</div>
      </td>
    </tr>`;
}

function shell(brand: EmailBrand, inner: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${safe(brand.storeName)}</title>
</head>
<body style="margin:0;padding:0;background:#f0f0f0;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f0f0f0;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.06);max-width:600px;width:100%;">
        ${brandHeader(brand)}
        ${inner}
        ${brandFooter(brand)}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function buildOfferEmail(data: OfferEmailData): string {
  const color = data.brand.primaryColor || "#C45E1A";
  const greeting = data.customerName
    ? `<p style="margin:0 0 8px;font-size:15px;color:#666;">Olá, <strong>${safe(data.customerName)}</strong>!</p>`
    : "";

  const image = data.imageUrl
    ? `<tr><td style="padding:0 32px;"><img src="${escapeHtml(data.imageUrl)}" alt="" style="display:block;width:100%;max-width:536px;height:auto;border-radius:8px;margin:0 0 20px;" /></td></tr>`
    : "";

  const priceBlock = data.highlightPrice
    ? `<tr><td style="padding:0 32px 20px;text-align:center;">
        ${data.highlightOldPrice ? `<div style="font-size:14px;color:#999;text-decoration:line-through;">${safe(data.highlightOldPrice)}</div>` : ""}
        <div style="font-size:36px;font-weight:800;color:${color};line-height:1.1;margin-top:4px;">${safe(data.highlightPrice)}</div>
      </td></tr>`
    : "";

  const cta = data.ctaLabel && data.ctaUrl
    ? `<tr><td align="center" style="padding:8px 32px 32px;">
        <a href="${escapeHtml(data.ctaUrl)}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;padding:14px 36px;border-radius:999px;font-weight:700;font-size:15px;letter-spacing:0.3px;box-shadow:0 4px 12px ${color}55;">${safe(data.ctaLabel)}</a>
      </td></tr>`
    : "";

  const inner = `
    <tr><td style="padding:32px 32px 8px;">
      ${greeting}
      <h1 style="margin:0 0 16px;font-size:26px;line-height:1.25;color:#1a1a1a;font-weight:800;letter-spacing:-0.3px;">${safe(data.headline)}</h1>
    </td></tr>
    ${image}
    ${priceBlock}
    <tr><td style="padding:0 32px 24px;font-size:15px;line-height:1.65;color:#444;">
      ${nl2br(data.body)}
    </td></tr>
    ${cta}`;

  return shell(data.brand, inner);
}

export function buildFiscalEmail(data: FiscalEmailData): string {
  const color = data.brand.primaryColor || "#C45E1A";
  const greeting = data.customerName
    ? `<p style="margin:0 0 8px;font-size:15px;color:#666;">Olá, <strong>${safe(data.customerName)}</strong>!</p>`
    : "";

  const cta = data.pdfUrl
    ? `<tr><td align="center" style="padding:8px 32px 12px;">
        <a href="${escapeHtml(data.pdfUrl)}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px;">Baixar ${safe(data.documentType)} (PDF)</a>
      </td></tr>`
    : "";

  const xml = data.xmlUrl
    ? `<tr><td align="center" style="padding:0 32px 16px;">
        <a href="${escapeHtml(data.xmlUrl)}" style="color:${color};text-decoration:underline;font-size:13px;">Baixar XML</a>
      </td></tr>`
    : "";

  const meta: string[] = [];
  if (data.saleNumber) meta.push(`<tr><td style="padding:6px 0;color:#666;font-size:14px;">Pedido: <strong style="color:#1a1a1a;">#${safe(String(data.saleNumber))}</strong></td></tr>`);
  if (data.total) meta.push(`<tr><td style="padding:6px 0;color:#666;font-size:14px;">Valor total: <strong style="color:#1a1a1a;">${safe(data.total)}</strong></td></tr>`);
  if (data.accessKey) meta.push(`<tr><td style="padding:6px 0;color:#666;font-size:12px;word-break:break-all;">Chave de acesso:<br/><span style="font-family:monospace;color:#1a1a1a;">${safe(data.accessKey)}</span></td></tr>`);

  const metaTable = meta.length
    ? `<tr><td style="padding:0 32px 24px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fafafa;border-radius:8px;padding:16px;">
          ${meta.join("")}
        </table>
      </td></tr>`
    : "";

  const inner = `
    <tr><td style="padding:32px 32px 8px;">
      ${greeting}
      <h1 style="margin:0 0 8px;font-size:24px;line-height:1.25;color:#1a1a1a;font-weight:800;">Sua ${safe(data.documentType)} chegou! 🎉</h1>
      <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.6;">Obrigado pela compra! Segue abaixo o link para acessar sua nota fiscal.</p>
    </td></tr>
    ${metaTable}
    ${cta}
    ${xml}
    <tr><td style="padding:0 32px 32px;font-size:13px;line-height:1.6;color:#888;">
      Guarde este email — você poderá precisar do PDF e XML para fins de garantia, troca ou contabilidade.
    </td></tr>`;

  return shell(data.brand, inner);
}

export const RESEND_GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
export const DEFAULT_FROM = "Typos! ERP <noreply@typoserp.com.br>";

export async function sendViaResend(opts: {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
  attachments?: Array<{ filename: string; content: string }>; // base64 content
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
    return { ok: false, error: "Email service not configured" };
  }

  const from = opts.fromName
    ? `${opts.fromName.replace(/[<>]/g, "")} <noreply@typoserp.com.br>`
    : DEFAULT_FROM;

  const body: Record<string, unknown> = {
    from,
    to: [opts.to],
    subject: opts.subject,
    html: opts.html,
  };
  if (opts.attachments?.length) body.attachments = opts.attachments;

  try {
    const r = await fetch(`${RESEND_GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return { ok: false, error: `Resend ${r.status}: ${JSON.stringify(data)}` };
    }
    return { ok: true, id: (data as any)?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function buildBrandFromStoreAndAccount(store: any, account: any, supabaseUrl: string): EmailBrand {
  const logoPath = store?.logo_path as string | undefined;
  const logoUrl = logoPath
    ? `${supabaseUrl}/storage/v1/object/public/store-assets/${logoPath}`
    : null;
  const addr = store?.address_json || {};
  const addressLine = [addr?.street, addr?.number, addr?.city, addr?.state]
    .filter(Boolean).join(", ");
  return {
    storeName: store?.name || account?.name || "Loja",
    logoUrl,
    primaryColor: "#C45E1A",
    address: addressLine || null,
    phone: store?.phone || null,
    website: null,
    footerNote: null,
  };
}
