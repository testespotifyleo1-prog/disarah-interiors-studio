import type { SaleWithDetails } from '@/types/database';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeText(value?: string | null, fallback = '') {
  const text = value?.toString().trim();
  return text ? text : fallback;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value || 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 3,
    maximumFractionDigits: 3,
  }).format(value || 0);
}

function formatCNPJ(cnpj?: string | null) {
  const digits = (cnpj || '').replace(/\D/g, '');
  if (digits.length !== 14) return normalizeText(cnpj);
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

function formatAddress(address: any) {
  if (!address) return '';

  const street = address.street || address.logradouro;
  const number = address.number || address.numero;
  const district = address.district || address.bairro || address.neighborhood;
  const city = address.city || address.cidade || address.localidade;
  const state = address.state || address.uf;

  return [
    [street, number].filter(Boolean).join(', '),
    district,
    [city, state].filter(Boolean).join(' - '),
  ].filter(Boolean).join(' • ');
}

function getPaymentMethodLabel(method?: string, cardType?: string) {
  if (method === 'pix') return 'PIX';
  if (method === 'cash') return 'DINHEIRO';
  if (method === 'card') return cardType === 'credit' ? 'CARTÃO CRÉDITO' : 'CARTÃO DÉBITO';
  if (method === 'crediario') return 'CREDIÁRIO';
  if (method === 'financeira') return 'FINANCEIRA';
  return normalizeText(method, 'PAGAMENTO').toUpperCase();
}

function renderMoneyRow(label: string, value: string, extraClass = '') {
  return `
    <div class="row ${extraClass}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

export function buildThermalReceiptHtml(sale: SaleWithDetails) {
  const orderNumber = String((sale as any).sale_number || sale.id.slice(0, 8).toUpperCase());
  const saleDate = new Date(sale.created_at).toLocaleString('pt-BR');
  const printedAt = new Date().toLocaleString('pt-BR');
  const storeName = normalizeText(sale.stores?.name, 'LOJA');
  const storeAddress = formatAddress(sale.stores?.address_json);
  const items = sale.sale_items || [];
  const payments = sale.payments || [];
  const itemCount = items.reduce((sum: number, item: any) => sum + Number(item.qty || 0), 0);

  const itemsHtml = items.map((item: any, index: number) => {
    const code = normalizeText(item.products?.sku || item.products?.gtin, String(index + 1).padStart(3, '0'));
    const description = normalizeText(item.products?.name, 'PRODUTO').toUpperCase();
    const unit = normalizeText(item.presentation_name || item.products?.unit, 'UN').toUpperCase();
    const qty = formatNumber(Number(item.qty || 0));
    const unitPrice = formatCurrency(Number(item.unit_price || 0));
    const totalLine = formatCurrency(Number(item.total_line || 0));

    return `
      <div class="item">
        <div class="row item-top">
          <span class="item-code">${escapeHtml(code)}</span>
          <strong>${escapeHtml(totalLine)}</strong>
        </div>
        <div class="item-name">${escapeHtml(description)}</div>
        <div class="item-meta">${escapeHtml(`${qty} ${unit} x ${unitPrice}`)}</div>
      </div>
    `;
  }).join('');

  const paymentsHtml = payments.length > 0
    ? `
      <div class="divider"></div>
      <div class="section-title">PAGAMENTOS</div>
      ${payments.map((payment: any) => {
        const method = getPaymentMethodLabel(payment.method, payment.card_type);
        const details = [
          payment.brand ? payment.brand.toUpperCase() : null,
          payment.installments > 1 ? `${payment.installments}X` : null,
        ].filter(Boolean).join(' • ');

        return `
          <div class="payment-block">
            <div class="row">
              <span>${escapeHtml(method)}</span>
              <strong>${escapeHtml(formatCurrency(Number(payment.paid_value || 0)))}</strong>
            </div>
            ${details ? `<div class="small muted">${escapeHtml(details)}</div>` : ''}
          </div>
        `;
      }).join('')}
    `
    : '';

  const customerHtml = sale.customers
    ? `
      <div class="divider"></div>
      <div class="section-title">CLIENTE</div>
      <div>${escapeHtml(normalizeText(sale.customers.name, 'CONSUMIDOR FINAL').toUpperCase())}</div>
      ${(sale.customers as any).document ? `<div class="small">DOC: ${escapeHtml((sale.customers as any).document)}</div>` : ''}
      ${(sale.customers as any).phone ? `<div class="small">FONE: ${escapeHtml((sale.customers as any).phone)}</div>` : ''}
    `
    : '';

  return `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Comprovante de compra</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 4mm 3mm;
          }

          html, body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #000000;
            font-family: "Courier New", "Liberation Mono", monospace;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          body {
            width: 74mm;
            margin: 0 auto;
            padding: 0;
            font-size: 11px;
            line-height: 1.28;
          }

          .receipt {
            padding: 0;
          }

          .center {
            text-align: center;
          }

          .title {
            font-size: 14px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .subtitle {
            font-size: 10px;
            text-transform: uppercase;
            margin-top: 2px;
          }

          .small {
            font-size: 10px;
          }

          .muted {
            opacity: 0.86;
          }

          .divider {
            border-top: 1px dashed #000;
            margin: 6px 0;
          }

          .row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 8px;
          }

          .row > span:last-child,
          .row > strong:last-child {
            text-align: right;
            white-space: nowrap;
          }

          .section-title {
            font-weight: 700;
            text-transform: uppercase;
            margin-bottom: 4px;
          }

          .item {
            padding: 4px 0;
            border-bottom: 1px dotted #000;
          }

          .item:last-child {
            border-bottom: none;
          }

          .item-top {
            font-size: 10px;
          }

          .item-code {
            font-weight: 700;
          }

          .item-name {
            font-weight: 700;
            margin-top: 1px;
            word-break: break-word;
          }

          .item-meta {
            font-size: 10px;
            margin-top: 1px;
          }

          .totals {
            margin-top: 4px;
          }

          .totals .total-final {
            font-size: 14px;
            border-top: 1px solid #000;
            padding-top: 4px;
            margin-top: 4px;
          }

          .payment-block + .payment-block {
            margin-top: 4px;
          }

          .footer-note {
            margin-top: 8px;
            text-align: center;
            font-size: 10px;
          }
        </style>
      </head>
      <body>
        <main class="receipt">
          <section class="center">
            <div class="title">${escapeHtml(storeName)}</div>
            ${sale.stores?.cnpj ? `<div class="small">CNPJ ${escapeHtml(formatCNPJ(sale.stores.cnpj))}</div>` : ''}
            ${sale.stores?.ie ? `<div class="small">IE ${escapeHtml(sale.stores.ie)}</div>` : ''}
            ${storeAddress ? `<div class="small">${escapeHtml(storeAddress.toUpperCase())}</div>` : ''}
          </section>

          <div class="divider"></div>

          <section class="center">
            <div class="title">COMPROVANTE DE COMPRA</div>
            <div class="subtitle">DOCUMENTO NÃO FISCAL</div>
            <div class="small">PEDIDO ${escapeHtml(orderNumber)}</div>
            <div class="small">${escapeHtml(saleDate)}</div>
          </section>

          ${customerHtml}

          <div class="divider"></div>
          <div class="row small muted">
            <strong>COD / DESCRIÇÃO</strong>
            <strong>TOTAL</strong>
          </div>
          ${itemsHtml}

          <div class="divider"></div>
          <div class="totals">
            ${renderMoneyRow('ITENS', formatNumber(itemCount))}
            ${renderMoneyRow('SUBTOTAL', formatCurrency(Number(sale.subtotal || 0)))}
            ${Number(sale.discount || 0) > 0 ? renderMoneyRow('DESCONTO', `- ${formatCurrency(Number(sale.discount || 0))}`) : ''}
            ${Number((sale as any).delivery_fee || 0) > 0 ? renderMoneyRow('ENTREGA', formatCurrency(Number((sale as any).delivery_fee || 0))) : ''}
            ${renderMoneyRow('TOTAL', formatCurrency(Number(sale.total || 0)), 'total-final')}
          </div>

          ${paymentsHtml}

          <div class="divider"></div>
          <div class="footer-note">
            <div>VÁLIDO SOMENTE COMO COMPROVANTE DE COMPRA</div>
            <div>NÃO SUBSTITUI DOCUMENTO FISCAL</div>
            <div>IMPRESSO EM ${escapeHtml(printedAt)}</div>
            <div>OBRIGADO PELA PREFERÊNCIA!</div>
          </div>
        </main>
      </body>
    </html>
  `;
}