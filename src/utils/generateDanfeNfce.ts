import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import type { SaleWithDetails } from '@/types/database';

interface DanfeNfceOptions {
  sale: SaleWithDetails;
  accessKey?: string;
  protocol?: string;
  qrCodeUrl?: string;
  width?: 58 | 80;
}

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatCNPJ = (cnpj: string): string => {
  const d = cnpj.replace(/\D/g, '');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return cnpj;
};

const getPaymentMethodLabel = (method: string, cardType?: string): string => {
  if (method === 'pix') return 'Pix';
  if (method === 'cash') return 'Dinheiro';
  if (method === 'card') return cardType === 'credit' ? 'Cartão Crédito' : 'Cartão Débito';
  if (method === 'crediario') return 'Crediário';
  return method;
};

async function buildDanfeNfce(options: DanfeNfceOptions): Promise<jsPDF> {
  const { sale, accessKey, protocol, qrCodeUrl, width = 80 } = options;
  const margin = width === 58 ? 2 : 3;
  const contentW = width - margin * 2;
  const fs = width === 58 ? 6 : 7;
  const fsSmall = width === 58 ? 5 : 6;
  const fsBold = width === 58 ? 7 : 8;
  const lineH = width === 58 ? 3 : 3.5;
  const dashCount = width === 58 ? 40 : 52;

  // First pass: measure height
  let y = measureContent(sale, accessKey, protocol, qrCodeUrl, width, margin, lineH, fsSmall, fsBold, dashCount);

  // Create doc with exact height
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [width, y + 5] });

  // Second pass: render
  y = 5;

  const centerText = (text: string, yy: number, size = fs) => {
    doc.setFontSize(size);
    doc.text(text, width / 2, yy, { align: 'center' });
  };
  const leftText = (text: string, yy: number, size = fs) => {
    doc.setFontSize(size);
    doc.text(text, margin, yy);
  };
  const rightText = (text: string, yy: number, size = fs) => {
    doc.setFontSize(size);
    doc.text(text, width - margin, yy, { align: 'right' });
  };
  const dashes = (yy: number) => {
    doc.setFontSize(fsSmall);
    doc.text('-'.repeat(dashCount), width / 2, yy, { align: 'center' });
  };

  // === HEADER: Store info ===
  if (sale.stores) {
    doc.setFont('helvetica', 'bold');
    centerText(sale.stores.name, y, fsBold); y += lineH;
    doc.setFont('helvetica', 'normal');
    centerText(`CNPJ: ${formatCNPJ(sale.stores.cnpj)}`, y, fsSmall); y += lineH;
    if (sale.stores.address_json) {
      const addr = sale.stores.address_json as any;
      if (addr.logradouro || addr.street) {
        const street = addr.logradouro || addr.street;
        const num = addr.numero || addr.number;
        centerText(`${street}${num ? ', ' + num : ''}`, y, fsSmall); y += lineH;
        const city = addr.cidade || addr.city;
        const state = addr.uf || addr.state;
        if (city) { centerText(`${city}${state ? ' - ' + state : ''}`, y, fsSmall); y += lineH; }
      }
    }
  }
  y += 1;
  dashes(y); y += lineH;

  // === Title ===
  doc.setFont('helvetica', 'bold');
  centerText('DANFE NFC-e', y, fsBold); y += lineH;
  doc.setFont('helvetica', 'normal');
  centerText('Documento Auxiliar da Nota Fiscal', y, fsSmall); y += lineH;
  centerText('de Consumidor Eletrônica', y, fsSmall); y += lineH;
  dashes(y); y += lineH;

  // === Items ===
  doc.setFont('helvetica', 'bold');
  leftText('ITEM', y, fsSmall);
  rightText('TOTAL', y, fsSmall); y += lineH;
  dashes(y); y += lineH;
  doc.setFont('helvetica', 'normal');

  const items = sale.sale_items || [];
  const maxNameLen = width === 58 ? 22 : 30;
  items.forEach((item: any, idx: number) => {
    const name = item.products?.name || 'Produto';
    const truncName = name.length > maxNameLen ? name.substring(0, maxNameLen) + '..' : name;
    leftText(`${idx + 1}. ${truncName}`, y, fsSmall); y += lineH;
    leftText(`   ${item.qty} ${item.products?.unit || 'un'} x ${formatCurrency(item.unit_price)}`, y, fsSmall);
    rightText(formatCurrency(item.total_line), y, fsSmall);
    y += lineH;
  });

  // === Totals ===
  dashes(y); y += lineH;
  leftText('Subtotal:', y, fsSmall); rightText(formatCurrency(sale.subtotal), y, fsSmall); y += lineH;
  if (sale.discount > 0) {
    leftText('Desconto:', y, fsSmall); rightText(`-${formatCurrency(sale.discount)}`, y, fsSmall); y += lineH;
  }
  if (sale.delivery_fee > 0) {
    leftText('Frete:', y, fsSmall); rightText(`+${formatCurrency(sale.delivery_fee)}`, y, fsSmall); y += lineH;
  }
  doc.setFont('helvetica', 'bold');
  leftText('TOTAL:', y, fsBold); rightText(formatCurrency(sale.total), y, fsBold); y += lineH;
  doc.setFont('helvetica', 'normal');

  // === Payments ===
  const payments = sale.payments || [];
  if (payments.length > 0) {
    dashes(y); y += lineH;
    doc.setFont('helvetica', 'bold');
    leftText('PAGAMENTO', y, fsSmall); y += lineH;
    doc.setFont('helvetica', 'normal');
    payments.forEach((p: any) => {
      const method = getPaymentMethodLabel(p.method, p.card_type);
      const extra = p.installments > 1 ? ` ${p.installments}x` : '';
      leftText(`${method}${extra}`, y, fsSmall);
      rightText(formatCurrency(p.paid_value), y, fsSmall);
      y += lineH;
    });
  }

  // === Customer ===
  if (sale.customers) {
    dashes(y); y += lineH;
    doc.setFont('helvetica', 'bold');
    leftText('CONSUMIDOR', y, fsSmall); y += lineH;
    doc.setFont('helvetica', 'normal');
    leftText(sale.customers.name, y, fsSmall); y += lineH;
    if (sale.customers.document) { leftText(`CPF/CNPJ: ${sale.customers.document}`, y, fsSmall); y += lineH; }
  }

  // === QR Code ===
  if (qrCodeUrl || accessKey) {
    dashes(y); y += lineH;
    const qrUrl = qrCodeUrl || `https://www.nfce.fazenda.sp.gov.br/consulta?chave=${accessKey}`;
    try {
      const qrDataUrl = await QRCode.toDataURL(qrUrl, { width: 200, margin: 1 });
      const qrSize = width === 58 ? 30 : 40;
      const qrX = (width - qrSize) / 2;
      doc.addImage(qrDataUrl, 'PNG', qrX, y, qrSize, qrSize);
      y += qrSize + 2;
    } catch (err) {
      console.error('QR Code generation error:', err);
      centerText('QR Code indisponível', y, fsSmall); y += lineH;
    }
  }

  // === Access Key ===
  if (accessKey) {
    doc.setFont('helvetica', 'bold');
    centerText('CHAVE DE ACESSO', y, fsSmall); y += lineH;
    doc.setFont('helvetica', 'normal');
    const formatted = accessKey.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim();
    // Split into two lines if needed
    if (formatted.length > (width === 58 ? 30 : 40)) {
      const mid = Math.ceil(formatted.length / 2);
      const spaceIdx = formatted.indexOf(' ', mid - 5);
      const breakAt = spaceIdx > 0 ? spaceIdx : mid;
      centerText(formatted.substring(0, breakAt).trim(), y, fsSmall); y += lineH;
      centerText(formatted.substring(breakAt).trim(), y, fsSmall); y += lineH;
    } else {
      centerText(formatted, y, fsSmall); y += lineH;
    }
  }

  // === Protocol ===
  if (protocol) {
    doc.setFont('helvetica', 'bold');
    centerText('PROTOCOLO DE AUTORIZAÇÃO', y, fsSmall); y += lineH;
    doc.setFont('helvetica', 'normal');
    centerText(protocol, y, fsSmall); y += lineH;
  }

  // === Footer ===
  dashes(y); y += lineH;
  const saleDate = new Date(sale.created_at).toLocaleString('pt-BR');
  centerText(`Emissão: ${saleDate}`, y, 5); y += lineH;
  centerText('Obrigado pela preferência!', y, fsSmall);

  return doc;
}

function measureContent(
  sale: SaleWithDetails, accessKey?: string, protocol?: string,
  qrCodeUrl?: string, width = 80, margin = 3, lineH = 3.5,
  fsSmall = 6, fsBold = 8, dashCount = 52
): number {
  let y = 5;

  // Store header
  if (sale.stores) {
    y += lineH; // name
    y += lineH; // cnpj
    if (sale.stores.address_json) {
      const addr = sale.stores.address_json as any;
      if (addr.logradouro || addr.street) { y += lineH; if (addr.cidade || addr.city) y += lineH; }
    }
  }
  y += 1; y += lineH; // dash

  // Title
  y += lineH * 3; y += lineH; // dash

  // Items header
  y += lineH; y += lineH; // dash
  const items = sale.sale_items || [];
  items.forEach(() => { y += lineH * 2; });

  // Totals
  y += lineH; y += lineH; // dash + subtotal
  if (sale.discount > 0) y += lineH;
  if (sale.delivery_fee > 0) y += lineH;
  y += lineH; // TOTAL

  // Payments
  const payments = sale.payments || [];
  if (payments.length > 0) {
    y += lineH; y += lineH; // dash + header
    payments.forEach(() => { y += lineH; });
  }

  // Customer
  if (sale.customers) {
    y += lineH * 2; // dash + header
    y += lineH; // name
    if (sale.customers.document) y += lineH;
  }

  // QR Code
  if (qrCodeUrl || accessKey) {
    y += lineH; // dash
    y += (width === 58 ? 30 : 40) + 2; // qr size
  }

  // Access key
  if (accessKey) {
    y += lineH; // header
    y += lineH * 2; // key (2 lines)
  }

  // Protocol
  if (protocol) {
    y += lineH * 2;
  }

  // Footer
  y += lineH; y += lineH * 2;

  return y;
}

/**
 * Generate DANFE NFC-e thermal PDF and trigger download
 */
export async function generateDanfeNfce(options: DanfeNfceOptions): Promise<void> {
  const doc = await buildDanfeNfce(options);
  const filename = `danfe_nfce_${options.sale.id.substring(0, 8)}.pdf`;
  doc.save(filename);
}

/**
 * Generate DANFE NFC-e and print using hidden iframe (no popup blockers)
 */
export async function printDanfeNfce(options: DanfeNfceOptions): Promise<void> {
  const doc = await buildDanfeNfce(options);
  const blob = doc.output('blob');
  const blobUrl = URL.createObjectURL(blob);

  // Use hidden iframe to avoid popup blockers
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '-10000px';
  iframe.style.left = '-10000px';
  iframe.style.width = '1px';
  iframe.style.height = '1px';
  iframe.src = blobUrl;

  iframe.onload = () => {
    try {
      iframe.contentWindow?.print();
    } catch {
      // Fallback: open in new tab
      window.open(blobUrl, '_blank');
    }
    // Cleanup after a delay
    setTimeout(() => {
      document.body.removeChild(iframe);
      URL.revokeObjectURL(blobUrl);
    }, 60000);
  };

  document.body.appendChild(iframe);
}
