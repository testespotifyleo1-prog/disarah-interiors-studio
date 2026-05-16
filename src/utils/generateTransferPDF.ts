import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { applyTyposBranding, drawDisarahHeaderLogo } from '@/utils/typosBranding';

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function hLine(doc: jsPDF, y: number, m: number, pw: number) {
  doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3); doc.line(m, y, pw - m, y);
}

export async function generateTransferPDF(transfer: any, items: any[], stores: any[]) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pw = doc.internal.pageSize.getWidth();
  const m = 12;
  let y = 10;

  // Logo Disarah no topo direito
  await drawDisarahHeaderLogo(doc, pw - m, y + 3, 7);

  // Title
  doc.setFontSize(13); doc.text('TRANSFERÊNCIA ENTRE LOJAS', pw / 2, y + 4, { align: 'center' });
  y += 8;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(100, 100, 100);
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, pw - m, y, { align: 'right' });
  doc.setTextColor(0, 0, 0); y += 2;
  hLine(doc, y, m, pw); y += 5;

  // Info
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold'); doc.text(`Nº Transferência:`, m, y);
  doc.setFont('helvetica', 'normal'); doc.text(`${transfer.transfer_number}`, m + 35, y);
  doc.setFont('helvetica', 'bold'); doc.text(`Status:`, pw / 2, y);
  doc.setFont('helvetica', 'normal'); doc.text(transfer.status, pw / 2 + 15, y);
  y += 5;

  doc.setFont('helvetica', 'bold'); doc.text(`Origem:`, m, y);
  doc.setFont('helvetica', 'normal'); doc.text(transfer.from_store?.name || '-', m + 18, y);
  doc.setFont('helvetica', 'bold'); doc.text(`Destino:`, pw / 2, y);
  doc.setFont('helvetica', 'normal'); doc.text(transfer.to_store?.name || '-', pw / 2 + 18, y);
  y += 5;

  doc.setFont('helvetica', 'bold'); doc.text(`Data:`, m, y);
  doc.setFont('helvetica', 'normal'); doc.text(format(new Date(transfer.created_at), 'dd/MM/yyyy HH:mm'), m + 12, y);
  y += 3;
  hLine(doc, y, m, pw); y += 5;

  // Items table
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text('Itens:', m, y); y += 3;

  autoTable(doc, {
    startY: y,
    head: [['#', 'Produto', 'SKU', 'Unidade', 'Qtd Solicitada', 'Qtd Recebida']],
    body: items.map((it: any, i: number) => [
      String(i + 1),
      it.products?.name || '-',
      it.products?.sku || '-',
      it.products?.unit || 'UN',
      String(it.qty_requested),
      it.qty_received > 0 ? String(it.qty_received) : '-',
    ]),
    margin: { left: m, right: m },
    styles: { fontSize: 7, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.2 },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineColor: [0, 0, 0], lineWidth: 0.3 },
    theme: 'grid',
  });

  y = (doc as any).lastAutoTable.finalY + 5;

  if (transfer.notes) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text('Observações:', m, y); y += 4;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    const lines = doc.splitTextToSize(transfer.notes, pw - 2 * m);
    doc.text(lines, m, y);
  }

  // Signatures
  const ph = doc.internal.pageSize.getHeight();
  const sigY = ph - 30;
  hLine(doc, sigY, m + 20, pw / 2 - 10);
  hLine(doc, sigY, pw / 2 + 10, pw - m - 20);
  doc.setFontSize(7); doc.setFont('helvetica', 'normal');
  doc.text('Responsável Envio', m + 30, sigY + 4);
  doc.text('Responsável Recebimento', pw / 2 + 15, sigY + 4);

  await applyTyposBranding(doc);
  doc.save(`transferencia_${transfer.transfer_number}.pdf`);
}
