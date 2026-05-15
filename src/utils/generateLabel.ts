import jsPDF from 'jspdf';

interface LabelData {
  productName: string;
  sku?: string;
  gtin?: string;
  price: number;
  expirationDate?: string;
  unit?: string;
  presentationName?: string;
  quantity?: number;
}

// Generate a simple Code128-like barcode as SVG path data
function generateBarcodeLines(code: string): { x: number; w: number }[] {
  // Simple encoding: each char generates a pattern of bars
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  const narrow = 0.8;
  const wide = 2;

  // Start pattern
  bars.push({ x, w: wide }); x += wide + narrow;
  bars.push({ x, w: narrow }); x += narrow * 2;
  bars.push({ x, w: narrow }); x += narrow * 2;

  for (let i = 0; i < code.length; i++) {
    const charCode = code.charCodeAt(i);
    // Create a unique pattern for each character
    const pattern = [
      (charCode & 1) ? wide : narrow,
      narrow,
      (charCode & 2) ? wide : narrow,
      narrow,
      (charCode & 4) ? wide : narrow,
      narrow,
    ];
    for (let j = 0; j < pattern.length; j++) {
      if (j % 2 === 0) {
        bars.push({ x, w: pattern[j] });
      }
      x += pattern[j];
    }
    x += narrow; // gap between chars
  }

  // Stop pattern
  bars.push({ x, w: wide }); x += wide + narrow;
  bars.push({ x, w: narrow }); x += narrow * 2;
  bars.push({ x, w: wide });

  return bars;
}

function drawBarcode(doc: jsPDF, code: string, x: number, y: number, maxWidth: number, height: number) {
  if (!code) return;
  const bars = generateBarcodeLines(code);
  const totalWidth = bars.length > 0 ? bars[bars.length - 1].x + bars[bars.length - 1].w : 1;
  const scale = maxWidth / totalWidth;

  doc.setFillColor(0, 0, 0);
  for (const bar of bars) {
    doc.rect(x + bar.x * scale, y, bar.w * scale, height, 'F');
  }
  // Text below barcode
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.text(code, x + maxWidth / 2, y + height + 2.5, { align: 'center' });
}

const fc = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export function generateLabelPDF(items: LabelData[], copies: number = 1): Blob {
  // Label size: 60mm x 30mm (common thermal label)
  const labelW = 60;
  const labelH = 30;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [labelH, labelW] });

  let firstPage = true;

  for (const item of items) {
    for (let c = 0; c < copies; c++) {
      if (!firstPage) doc.addPage([labelH, labelW], 'landscape');
      firstPage = false;

      const margin = 2;

      // Product name (top, bold, may wrap)
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      const nameLines = doc.splitTextToSize(
        item.presentationName ? `${item.productName} (${item.presentationName})` : item.productName,
        labelW - margin * 2
      );
      doc.text(nameLines.slice(0, 2), margin, margin + 3);
      const nameEndY = margin + 3 + (Math.min(nameLines.length, 2) - 1) * 3;

      // Barcode
      const barcodeCode = item.gtin || item.sku || '';
      if (barcodeCode) {
        drawBarcode(doc, barcodeCode, margin, nameEndY + 2, labelW - margin * 2, 8);
      }

      const bottomY = labelH - margin;

      // Price (bottom right, large)
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(fc(item.price), labelW - margin, bottomY, { align: 'right' });

      // Expiration date (bottom left)
      if (item.expirationDate) {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text(`Val: ${item.expirationDate}`, margin, bottomY);
      }

      // Unit
      if (item.unit) {
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        doc.text(item.unit, margin, bottomY - 3.5);
      }
    }
  }

  return doc.output('blob');
}

export function printLabel(items: LabelData[], copies: number = 1) {
  const blob = generateLabelPDF(items, copies);
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = url;
  document.body.appendChild(iframe);
  iframe.onload = () => {
    try {
      iframe.contentWindow?.print();
    } catch {
      window.open(url, '_blank');
    }
    setTimeout(() => {
      document.body.removeChild(iframe);
      URL.revokeObjectURL(url);
    }, 5000);
  };
}
