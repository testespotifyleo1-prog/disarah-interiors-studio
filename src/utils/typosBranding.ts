import type jsPDF from 'jspdf';
import disarahLogoUrl from '@/assets/disarah/logo.png';

const typosLogoUrl = '/typos-logo-email.png';

let disarahCache: string | null = null;
let typosCache: string | null = null;

async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('logo load failed'));
    r.readAsDataURL(blob);
  });
}

export async function getDisarahLogoDataUrl(): Promise<string | null> {
  if (disarahCache) return disarahCache;
  try {
    disarahCache = await urlToDataUrl(disarahLogoUrl);
    return disarahCache;
  } catch {
    return null;
  }
}

export async function getTyposLogoDataUrl(): Promise<string | null> {
  if (typosCache) return typosCache;
  try {
    typosCache = await urlToDataUrl(typosLogoUrl);
    return typosCache;
  } catch {
    return null;
  }
}

/**
 * Aplica branding "powered by Typos ERP" no PDF inteiro:
 *  - Marca d'água com a logo Disarah ao centro de cada página (bem suave).
 *  - Rodapé com a logo Typos ERP + site www.typoserp.com.br em cada página.
 *
 * Deve ser chamado APÓS todo o conteúdo do PDF ter sido desenhado.
 */
export async function applyTyposBranding(doc: jsPDF): Promise<void> {
  const disarah = await getDisarahLogoDataUrl();
  const typos = await getTyposLogoDataUrl();

  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // ── Marca d'água (Disarah) ─────────────────────────────
    if (disarah) {
      try {
        const wmW = 120;
        const wmH = 120;
        const wmX = (pageWidth - wmW) / 2;
        const wmY = (pageHeight - wmH) / 2;
        const GStateCtor = (doc as any).GState;
        const prevG = GStateCtor ? new GStateCtor({ opacity: 0.06 }) : null;
        if (prevG) (doc as any).setGState(prevG);
        (doc as any).addImage(disarah, 'PNG', wmX, wmY, wmW, wmH, undefined, 'FAST');
        if (GStateCtor) (doc as any).setGState(new GStateCtor({ opacity: 1 }));
      } catch {
        // ignore
      }
    }

    // ── Rodapé Typos ERP ───────────────────────────────────
    const footerY = pageHeight - 10;
    const margin = 12;

    // Linha separadora
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);

    // Logo Typos ERP à esquerda
    if (typos) {
      try {
        (doc as any).addImage(typos, 'PNG', margin, footerY - 3.5, 14, 4.5, undefined, 'FAST');
      } catch {
        // fallback texto
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(196, 94, 26);
        doc.text('Typos ERP', margin, footerY);
      }
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(196, 94, 26);
      doc.text('Typos ERP', margin, footerY);
    }

    // Texto central
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(120, 120, 120);
    doc.text('Sistema de gestão Typos ERP', pageWidth / 2, footerY, { align: 'center' });

    // Site à direita
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(196, 94, 26);
    doc.text('www.typoserp.com.br', pageWidth - margin, footerY, { align: 'right' });

    // Paginação discreta abaixo
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(160, 160, 160);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, footerY + 3, { align: 'center' });

    doc.setTextColor(0, 0, 0);
  }
}

/**
 * Desenha pequena logo Disarah no topo direito do cabeçalho (substitui o texto).
 * Retorna a largura ocupada (mm) para o caller posicionar o restante.
 */
export async function drawDisarahHeaderLogo(
  doc: jsPDF,
  xRight: number,
  y: number,
  height = 7
): Promise<number> {
  const disarah = await getDisarahLogoDataUrl();
  if (!disarah) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(196, 94, 26);
    doc.text('Disarah Interiores', xRight, y + 3, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    return 30;
  }
  const w = height * 3.2;
  try {
    (doc as any).addImage(disarah, 'PNG', xRight - w, y - 2, w, height, undefined, 'FAST');
  } catch {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(196, 94, 26);
    doc.text('Disarah Interiores', xRight, y + 3, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }
  return w;
}
