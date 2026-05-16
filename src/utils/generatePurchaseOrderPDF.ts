import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { getStoreDisplayName } from '@/utils/mirandaBranding';
import { applyTyposBranding, drawDisarahHeaderLogo } from '@/utils/typosBranding';

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function hLine(doc: jsPDF, y: number, m: number, pw: number) {
  doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3); doc.line(m, y, pw - m, y);
}

export async function generatePurchaseOrderPDF(order: any, items: any[]) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pw = doc.internal.pageSize.getWidth();
  const m = 12;
  let y = 10;

  await drawDisarahHeaderLogo(doc, pw - m, y + 3, 7);

  doc.setFontSize(13); doc.text('PEDIDO DE COMPRA', pw / 2, y + 4, { align: 'center' });
  y += 8;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(100); doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, pw - m, y, { align: 'right' });
  doc.setTextColor(0); y += 2; hLine(doc, y, m, pw); y += 5;

  doc.setFontSize(8);
  const field = (label: string, val: string, x: number, yy: number) => {
    doc.setFont('helvetica', 'bold'); doc.text(label, x, yy);
    doc.setFont('helvetica', 'normal'); doc.text(val, x + doc.getTextWidth(label + ' '), yy);
  };

  field('Nº Pedido:', String(order.order_number), m, y);
  field('Status:', order.status, pw / 2, y); y += 5;
  field('Fornecedor:', order.suppliers?.name || '-', m, y);
  field('Loja:', getStoreDisplayName(order.stores?.name), pw / 2, y); y += 5;
  field('Data:', format(new Date(order.created_at), 'dd/MM/yyyy'), m, y);
  if (order.expected_delivery_date) field('Prev. Entrega:', format(new Date(order.expected_delivery_date), 'dd/MM/yyyy'), pw / 2, y);
  y += 5;

  // Endereço da loja + telefone (logo abaixo)
  const addr: any = order.stores?.address_json;
  if (addr) {
    const parts: string[] = [];
    if (addr.street) { let line = addr.street; if (addr.number) line += `, ${addr.number}`; if (addr.complement) line += ` - ${addr.complement}`; parts.push(line); }
    if (addr.neighborhood || addr.district) parts.push(addr.neighborhood || addr.district);
    if (addr.city && addr.state) parts.push(`${addr.city}/${addr.state}`);
    else if (addr.city) parts.push(addr.city);
    if (addr.zip || addr.postalCode) parts.push(`CEP: ${addr.zip || addr.postalCode}`);
    if (parts.length > 0) { field('Endereço:', parts.join(' · '), m, y); y += 5; }
  }
  if (order.stores?.phone) { field('Telefone:', order.stores.phone, m, y); y += 5; }

  hLine(doc, y, m, pw); y += 5;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text('Itens:', m, y); y += 3;

  autoTable(doc, {
    startY: y,
    head: [['#', 'Produto', 'SKU', 'Qtd', 'Custo Unit.', 'Total']],
    body: items.map((it: any, i: number) => [
      String(i + 1), it.products?.name || '-', it.products?.sku || '-',
      String(it.qty_ordered), formatCurrency(it.unit_cost), formatCurrency(it.total_line),
    ]),
    margin: { left: m, right: m },
    styles: { fontSize: 7, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.2 },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineColor: [0, 0, 0], lineWidth: 0.3 },
    columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
    theme: 'grid',
  });

  y = (doc as any).lastAutoTable.finalY + 5;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text(`Total: ${formatCurrency(order.total)}`, pw - m, y, { align: 'right' });

  if (order.notes) {
    y += 8; doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text('Observações:', m, y); y += 4;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    doc.text(doc.splitTextToSize(order.notes, pw - 2 * m), m, y);
  }

  doc.save(`pedido_compra_${order.order_number}.pdf`);
}
