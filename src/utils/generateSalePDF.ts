import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SaleWithDetails } from '@/types/database';
import { fetchStoreLogoDataUrl } from '@/utils/storeLogo';
import { buildThermalReceiptHtml } from '@/utils/thermalReceipt';
import { isMirandaGroupStore, getStoreDisplayName } from '@/utils/mirandaBranding';

interface GeneratePDFOptions {
  sale: SaleWithDetails;
  type?: 'pedido' | 'orcamento' | 'crediario' | 'cupom' | 'entrega';
  installments?: { number: number; due_date: string; amount: number; status?: string; paid_at?: string | null }[];
  accessKey?: string;
  assembly?: { status: string; assemblers?: { name: string }; scheduled_date?: string; scheduled_time?: string; notes?: string } | null;
  sellerName?: string;
}

// ── Helpers ──────────────────────────────────────────────────
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}
function formatCNPJ(cnpj: string): string {
  const d = cnpj.replace(/\D/g, '');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return cnpj;
}
function formatDateForFilename(dateString: string): string {
  return new Date(dateString).toISOString().split('T')[0].replace(/-/g, '');
}
function getStatusLabel(status: string): string {
  return { draft: 'Rascunho', open: 'Aberta', paid: 'Paga', canceled: 'Cancelada' }[status] || status;
}
function getPaymentMethodLabel(method: string, cardType?: string): string {
  if (method === 'pix') return 'Pix';
  if (method === 'cash') return 'Dinheiro';
  if (method === 'card') return cardType === 'credit' ? 'Cartão de Crédito' : 'Cartão de Débito';
  if (method === 'crediario') return 'Crediário';
  if (method === 'financeira') return 'Financeira';
  return method;
}

function formatAddress(addr: any): string {
  if (!addr) return '';
  const parts = [
    addr.street || addr.logradouro,
    addr.number || addr.numero,
    addr.complement || addr.complemento,
    addr.district || addr.bairro || addr.neighborhood,
    [addr.city || addr.cidade || addr.localidade, addr.state || addr.uf].filter(Boolean).join('/'),
    addr.postalCode || addr.cep || addr.zipcode,
  ].filter(Boolean);
  return parts.join(', ');
}

function normalizeText(value?: string | null) {
  return value && String(value).trim() ? String(value).trim() : '—';
}

function getImageFormat(dataUrl: string) {
  return dataUrl.includes('image/jpeg') || dataUrl.includes('image/jpg') ? 'JPEG' : 'PNG';
}

function getAddressParts(addr: any) {
  if (!addr) return { street: '', complement: '', district: '', city: '', cep: '' };
  return {
    street: [addr.street || addr.logradouro, addr.number || addr.numero].filter(Boolean).join(', '),
    complement: addr.complement || addr.complemento || '',
    district: addr.district || addr.bairro || addr.neighborhood || '',
    city: [addr.city || addr.cidade || addr.localidade, addr.state || addr.uf].filter(Boolean).join(' - '),
    cep: addr.postalCode || addr.cep || addr.zipcode || '',
  };
}

// ── Draw horizontal line ─────────────────────────────────────
function hLine(doc: jsPDF, y: number, margin: number, pageWidth: number) {
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
}

// ── New professional header matching reference ───────────────
async function drawProfessionalHeader(doc: jsPDF, sale: SaleWithDetails, title: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;
  let y = 10;

  // ── "Typos! ERP" branding top-right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(196, 94, 26); // #C45E1A
  doc.text('Typos! ERP', pageWidth - margin, y + 3, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  // ── Title centered
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(title, pageWidth / 2, y + 4, { align: 'center' });
  y += 8;

  // ── Generated date top-right
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, pageWidth - margin, y, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  y += 2;

  hLine(doc, y, margin, pageWidth);
  y += 4;

  // ── Store info block (left: logo + name/address, right: CNPJ/IE/Fone)
  const logoDataUrl = sale.stores?.logo_path
    ? await fetchStoreLogoDataUrl(sale.stores.logo_path, sale.stores.logo_updated_at)
    : null;

  const logoSize = 18;
  let textX = margin;

  if (logoDataUrl) {
    try {
      (doc as any).addImage(logoDataUrl, getImageFormat(logoDataUrl), margin, y - 1, logoSize, logoSize);
      textX = margin + logoSize + 3;
    } catch {
      // ignore logo error
    }
  }

  const rawStoreName = sale.stores?.name || 'Loja';
  const isMirandaGroup = isMirandaGroupStore(rawStoreName);
  const storeName = getStoreDisplayName(rawStoreName);
  const storeAddr = getAddressParts(sale.stores?.address_json);

  // Helper para desenhar "Label: valor" com espaço garantido entre label e valor
  const drawLabelValue = (label: string, value: string, x: number, yy: number) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, x, yy);
    const w = doc.getTextWidth(label) + 1.5;
    doc.setFont('helvetica', 'normal');
    doc.text(value, x + w, yy);
  };

  // Store name — para o grupo Miranda, mostramos apenas "Miranda Móveis" sem rótulo "Razão Social"
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isMirandaGroup ? 11 : 9);
  if (isMirandaGroup) {
    doc.text(storeName, textX, y + 3);
  } else {
    drawLabelValue('Razão Social:', storeName, textX, y + 3);
  }

  // Address line
  doc.setFontSize(7.5);
  const storePhone = (sale.stores as any)?.phone || '';
  if (storeAddr.street) {
    drawLabelValue('Endereço:', storeAddr.street, textX, y + 7);
  }
  const cityLine = [storeAddr.district, storeAddr.city].filter(Boolean).join(' - ');
  if (cityLine) {
    drawLabelValue('Cidade:', cityLine, textX, y + 11);
  }
  // Para o grupo Miranda: telefone aparece logo abaixo do endereço (lado esquerdo)
  if (isMirandaGroup && storePhone) {
    drawLabelValue('Fone:', storePhone, textX, y + 15);
  }

  // Right side: CNPJ, IE, Fone (Fone só fora do grupo Miranda — no grupo, ele vai pra esquerda)
  const rightCol = pageWidth / 2 + 10;
  doc.setFontSize(7.5);
  if (sale.stores?.cnpj) {
    drawLabelValue('CNPJ:', formatCNPJ(sale.stores.cnpj), rightCol, y + 3);
  }
  if (sale.stores?.ie) {
    drawLabelValue('Insc. Estadual:', sale.stores.ie, rightCol, y + 7);
  }
  if (!isMirandaGroup && storePhone) {
    drawLabelValue('Fone:', storePhone, rightCol, y + 11);
  }
  if (storeAddr.district) {
    drawLabelValue('Bairro:', storeAddr.district, rightCol, y + 15);
  }

  y += Math.max(logoDataUrl ? logoSize + 2 : 14, 18);
  hLine(doc, y, margin, pageWidth);
  y += 1;

  return y;
}

// ── Draw labeled fields in a row ─────────────────────────────
function drawFieldRow(doc: jsPDF, fields: { label: string; value: string; x: number; maxW?: number }[], y: number) {
  doc.setFontSize(7);
  fields.forEach(f => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${f.label}`, f.x, y);
    doc.setFont('helvetica', 'normal');
    // Add 1.5mm gap after the label so label and value never visually collide
    const labelW = doc.getTextWidth(`${f.label}`) + 1.5;
    doc.text(f.value || '—', f.x + labelW, y, { maxWidth: f.maxW || 80 });
  });
}

// ── Seller + Order info section ──────────────────────────────
function drawOrderInfoSection(doc: jsPDF, sale: SaleWithDetails, y: number, sellerName?: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;
  const orderNumber = String((sale as any).order_number || sale.id.substring(0, 8).toUpperCase());

  y += 3;
  // Número and Data on same line
  drawFieldRow(doc, [
    { label: 'Número:', value: orderNumber, x: margin },
    { label: 'Data:', value: new Date(sale.created_at).toLocaleDateString('pt-BR'), x: pageWidth / 2 + 10 },
  ], y);
  y += 4;

  // Vendedor
  if (sellerName) {
    drawFieldRow(doc, [
      { label: 'Vendedor:', value: sellerName, x: margin },
      { label: 'Status:', value: getStatusLabel(sale.status), x: pageWidth / 2 + 10 },
    ], y);
    y += 4;
  }

  hLine(doc, y, margin, pageWidth);
  y += 1;
  return y;
}

// ── Customer info section ────────────────────────────────────
function drawCustomerSection(doc: jsPDF, sale: SaleWithDetails, y: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;
  const midCol = pageWidth / 2 + 10;

  if (!sale.customers) {
    y += 3;
    drawFieldRow(doc, [{ label: 'Cliente:', value: 'Consumidor Final', x: margin }], y);
    y += 4;
    hLine(doc, y, margin, pageWidth);
    y += 1;
    return y;
  }

  const cust = sale.customers as any;
  const custAddr = getAddressParts(cust.address_json);

  y += 3;
  // Row 1: code + name
  const custCode = cust.id ? cust.id.substring(0, 6).toUpperCase() : '';
  drawFieldRow(doc, [
    { label: 'Cliente:', value: `${custCode} - ${cust.name}`, x: margin, maxW: 120 },
  ], y);
  y += 4;

  // Row 2: phone
  const phones = [cust.phone, cust.email].filter(Boolean);
  if (phones.length > 0) {
    drawFieldRow(doc, [
      { label: 'Tel Com / Res.:', value: cust.phone || '—', x: margin },
      { label: 'E-mail:', value: cust.email || '—', x: midCol },
    ], y);
    y += 4;
  }

  // Row 3: address
  if (custAddr.street) {
    drawFieldRow(doc, [
      { label: 'Endereço:', value: custAddr.street, x: margin, maxW: 90 },
    ], y);
    if (custAddr.complement) {
      drawFieldRow(doc, [
        { label: 'Compl.:', value: custAddr.complement, x: midCol },
      ], y);
    }
    y += 4;
  }

  // Row 4: bairro/city/cep
  if (custAddr.district || custAddr.city) {
    drawFieldRow(doc, [
      { label: 'Bairro:', value: `${custAddr.district} - ${custAddr.city}`, x: margin, maxW: 90 },
      { label: 'Cep.:', value: custAddr.cep, x: midCol },
    ], y);
    y += 4;
  }

  // CPF/CNPJ
  if (cust.document) {
    drawFieldRow(doc, [
      { label: 'CPF/CNPJ:', value: cust.document, x: margin },
    ], y);
    y += 4;
  }

  hLine(doc, y, margin, pageWidth);
  y += 1;
  return y;
}

// ── Items table ──────────────────────────────────────────────
function drawItemsTable(doc: jsPDF, sale: SaleWithDetails, y: number, showPrices: boolean) {
  const margin = 12;
  const items = sale.sale_items || [];

  const head = showPrices
    ? [['Item', 'Código', 'Descrição', 'UM', 'Quantidade', 'Preço', 'Total']]
    : [['Item', 'Código', 'Descrição', 'UM', 'Quantidade']];

  const body = items.map((item: any, idx: number) => {
    const row = [
      String(idx + 1),
      item.products?.sku || item.products?.gtin || '-',
      item.products?.name || 'Produto',
      item.products?.unit || 'UN',
      String(item.qty),
    ];
    if (showPrices) {
      row.push(formatCurrency(item.unit_price));
      row.push(formatCurrency(item.total_line));
    }
    return row;
  });

  // Observations per item
  const bodyWithObs: string[][] = [];
  items.forEach((item: any, idx: number) => {
    bodyWithObs.push(body[idx]);
    // If item has notes/observations, add as sub-row
    if (item.notes) {
      const obsRow = showPrices
        ? ['', '', `Obs.: ${item.notes}`, '', '', '', '']
        : ['', '', `Obs.: ${item.notes}`, '', ''];
      bodyWithObs.push(obsRow);
    }
  });

  const colStyles: any = showPrices
    ? {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 22, halign: 'center' },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 14, halign: 'center' },
        4: { cellWidth: 22, halign: 'right' },
        5: { cellWidth: 24, halign: 'right' },
        6: { cellWidth: 24, halign: 'right' },
      }
    : {
        0: { cellWidth: 14, halign: 'center' },
        1: { cellWidth: 28, halign: 'center' },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 16, halign: 'center' },
        4: { cellWidth: 28, halign: 'right' },
      };

  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Dados dos Itens:', margin, y + 2);
  y += 4;

  autoTable(doc, {
    startY: y,
    head,
    body: bodyWithObs.length > 0 ? bodyWithObs : body,
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 7,
      cellPadding: 1.5,
      valign: 'middle',
      overflow: 'linebreak',
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
    },
    columnStyles: colStyles,
    theme: 'grid',
    didParseCell: (hookData) => {
      // Style obs rows differently
      if (hookData.section === 'body' && hookData.row.raw) {
        const raw = hookData.row.raw as string[];
        if (raw[0] === '' && raw[2]?.startsWith('Obs.:')) {
          hookData.cell.styles.fontStyle = 'italic';
          hookData.cell.styles.fontSize = 6.5;
          hookData.cell.styles.textColor = [100, 100, 100];
        }
      }
    },
  });

  return (doc as any).lastAutoTable.finalY;
}

// ── Observations section ─────────────────────────────────────
function drawObservations(doc: jsPDF, notes: string, y: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;

  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Observação:', margin, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const lines = doc.splitTextToSize(notes, pageWidth - 2 * margin);
  doc.text(lines, margin, y);
  y += lines.length * 3.5;
  return y;
}

// ── Financial summary ────────────────────────────────────────
function drawFinancialSummary(doc: jsPDF, sale: SaleWithDetails, y: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;

  y += 5;
  hLine(doc, y, margin, pageWidth);
  y += 4;

  const summaryX = pageWidth - margin - 70;
  doc.setFontSize(7.5);

  const rows: [string, string][] = [
    ['Subtotal:', formatCurrency(sale.subtotal)],
  ];
  if (sale.discount > 0) rows.push(['Desconto:', `-${formatCurrency(sale.discount)}`]);
  if ((sale as any).delivery_fee > 0) rows.push(['Taxa de Entrega:', `+${formatCurrency((sale as any).delivery_fee)}`]);
  if ((sale as any).assembly_fee > 0) rows.push(['Taxa de Montagem:', `+${formatCurrency((sale as any).assembly_fee)}`]);
  rows.push(['TOTAL:', formatCurrency(sale.total)]);

  rows.forEach(([label, value], idx) => {
    const isTotal = idx === rows.length - 1;
    doc.setFont('helvetica', isTotal ? 'bold' : 'normal');
    doc.setFontSize(isTotal ? 9 : 7.5);
    doc.text(label, summaryX, y);
    doc.text(value, pageWidth - margin, y, { align: 'right' });
    y += isTotal ? 5 : 3.5;
  });

  return y;
}

// ── Payments section ─────────────────────────────────────────
function drawPaymentsSection(doc: jsPDF, sale: SaleWithDetails, y: number) {
  const margin = 12;
  const payments = sale.payments || [];
  if (payments.length === 0) return y;

  y += 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Pagamentos:', margin, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [['Forma', 'Detalhes', 'Valor']],
    body: payments.map((p: any) => {
      const details = [
        p.brand ? `Bandeira: ${p.brand}` : null,
        p.installments > 1 ? `${p.installments}x de ${formatCurrency(p.paid_value / p.installments)}` : null,
      ].filter(Boolean).join(' • ');
      return [
        getPaymentMethodLabel(p.method, p.card_type),
        details || '—',
        formatCurrency(p.paid_value),
      ];
    }),
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 7,
      cellPadding: 1.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
    },
    columnStyles: {
      0: { cellWidth: 40, fontStyle: 'bold' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 30, halign: 'right' },
    },
    theme: 'grid',
  });

  return (doc as any).lastAutoTable.finalY;
}

// ── Declaration footer ───────────────────────────────────────
function drawDeclarationFooter(doc: jsPDF, y: number, customerName?: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;
  const pageHeight = doc.internal.pageSize.getHeight();

  // If not enough space, add page
  if (y > pageHeight - 60) {
    doc.addPage();
    y = 20;
  }

  y += 8;
  hLine(doc, y, margin, pageWidth);
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text(
    'IMPORTANTE: Declaro que estou recebendo os móveis e/ou estofados em perfeito estado.',
    margin,
    y,
    { maxWidth: pageWidth - 2 * margin }
  );
  y += 3.5;
  doc.setFont('helvetica', 'normal');
  doc.text(
    'Todo móvel deve ser conferido juntamente com os entregadores no ato do recebimento. Não aceitamos reclamações posteriores.',
    margin,
    y,
    { maxWidth: pageWidth - 2 * margin }
  );
  y += 10;

  // Signature line
  const sigW = 80;
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + sigW, y);
  y += 4;
  doc.setFontSize(7);
  doc.text(customerName || '', margin, y);

  // Date field on the right
  doc.text(`Data: ____/____/________ de ${new Date().getFullYear()}`, pageWidth - margin - 60, y);

  // System credit at bottom
  const footerY = pageHeight - 8;
  doc.setFontSize(6);
  doc.setTextColor(160, 160, 160);
  doc.text('Typos! ERP — Sistema de gestão', pageWidth / 2, footerY, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  return y;
}

// ── Delivery Receipt ─────────────────────────────────────────
async function buildDeliveryPDF({ sale, sellerName }: GeneratePDFOptions): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;

  let y = await drawProfessionalHeader(doc, sale, 'Comprovante de Entrega');
  y = drawOrderInfoSection(doc, sale, y, sellerName);
  y = drawCustomerSection(doc, sale, y);

  // Delivery info
  const delivery = sale.deliveries?.[0];
  if (delivery) {
    y += 3;
    drawFieldRow(doc, [
      { label: 'Tipo:', value: delivery.delivery_type === 'pickup' ? 'Retirada' : 'Entrega', x: margin },
      { label: 'Entregador:', value: delivery.drivers ? delivery.drivers.name : '—', x: pageWidth / 2 + 10 },
    ], y);
    y += 4;
    if (delivery.address_json) {
      const delAddr = formatAddress(delivery.address_json);
      drawFieldRow(doc, [
        { label: 'End. Entrega:', value: delAddr, x: margin, maxW: 140 },
      ], y);
      y += 4;
    }
    hLine(doc, y, margin, pageWidth);
    y += 1;
  }

  // Items (no prices for delivery receipt)
  y = drawItemsTable(doc, sale, y, false);

  // Observations
  if ((sale as any).notes) {
    y = drawObservations(doc, (sale as any).notes, y);
  }

  // Declaration and signature
  drawDeclarationFooter(doc, y, sale.customers?.name);

  return doc;
}

// ── Cupom térmico não fiscal ─────────────────────────────────
function buildCupomOnDoc(doc: jsPDF, sale: SaleWithDetails, accessKey: string | undefined, width: number, margin: number, sellerName?: string): jsPDF {
  let y = 5;
  const fs = 7; const fsSmall = 6; const fsBold = 8; const lineH = 3.5;
  const centerText = (t: string, yy: number, s = fs) => { doc.setFontSize(s); doc.text(t, width / 2, yy, { align: 'center' }); };
  const leftText = (t: string, yy: number, s = fs) => { doc.setFontSize(s); doc.text(t, margin, yy); };
  const rightText = (t: string, yy: number, s = fs) => { doc.setFontSize(s); doc.text(t, width - margin, yy, { align: 'right' }); };
  const dashes = (yy: number) => { doc.setFontSize(fsSmall); doc.text('-'.repeat(52), width / 2, yy, { align: 'center' }); };
  const orderNumber = String((sale as any).order_number || sale.id.substring(0, 8).toUpperCase());
  void accessKey;

  if (sale.stores) {
    doc.setFont('helvetica', 'bold');
    centerText(sale.stores.name, y, fsBold); y += lineH;
    doc.setFont('helvetica', 'normal');
    centerText(`CNPJ: ${formatCNPJ(sale.stores.cnpj)}`, y, fsSmall); y += lineH;
    if (sale.stores.address_json) {
      const addr = sale.stores.address_json as any;
      if (addr.street) { centerText(`${addr.street}${addr.number ? ', ' + addr.number : ''}`, y, fsSmall); y += lineH; }
      if (addr.city) { centerText(`${addr.city}${addr.state ? ' - ' + addr.state : ''}`, y, fsSmall); y += lineH; }
    }
  }

  y += 1; dashes(y); y += lineH;
  doc.setFont('helvetica', 'bold'); centerText('COMPROVANTE DE COMPRA', y, fsBold); y += lineH;
  doc.setFont('helvetica', 'normal'); centerText('DOCUMENTO NAO FISCAL', y, fsSmall); y += lineH;
  dashes(y); y += lineH;

  const saleDate = new Date(sale.created_at).toLocaleString('pt-BR');
  leftText(`Pedido: ${orderNumber}`, y, fsSmall); y += lineH;
  leftText(`Data: ${saleDate}`, y, fsSmall); y += lineH;
  if (sellerName) { leftText(`Vendedor(a): ${sellerName}`, y, fsSmall); y += lineH; }

  if (sale.customers) {
    dashes(y); y += lineH;
    doc.setFont('helvetica', 'bold'); leftText('CLIENTE', y, fsSmall); y += lineH;
    doc.setFont('helvetica', 'normal');
    leftText(sale.customers.name, y, fsSmall); y += lineH;
    if ((sale.customers as any).document) { leftText(`CPF/CNPJ: ${(sale.customers as any).document}`, y, fsSmall); y += lineH; }
    if ((sale.customers as any).phone) { leftText(`Telefone: ${(sale.customers as any).phone}`, y, fsSmall); y += lineH; }
  }

  dashes(y); y += lineH;
  doc.setFont('helvetica', 'bold'); leftText('ITEM', y, fsSmall); rightText('TOTAL', y, fsSmall); y += lineH;
  dashes(y); y += lineH; doc.setFont('helvetica', 'normal');

  (sale.sale_items || []).forEach((item: any, idx: number) => {
    const name = item.products?.name || 'Produto';
    const sku = item.products?.sku ? ` (${item.products.sku})` : '';
    const fullName = `${name}${sku}`;
    const truncName = fullName.length > 30 ? `${fullName.substring(0, 30)}..` : fullName;
    leftText(`${idx + 1}. ${truncName}`, y, fsSmall); y += lineH;
    leftText(`   ${item.qty} ${item.products?.unit || 'un'} x ${formatCurrency(item.unit_price)}`, y, fsSmall);
    rightText(formatCurrency(item.total_line), y, fsSmall); y += lineH;
  });

  dashes(y); y += lineH;
  leftText('Subtotal:', y, fsSmall); rightText(formatCurrency(sale.subtotal), y, fsSmall); y += lineH;
  if (sale.discount > 0) { leftText('Desconto:', y, fsSmall); rightText(`-${formatCurrency(sale.discount)}`, y, fsSmall); y += lineH; }
  if ((sale as any).delivery_fee > 0) { leftText('Taxa entrega:', y, fsSmall); rightText(`+${formatCurrency((sale as any).delivery_fee)}`, y, fsSmall); y += lineH; }
  if ((sale as any).assembly_fee > 0) { leftText('Taxa montagem:', y, fsSmall); rightText(`+${formatCurrency((sale as any).assembly_fee)}`, y, fsSmall); y += lineH; }
  doc.setFont('helvetica', 'bold'); leftText('TOTAL:', y, fsBold); rightText(formatCurrency(sale.total), y, fsBold); y += lineH;
  doc.setFont('helvetica', 'normal');

  const payments = sale.payments || [];
  if (payments.length > 0) {
    dashes(y); y += lineH;
    doc.setFont('helvetica', 'bold'); leftText('PAGAMENTOS', y, fsSmall); y += lineH;
    doc.setFont('helvetica', 'normal');
    payments.forEach((p: any) => {
      const method = getPaymentMethodLabel(p.method, p.card_type);
      const extra = p.installments > 1 ? ` ${p.installments}x` : '';
      const brand = p.brand ? ` (${p.brand})` : '';
      leftText(`${method}${brand}${extra}`, y, fsSmall);
      rightText(formatCurrency(p.paid_value), y, fsSmall); y += lineH;
    });
  }

  dashes(y); y += lineH;
  centerText('VALIDO COMO COMPROVANTE DE COMPRA', y, 5); y += lineH;
  centerText(`Emitido em ${new Date().toLocaleString('pt-BR')}`, y, 5); y += lineH;
  centerText('Obrigado pela preferencia!', y, fsSmall);
  return doc;
}

function buildCupomPDF(opts: GeneratePDFOptions): jsPDF {
  const width = 80;
  const tempDoc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [width, 600] });
  buildCupomOnDoc(tempDoc, opts.sale, opts.accessKey, width, 3, opts.sellerName);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [width, 297] });
  return buildCupomOnDoc(doc, opts.sale, opts.accessKey, width, 3, opts.sellerName);
}

// ── A4 PDF (Pedido / Orçamento / Crediário) ──────────────────
async function buildPDF(opts: GeneratePDFOptions): Promise<jsPDF> {
  const { sale, type = 'pedido', installments, sellerName, assembly } = opts;
  if (type === 'cupom') return buildCupomPDF(opts);
  if (type === 'entrega') return await buildDeliveryPDF(opts);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;

  const titles: Record<string, string> = {
    pedido: 'Ordem de Pedido',
    orcamento: 'Orçamento',
    crediario: 'Comprovante de Crediário',
  };

  let y = await drawProfessionalHeader(doc, sale, titles[type] || 'Ordem de Pedido');
  y = drawOrderInfoSection(doc, sale, y, sellerName);
  y = drawCustomerSection(doc, sale, y);

  // Delivery scheduled date (admin-managed)
  const delivery = (sale as any).deliveries?.[0];
  if (delivery && (delivery.scheduled_date || delivery.delivery_type)) {
    y += 3;
    const delTypeLabel = delivery.delivery_type === 'pickup' ? 'Retirada' : 'Entrega';
    const delStatusMap: Record<string, string> = {
      pending: 'Pendente', scheduled: 'Agendada', in_route: 'Em rota',
      delivered: 'Entregue', canceled: 'Cancelada',
    };
    drawFieldRow(doc, [
      { label: 'Tipo:', value: delTypeLabel, x: margin },
      { label: 'Status entrega:', value: delStatusMap[delivery.status] || delivery.status || '—', x: pageWidth / 2 + 10 },
    ], y);
    y += 4;
    if (delivery.scheduled_date) {
      const dateStr = new Date(delivery.scheduled_date + 'T12:00:00').toLocaleDateString('pt-BR');
      drawFieldRow(doc, [
        { label: 'Data entrega:', value: `${dateStr}${delivery.scheduled_time ? ` às ${delivery.scheduled_time}` : ''}`, x: margin },
      ], y);
      y += 4;
    }
    hLine(doc, y, margin, pageWidth);
    y += 1;
  }

  // Assembly info
  if (assembly) {
    const asmStatus = { pending: 'Pendente', scheduled: 'Agendada', in_progress: 'Em Andamento', completed: 'Concluída', canceled: 'Cancelada' }[assembly.status] || assembly.status;
    y += 3;
    drawFieldRow(doc, [
      { label: 'Montagem:', value: asmStatus, x: margin },
      { label: 'Montador:', value: normalizeText(assembly.assemblers?.name), x: pageWidth / 2 + 10 },
    ], y);
    y += 4;
    if (assembly.scheduled_date) {
      const dateStr = new Date(assembly.scheduled_date + 'T12:00:00').toLocaleDateString('pt-BR');
      drawFieldRow(doc, [
        { label: 'Data montagem:', value: `${dateStr}${assembly.scheduled_time ? ` às ${assembly.scheduled_time}` : ''}`, x: margin },
      ], y);
      y += 4;
    }
    if (assembly.notes) {
      drawFieldRow(doc, [
        { label: 'Obs. montagem:', value: assembly.notes, x: margin, maxW: 140 },
      ], y);
      y += 4;
    }
    hLine(doc, y, margin, pageWidth);
    y += 1;
  }

  // Items table with prices
  y = drawItemsTable(doc, sale, y, true);

  // Observations
  if ((sale as any).notes) {
    y = drawObservations(doc, (sale as any).notes, y);
  }

  // Financial summary
  y = drawFinancialSummary(doc, sale, y);

  // Payments (entrada + outras formas à vista)
  y = drawPaymentsSection(doc, sale, y);

  // Crediário installments — exibido sempre que houver parcelas registradas
  // (independente de existir registro em payments — vendas em status 'crediario'
  // não têm linha em payments até a primeira parcela ser recebida).
  const hasCrediarioPayment = (sale.payments || []).some((p: any) => p.method === 'crediario');
  const isCrediarioSale = (sale as any).status === 'crediario';
  const showInstallments = installments && installments.length > 0
    && (type === 'crediario' || hasCrediarioPayment || isCrediarioSale);
  if (showInstallments) {
    y += 6;
    if (y > 235) { doc.addPage(); y = 20; }

    const totalParcelas = installments!.reduce((s, i) => s + Number(i.amount || 0), 0);
    const entrada = Number(sale.total || 0) - totalParcelas;
    const qtd = installments!.length;
    const valorParcela = qtd > 0 ? totalParcelas / qtd : 0;
    const todasIguais = installments!.every(i => Math.abs(Number(i.amount) - valorParcela) < 0.01);
    const ordenadas = [...installments!].sort((a, b) => a.due_date.localeCompare(b.due_date));
    const primeiro = new Date(ordenadas[0].due_date + 'T12:00:00').toLocaleDateString('pt-BR');
    const ultimo = new Date(ordenadas[ordenadas.length - 1].due_date + 'T12:00:00').toLocaleDateString('pt-BR');
    const totalPago = installments!.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.amount || 0), 0);
    const totalAberto = totalParcelas - totalPago;
    const hojeRef = new Date(); hojeRef.setHours(0, 0, 0, 0);

    // Section title with subtle accent bar
    doc.setFillColor(196, 94, 26); // brand orange
    doc.rect(margin, y - 3, 1.2, 4.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text('Parcelamento — Crediário', margin + 3, y);
    y += 4;

    // Resumo box
    const boxX = margin;
    const boxW = pageWidth - 2 * margin;
    const lineH = 4;
    const linhas: [string, string][] = [];
    if (entrada > 0.009) linhas.push(['Entrada paga', formatCurrency(entrada)]);
    linhas.push(['Parcelamento', todasIguais ? `${qtd}x de ${formatCurrency(valorParcela)}` : `${qtd} parcelas`]);
    linhas.push(['Total parcelado', formatCurrency(totalParcelas)]);
    if (totalPago > 0.009) {
      linhas.push(['Já pago', formatCurrency(totalPago)]);
      linhas.push(['Em aberto', formatCurrency(totalAberto)]);
    }
    linhas.push(['1º vencimento', primeiro]);
    linhas.push(['Último vencimento', ultimo]);

    const boxH = linhas.length * lineH + 3;
    doc.setDrawColor(220, 220, 220);
    doc.setFillColor(248, 248, 248);
    doc.roundedRect(boxX, y, boxW, boxH, 1, 1, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0);
    let ly = y + 4;
    linhas.forEach(([k, v]) => {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(90, 90, 90);
      doc.text(k, boxX + 3, ly);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(v, boxX + boxW - 3, ly, { align: 'right' });
      ly += lineH;
    });
    y += boxH + 3;

    // Tabela detalhada
    const hasStatus = installments!.some(i => i.status);
    const head = hasStatus
      ? [['Parcela', 'Vencimento', 'Valor', 'Status']]
      : [['Parcela', 'Vencimento', 'Valor']];

    const body = installments!.map(i => {
      const due = new Date(i.due_date + 'T12:00:00');
      let statusLabel = 'Em aberto';
      if (i.status === 'paid') statusLabel = 'Paga';
      else if (i.status === 'canceled') statusLabel = 'Cancelada';
      else if (due < hojeRef) statusLabel = 'Vencida';
      const row = [
        `${i.number}/${qtd}`,
        due.toLocaleDateString('pt-BR'),
        formatCurrency(i.amount),
      ];
      if (hasStatus) row.push(statusLabel);
      return row;
    });

    autoTable(doc, {
      startY: y,
      head,
      body,
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 7,
        cellPadding: 1.8,
        lineColor: [200, 200, 200],
        lineWidth: 0.15,
      },
      headStyles: {
        fillColor: [245, 240, 235],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        lineColor: [200, 200, 200],
        lineWidth: 0.2,
      },
      alternateRowStyles: { fillColor: [252, 252, 252] },
      columnStyles: hasStatus
        ? {
            0: { cellWidth: 22, halign: 'center' },
            1: { cellWidth: 32, halign: 'center' },
            2: { cellWidth: 32, halign: 'right' },
            3: { cellWidth: 'auto', halign: 'center', fontStyle: 'bold' },
          }
        : {
            0: { cellWidth: 30, halign: 'center' },
            1: { cellWidth: 'auto', halign: 'center' },
            2: { cellWidth: 40, halign: 'right' },
          },
      didParseCell: (hookData) => {
        if (hasStatus && hookData.section === 'body' && hookData.column.index === 3) {
          const v = String(hookData.cell.raw || '');
          if (v === 'Paga') hookData.cell.styles.textColor = [22, 128, 60];
          else if (v === 'Vencida') hookData.cell.styles.textColor = [185, 28, 28];
          else if (v === 'Cancelada') hookData.cell.styles.textColor = [120, 120, 120];
          else hookData.cell.styles.textColor = [120, 90, 30];
        }
      },
      theme: 'grid',
    });
    y = (doc as any).lastAutoTable.finalY;
  }
  // Simple footer (no declaration for pedido/orçamento)
  const pageHeight = doc.internal.pageSize.getHeight();
  const footerY = pageHeight - 8;
  doc.setFontSize(6);
  doc.setTextColor(160, 160, 160);
  doc.text('Typos! ERP — Sistema de gestão', pageWidth / 2, footerY, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  return doc;
}

// ── Public API ───────────────────────────────────────────────
export async function generateSalePDF(options: GeneratePDFOptions): Promise<void> {
  const doc = await buildPDF(options);
  const filename = `${options.type || 'pedido'}_${options.sale.id.substring(0, 8)}_${formatDateForFilename(options.sale.created_at)}.pdf`;
  doc.save(filename);
}

export async function printSalePDF(options: GeneratePDFOptions): Promise<void> {
  if (options.type === 'cupom') {
    await printHtmlDirectly(buildThermalReceiptHtml(options.sale));
    return;
  }

  const doc = await buildPDF(options);
  const dataUri = doc.output('datauristring');
  printViaNewWindow(dataUri);
}

function createHiddenPrintFrame() {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '1px';
  iframe.style.height = '1px';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  iframe.style.border = '0';
  return iframe;
}

function destroyHiddenPrintFrame(iframe: HTMLIFrameElement) {
  window.setTimeout(() => {
    iframe.parentNode?.removeChild(iframe);
  }, 0);
}

export async function printHtmlDirectly(html: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const iframe = createHiddenPrintFrame();
    let cleanedUp = false;

    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      destroyHiddenPrintFrame(iframe);
    };

    iframe.onload = () => {
      window.setTimeout(() => {
        try {
          const frameWindow = iframe.contentWindow;
          if (!frameWindow) {
            throw new Error('Não foi possível abrir o comprovante para impressão.');
          }

          frameWindow.onafterprint = cleanup;
          frameWindow.focus();
          frameWindow.print();
          resolve();
          window.setTimeout(cleanup, 60000);
        } catch (error) {
          cleanup();
          reject(error instanceof Error ? error : new Error('Não foi possível iniciar a impressão.'));
        }
      }, 250);
    };

    iframe.onerror = () => {
      cleanup();
      reject(new Error('Não foi possível carregar o comprovante para impressão.'));
    };

    document.body.appendChild(iframe);
    iframe.srcdoc = html;
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Não foi possível processar o documento para impressão.'));
    reader.readAsDataURL(blob);
  });
}

function printViaNewWindow(dataUri: string): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    const a = document.createElement('a');
    a.href = dataUri;
    a.download = 'documento.pdf';
    a.click();
    return;
  }
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head><title>Impressão</title></head>
    <body style="margin:0;padding:0;">
      <embed src="${dataUri}" type="application/pdf" width="100%" height="100%" style="position:fixed;top:0;left:0;width:100%;height:100%;border:none;">
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.addEventListener('load', () => {
    setTimeout(() => {
      printWindow.print();
    }, 600);
  });
}

function isHtmlContent(blob: Blob, mimeType?: string): boolean {
  const mt = (mimeType || blob.type || '').toLowerCase();
  return mt.includes('text/html') || mt.includes('html');
}

export async function printBlobDirectly(blob: Blob, filename?: string, mimeType = blob.type): Promise<void> {
  // Detect HTML content (NFC-e from Focus NFe returns HTML DANFE)
  if (isHtmlContent(blob, mimeType)) {
    const html = await blob.text();
    await printHtmlDirectly(html);
    return;
  }

  // Additional safety: check first bytes for HTML even if mime says PDF
  // (some providers return HTML with wrong content-type)
  try {
    const firstBytes = await blob.slice(0, 100).text();
    const trimmed = firstBytes.trimStart().toLowerCase();
    if (trimmed.startsWith('<!doctype') || trimmed.startsWith('<html') || trimmed.startsWith('<head')) {
      const html = await blob.text();
      await printHtmlDirectly(html);
      return;
    }
  } catch {}

  const dataUri = await blobToDataUrl(blob);
  printViaNewWindow(dataUri);
}

export async function openBlobForViewing(blob: Blob, contentType: string, docId: string): Promise<void> {
  let isHtml = isHtmlContent(blob, contentType);
  
  // Sniff first bytes to detect HTML even when MIME type is wrong
  if (!isHtml) {
    try {
      const firstBytes = await blob.slice(0, 200).text();
      const trimmed = firstBytes.trimStart().toLowerCase();
      if (trimmed.startsWith('<!doctype') || trimmed.startsWith('<html') || trimmed.startsWith('<head')) {
        isHtml = true;
      }
    } catch {}
  }

  if (isHtml) {
    // Render HTML DANFE in a new window
    const htmlUrl = URL.createObjectURL(new Blob([blob], { type: 'text/html' }));
    const win = window.open(htmlUrl, '_blank');
    if (!win) {
      // Fallback: inline iframe
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:99999;border:none;background:#fff;';
      iframe.src = htmlUrl;
      const closeBtn = document.createElement('button');
      closeBtn.textContent = '✕ Fechar';
      closeBtn.style.cssText = 'position:fixed;top:10px;right:10px;z-index:100000;padding:8px 16px;background:#333;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;';
      closeBtn.onclick = () => { document.body.removeChild(iframe); document.body.removeChild(closeBtn); URL.revokeObjectURL(htmlUrl); };
      document.body.appendChild(iframe);
      document.body.appendChild(closeBtn);
    }
  } else {
    // PDF - open in new tab
    const pdfUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
    window.open(pdfUrl, '_blank');
  }
}
