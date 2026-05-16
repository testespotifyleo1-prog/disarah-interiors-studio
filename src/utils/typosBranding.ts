import type jsPDF from 'jspdf';
import disarahLogoUrl from '@/assets/disarah/logo.png';

let disarahCache: string | null = null;
let typosLogoCache: { dataUrl: string; w: number; h: number } | null = null;

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

/**
 * Gera a logo "Typos! ERP" via canvas em alta resolução (sharp),
 * fiel ao design da tela de login: gradiente laranja + selo ERP.
 */
export function getTyposLogoImage(): { dataUrl: string; w: number; h: number } | null {
  if (typosLogoCache) return typosLogoCache;
  if (typeof document === 'undefined') return null;

  // Dimensões base (px) — proporção do logo (~ "Typos!" + selo ERP)
  const baseW = 520;
  const baseH = 130;
  const scale = 4; // alta densidade para nitidez no PDF
  const canvas = document.createElement('canvas');
  canvas.width = baseW * scale;
  canvas.height = baseH * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(scale, scale);

  // Fundo transparente (default). Texto "Typos!"
  const fontStack = `900 96px Outfit, 'Outfit', Inter, Arial, sans-serif`;
  ctx.font = fontStack;
  ctx.textBaseline = 'alphabetic';

  // Gradiente laranja
  const grad = ctx.createLinearGradient(0, 0, baseW, 0);
  grad.addColorStop(0, '#C45E1A');
  grad.addColorStop(0.5, '#D4722E');
  grad.addColorStop(1, '#C45E1A');
  ctx.fillStyle = grad;

  const text = 'Typos!';
  const textY = 92;
  ctx.fillText(text, 0, textY);
  const textW = ctx.measureText(text).width;

  // Selo "ERP"
  const badgeX = textW + 14;
  const badgeH = 36;
  const badgeY = textY - 56;
  ctx.font = `800 22px Outfit, 'Outfit', Inter, Arial, sans-serif`;
  const badgeLabel = 'ERP';
  const badgeTextW = ctx.measureText(badgeLabel).width;
  const badgeW = badgeTextW + 22;

  // Fundo do selo (laranja 12% + borda)
  ctx.fillStyle = 'rgba(196, 94, 26, 0.12)';
  const r = 7;
  // roundRect fallback
  ctx.beginPath();
  ctx.moveTo(badgeX + r, badgeY);
  ctx.lineTo(badgeX + badgeW - r, badgeY);
  ctx.quadraticCurveTo(badgeX + badgeW, badgeY, badgeX + badgeW, badgeY + r);
  ctx.lineTo(badgeX + badgeW, badgeY + badgeH - r);
  ctx.quadraticCurveTo(badgeX + badgeW, badgeY + badgeH, badgeX + badgeW - r, badgeY + badgeH);
  ctx.lineTo(badgeX + r, badgeY + badgeH);
  ctx.quadraticCurveTo(badgeX, badgeY + badgeH, badgeX, badgeY + badgeH - r);
  ctx.lineTo(badgeX, badgeY + r);
  ctx.quadraticCurveTo(badgeX, badgeY, badgeX + r, badgeY);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(196, 94, 26, 0.35)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Texto ERP
  ctx.fillStyle = '#C45E1A';
  ctx.textBaseline = 'middle';
  ctx.fillText(badgeLabel, badgeX + (badgeW - badgeTextW) / 2, badgeY + badgeH / 2 + 1);

  const dataUrl = canvas.toDataURL('image/png');
  // Largura útil do logo (texto + selo)
  const usedW = badgeX + badgeW + 4;
  typosLogoCache = { dataUrl, w: usedW, h: baseH };
  return typosLogoCache;
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
  const typos = getTyposLogoImage();

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

    // Logo Typos ERP à esquerda (mesma logo do login)
    if (typos) {
      try {
        const h = 5.5;
        const w = h * (typos.w / typos.h);
        (doc as any).addImage(typos.dataUrl, 'PNG', margin, footerY - h + 1, w, h, undefined, 'FAST');
      } catch {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(196, 94, 26);
        doc.text('Typos! ERP', margin, footerY);
      }
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(196, 94, 26);
      doc.text('Typos! ERP', margin, footerY);
    }

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
 * Desenha a logo Typos! ERP (a mesma da tela de login) no topo direito do cabeçalho.
 * Renderizada via canvas em alta densidade → nítida em qualquer zoom do PDF.
 */
export async function drawTyposHeaderLogo(
  doc: jsPDF,
  xRight: number,
  y: number,
  height = 9
): Promise<number> {
  const typos = getTyposLogoImage();
  if (!typos) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(196, 94, 26);
    doc.text('Typos! ERP', xRight, y + 3, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    return 35;
  }
  const w = height * (typos.w / typos.h);
  try {
    (doc as any).addImage(typos.dataUrl, 'PNG', xRight - w, y - 2, w, height, undefined, 'FAST');
  } catch {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(196, 94, 26);
    doc.text('Typos! ERP', xRight, y + 3, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }
  return w;
}

// Alias para retrocompatibilidade com callers existentes
export const drawDisarahHeaderLogo = drawTyposHeaderLogo;

