import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { fetchStoreLogoDataUrl } from '@/utils/storeLogo';
import { getStoreDisplayName } from '@/utils/mirandaBranding';
import { applyTyposBranding, drawDisarahHeaderLogo } from '@/utils/typosBranding';

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}
function hLine(doc: jsPDF, y: number, m: number, pw: number) {
  doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3); doc.line(m, y, pw - m, y);
}

export async function generateQuotePDF(quote: any, items: any[]) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pw = doc.internal.pageSize.getWidth();
  const m = 12;
  let y = 10;

  // Branding
  await drawDisarahHeaderLogo(doc, pw - m, y + 3, 7);
  doc.setFontSize(13); doc.text('ORÇAMENTO', pw / 2, y + 4, { align: 'center' });
  y += 8;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(100); doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, pw - m, y, { align: 'right' });
  doc.setTextColor(0); y += 2; hLine(doc, y, m, pw); y += 4;

  // Store info
  const store = quote.stores;
  if (store) {
    const logoDataUrl = store.logo_path ? await fetchStoreLogoDataUrl(store.logo_path, store.logo_updated_at) : null;
    let textX = m;
    if (logoDataUrl) {
      try { (doc as any).addImage(logoDataUrl, logoDataUrl.includes('jpeg') ? 'JPEG' : 'PNG', m, y - 1, 18, 18); textX = m + 21; } catch {}
    }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text(getStoreDisplayName(store.name), textX, y + 3);
    let infoY = y + 7;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    if (store.cnpj) { doc.text(`CNPJ: ${store.cnpj}`, textX, infoY); infoY += 3.5; }
    if (store.ie) { doc.text(`IE: ${store.ie}`, textX, infoY); infoY += 3.5; }
    const addr = store.address_json as any;
    if (addr) {
      const parts: string[] = [];
      if (addr.street) { let line = addr.street; if (addr.number) line += `, ${addr.number}`; if (addr.complement) line += ` - ${addr.complement}`; parts.push(line); }
      if (addr.neighborhood || addr.district) parts.push(addr.neighborhood || addr.district);
      if (addr.city && addr.state) parts.push(`${addr.city}/${addr.state}`);
      else if (addr.city) parts.push(addr.city);
      if (addr.zip || addr.postalCode) parts.push(`CEP: ${addr.zip || addr.postalCode}`);
      if (parts.length > 0) { doc.text(parts.join(' · '), textX, infoY); infoY += 3.5; }
    }
    if (store.phone) { doc.text(`Telefone: ${store.phone}`, textX, infoY); infoY += 3.5; }
    y = Math.max(infoY, logoDataUrl ? y + 20 : infoY) + 1;
    hLine(doc, y, m, pw); y += 4;
  }

  // Quote info
  doc.setFontSize(8);
  const field = (label: string, val: string, x: number, yy: number) => {
    doc.setFont('helvetica', 'bold'); doc.text(label, x, yy);
    doc.setFont('helvetica', 'normal'); doc.text(val, x + doc.getTextWidth(label + ' '), yy);
  };
  field('Nº Orçamento:', String(quote.quote_number), m, y);
  field('Data:', format(new Date(quote.created_at), 'dd/MM/yyyy'), pw / 2, y); y += 5;
  if (quote.valid_until) { field('Válido até:', format(new Date(quote.valid_until + 'T12:00:00'), 'dd/MM/yyyy'), m, y); y += 5; }

  // Customer
  const cust = quote.customers;
  if (cust) {
    field('Cliente:', cust.name, m, y); y += 4;
    if (cust.phone) { field('Telefone:', cust.phone, m, y); y += 4; }
    if (cust.document) { field('CPF/CNPJ:', cust.document, m, y); y += 4; }
  } else {
    field('Cliente:', 'Consumidor Final', m, y); y += 4;
  }
  y += 1; hLine(doc, y, m, pw); y += 5;

  // Items
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text('Itens:', m, y); y += 3;

  autoTable(doc, {
    startY: y,
    head: [['#', 'Produto', 'Qtd', 'Preço Unit.', 'Total']],
    body: items.map((it: any, i: number) => [
      String(i + 1), it.products?.name || '-',
      String(it.qty), formatCurrency(it.unit_price), formatCurrency(it.total_line),
    ]),
    margin: { left: m, right: m },
    styles: { fontSize: 7, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.2 },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineColor: [0, 0, 0], lineWidth: 0.3 },
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
    theme: 'grid',
  });

  y = (doc as any).lastAutoTable.finalY + 5;

  // Totals
  const rows: [string, string][] = [['Subtotal:', formatCurrency(quote.subtotal)]];
  if (quote.discount > 0) rows.push(['Desconto:', `-${formatCurrency(quote.discount)}`]);
  if (quote.delivery_fee > 0) rows.push(['Entrega:', `+${formatCurrency(quote.delivery_fee)}`]);
  if (quote.assembly_fee > 0) rows.push(['Montagem:', `+${formatCurrency(quote.assembly_fee)}`]);
  rows.push(['TOTAL:', formatCurrency(quote.total)]);

  rows.forEach(([label, value], idx) => {
    const isTotal = idx === rows.length - 1;
    doc.setFont('helvetica', isTotal ? 'bold' : 'normal'); doc.setFontSize(isTotal ? 9 : 7.5);
    doc.text(label, pw - m - 70, y); doc.text(value, pw - m, y, { align: 'right' }); y += isTotal ? 5 : 3.5;
  });

  if (quote.notes) {
    y += 5; doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text('Observações:', m, y); y += 4;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    doc.text(doc.splitTextToSize(quote.notes, pw - 2 * m), m, y);
  }

  doc.save(`orcamento_${quote.quote_number}.pdf`);
}
