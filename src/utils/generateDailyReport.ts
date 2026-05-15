import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';
import { fetchStoreLogoDataUrl } from '@/utils/storeLogo';

const fc = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

interface DailyReportData {
  storeName: string;
  storeId: string;
  accountId: string;
  register: any;
  summary: {
    totalSales: number;
    totalRevenue: number;
    totalCash: number;
    totalCard: number;
    totalPix: number;
    totalCrediario: number;
    totalFinanceira: number;
    avgTicket: number;
    totalSangria: number;
    totalReforco: number;
  };
  expectedCash: number;
  closingAmount?: number;
}

export async function generateDailyReportPDF(data: DailyReportData) {
  const { storeName, storeId, accountId, register, summary, expectedCash, closingAmount } = data;
  const openedAt = register.opened_at;
  const closedAt = register.closed_at || new Date().toISOString();

  // Fetch detailed sales for the period (inclui manual_entry para somar pagamentos)
  const { data: salesAll } = await supabase
    .from('sales')
    .select('id, sale_number, total, status, source, customer_id, seller_id, created_at, discount, delivery_fee, subtotal, notes')
    .eq('store_id', storeId)
    .eq('status', 'paid')
    .gte('created_at', openedAt)
    .order('created_at', { ascending: true });

  // Separa entradas manuais das vendas reais
  const manualEntries = (salesAll || []).filter(s => s.source === 'manual_entry');
  const sales = (salesAll || []).filter(s => s.source !== 'manual_entry');

  const saleIds = (salesAll || []).map(s => s.id);

  // Fetch payments, customers, sellers, movements in parallel
  const allPayments: any[] = [];
  if (saleIds.length > 0) {
    for (let i = 0; i < saleIds.length; i += 50) {
      const chunk = saleIds.slice(i, i + 50);
      const { data: payments } = await supabase
        .from('payments')
        .select('sale_id, method, paid_value, card_type, brand, card_fee_percent, card_fee_value, installments')
        .in('sale_id', chunk);
      if (payments) allPayments.push(...payments);
    }
  }

  // Cash movements
  const { data: movements } = await supabase
    .from('cash_movements')
    .select('type, amount, reason, created_at, created_by')
    .eq('cash_register_id', register.id)
    .order('created_at', { ascending: true });

  // Store credits created (devoluções com crédito)
  const { data: storeCredits } = await supabase
    .from('store_credits')
    .select('original_amount, reason, created_at, sale_id, customer_id, customer_name_manual')
    .eq('store_id', storeId)
    .gte('created_at', openedAt)
    .lte('created_at', closedAt)
    .order('created_at', { ascending: true });

  const totalStoreCredits = (storeCredits || []).reduce((a, c) => a + (Number(c.original_amount) || 0), 0);

  // Store credits used as payment during the period
  const { data: usedCredits } = await supabase
    .from('store_credits')
    .select('original_amount, remaining_amount, used_at, customer_id, customer_name_manual, used_in_sale_id, reason')
    .eq('store_id', storeId)
    .not('used_at', 'is', null)
    .gte('used_at', openedAt)
    .lte('used_at', closedAt)
    .order('used_at', { ascending: true });

  const totalCreditsUsedAsPayment = allPayments.filter(p => p.method === 'store_credit').reduce((a, p) => a + (Number(p.paid_value) || 0), 0);

  // Return notes (devoluções fiscais)
  const { data: returnNotes } = await supabase
    .from('return_notes')
    .select('id, total_refund, reason, created_at, sale_id, customer_id')
    .eq('store_id', storeId)
    .gte('created_at', openedAt)
    .lte('created_at', closedAt)
    .order('created_at', { ascending: true });

  const totalReturns = (returnNotes || []).reduce((a, r) => a + (Number(r.total_refund) || 0), 0);

  // Customer names (from sales + devolutions)
  const devCustIds = [
    ...(storeCredits || []).map((c: any) => c.customer_id),
    ...(returnNotes || []).map((r: any) => r.customer_id),
    ...(usedCredits || []).map((c: any) => c.customer_id),
  ].filter(Boolean);
  const customerIds = Array.from(new Set([...(sales || []).map(s => s.customer_id).filter(Boolean), ...devCustIds]));
  let customerMap: Record<string, string> = {};
  if (customerIds.length > 0) {
    const { data: customers } = await supabase
      .from('customers')
      .select('id, name')
      .in('id', customerIds);
    for (const c of customers || []) customerMap[c.id] = c.name;
  }

  // Seller names
  const sellerIds = Array.from(new Set((sales || []).map(s => s.seller_id).filter(Boolean)));
  let sellerMap: Record<string, string> = {};
  if (sellerIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', sellerIds);
    for (const p of profiles || []) sellerMap[p.user_id] = p.full_name || 'Vendedor';
  }

  // Card detail breakdown
  let cardDebit = 0, cardCredit = 0, totalCardFees = 0;
  const cardPayments = allPayments.filter(p => p.method === 'card');
  for (const p of cardPayments) {
    const v = Number(p.paid_value) || 0;
    if (p.card_type === 'debit') cardDebit += v;
    else cardCredit += v;
    totalCardFees += Number(p.card_fee_value) || 0;
  }

  // Online vs PDV
  const onlineSales = (sales || []).filter(s => s.source === 'ecommerce');
  const pdvSales = (sales || []).filter(s => s.source !== 'ecommerce');
  const onlineTotal = onlineSales.reduce((a, s) => a + Number(s.total), 0);
  const pdvTotal = pdvSales.reduce((a, s) => a + Number(s.total), 0);

  // Total discounts
  const totalDiscounts = (sales || []).reduce((a, s) => a + (Number(s.discount) || 0), 0);
  const totalDeliveryFees = (sales || []).reduce((a, s) => a + (Number(s.delivery_fee) || 0), 0);

  // Logo
  let logoDataUrl: string | null = null;
  try { logoDataUrl = await fetchStoreLogoDataUrl(storeId); } catch {}

  // ─── Build PDF ───
  const doc = new jsPDF('p', 'mm', 'a4');
  const pw = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 14;

  // Header with logo
  if (logoDataUrl) {
    try { doc.addImage(logoDataUrl, 'PNG', margin, y, 22, 22); } catch {}
  }
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Relatório Diário de Caixa', logoDataUrl ? margin + 26 : margin, y + 8);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(storeName, logoDataUrl ? margin + 26 : margin, y + 14);
  const dateStr = new Date(openedAt).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  doc.text(dateStr.charAt(0).toUpperCase() + dateStr.slice(1), logoDataUrl ? margin + 26 : margin, y + 19);
  y += 28;

  // Period
  doc.setDrawColor(200);
  doc.line(margin, y, pw - margin, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Período do Caixa', margin, y);
  doc.setFont('helvetica', 'normal');
  const opened = new Date(openedAt).toLocaleString('pt-BR');
  const closed = register.closed_at ? new Date(register.closed_at).toLocaleString('pt-BR') : 'Aberto';
  doc.text(`Abertura: ${opened}    |    Fechamento: ${closed}`, margin + 40, y);
  y += 4;
  doc.text(`Troco Inicial: ${fc(Number(register.opening_amount) || 0)}`, margin + 40, y);
  y += 8;

  // ─── RESUMO GERAL ───
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumo Geral', margin, y);
  y += 2;

  const summaryRows: string[][] = [
    ['Total de Vendas', `${summary.totalSales} vendas`],
    ['Faturamento Bruto', fc(summary.totalRevenue)],
    ['Ticket Médio', fc(summary.avgTicket)],
    ['Total Descontos', fc(totalDiscounts)],
    ['Taxa de Entrega', fc(totalDeliveryFees)],
    ['Vendas PDV', `${pdvSales.length} — ${fc(pdvTotal)}`],
    ['Vendas Online', `${onlineSales.length} — ${fc(onlineTotal)}`],
  ];
  if (totalStoreCredits > 0 || totalReturns > 0) {
    summaryRows.push(['Devoluções (Créditos)', `${(storeCredits || []).length} — ${fc(totalStoreCredits)}`]);
    if (totalReturns > 0) summaryRows.push(['Devoluções Fiscais', `${(returnNotes || []).length} — ${fc(totalReturns)}`]);
  }

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: { fillColor: [50, 50, 50], fontSize: 8 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 }, 1: { halign: 'right' } },
    head: [['Indicador', 'Valor']],
    body: summaryRows,
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ─── PAGAMENTOS ───
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumo por Forma de Pagamento', margin, y);
  y += 2;

  const paymentRows = [
    ['Dinheiro', fc(summary.totalCash)],
    ['Cartão de Débito', fc(cardDebit)],
    ['Cartão de Crédito', fc(cardCredit)],
    ['Cartão (Total)', fc(summary.totalCard)],
    ['Pix', fc(summary.totalPix)],
    ['Crediário', fc(summary.totalCrediario)],
    ['Financeira', fc(summary.totalFinanceira)],
    ['Crédito de Loja', fc(totalCreditsUsedAsPayment)],
  ];
  if (totalCardFees > 0) {
    paymentRows.push(['Taxas de Cartão (descontadas)', `- ${fc(totalCardFees)}`]);
    paymentRows.push(['Líquido Cartão', fc(summary.totalCard - totalCardFees)]);
  }

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: { fillColor: [50, 50, 50], fontSize: 8 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 }, 1: { halign: 'right' } },
    head: [['Forma de Pagamento', 'Valor']],
    body: paymentRows,
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ─── MOVIMENTAÇÕES DE CAIXA ───
  if ((movements || []).length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Movimentações de Caixa (Sangria / Reforço)', margin, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: 'grid',
      headStyles: { fillColor: [50, 50, 50], fontSize: 8 },
      bodyStyles: { fontSize: 9 },
      head: [['Tipo', 'Valor', 'Motivo', 'Horário']],
      body: (movements || []).map((m: any) => [
        m.type === 'sangria' ? 'Sangria (Retirada)' : 'Reforço (Aporte)',
        m.type === 'sangria' ? `- ${fc(Number(m.amount))}` : `+ ${fc(Number(m.amount))}`,
        m.reason || '—',
        new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      ]),
    });
    y = (doc as any).lastAutoTable.finalY + 4;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: 'plain',
      bodyStyles: { fontSize: 9, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 60 }, 1: { halign: 'right' } },
      body: [
        ['Total Reforços', `+ ${fc(summary.totalReforco)}`],
        ['Total Sangrias', `- ${fc(summary.totalSangria)}`],
      ],
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ─── DEVOLUÇÕES ───
  const allDevolutions = [
    ...(storeCredits || []).map((c: any) => ({
      type: 'Crédito Gerado',
      value: Number(c.original_amount) || 0,
      reason: c.reason || '—',
      time: new Date(c.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      customer: c.customer_id ? (customerMap[c.customer_id] || c.customer_name_manual || '—') : (c.customer_name_manual || '—'),
    })),
    ...(returnNotes || []).map((r: any) => ({
      type: 'Devolução Fiscal',
      value: Number(r.total_refund) || 0,
      reason: r.reason || '—',
      time: new Date(r.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      customer: r.customer_id ? (customerMap[r.customer_id] || '—') : '—',
    })),
  ];

  // Credits used as payment section
  const creditsUsedRows = (usedCredits || []).map((c: any) => ({
    customer: c.customer_id ? (customerMap[c.customer_id] || c.customer_name_manual || '—') : (c.customer_name_manual || '—'),
    value: Number(c.original_amount) - Number(c.remaining_amount || 0),
    reason: c.reason || '—',
    time: new Date(c.used_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  }));

  if (allDevolutions.length > 0) {
    if (y > 240) { doc.addPage(); y = 14; }
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Devoluções e Créditos do Período', margin, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: 'grid',
      headStyles: { fillColor: [50, 50, 50], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      head: [['Tipo', 'Valor', 'Motivo', 'Cliente', 'Horário']],
      body: allDevolutions.map(d => [d.type, fc(d.value), d.reason, d.customer, d.time]),
    });
    y = (doc as any).lastAutoTable.finalY + 4;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: 'plain',
      bodyStyles: { fontSize: 9, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 60 }, 1: { halign: 'right' } },
      body: [
        ['Total Devoluções', fc(totalStoreCredits + totalReturns)],
      ],
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ─── CRÉDITOS UTILIZADOS COMO PAGAMENTO ───
  if (creditsUsedRows.length > 0) {
    if (y > 240) { doc.addPage(); y = 14; }
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Créditos Utilizados como Pagamento', margin, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: 'grid',
      headStyles: { fillColor: [50, 50, 50], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      head: [['Cliente', 'Valor Usado', 'Motivo Original', 'Horário']],
      body: creditsUsedRows.map(c => [c.customer, fc(c.value), c.reason, c.time]),
    });
    y = (doc as any).lastAutoTable.finalY + 4;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: 'plain',
      bodyStyles: { fontSize: 9, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 60 }, 1: { halign: 'right' } },
      body: [
        ['Total Créditos Utilizados', fc(totalCreditsUsedAsPayment)],
      ],
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ─── RECEBIMENTOS MANUAIS (Venda antiga, Parcela antiga, etc.) ───
  if (manualEntries.length > 0) {
    if (y > 230) { doc.addPage(); y = 14; }
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Recebimentos Manuais (Entradas Avulsas)', margin, y);
    y += 2;

    const manualRows = manualEntries.map(s => {
      const sp = allPayments.filter(p => p.sale_id === s.id);
      const method = sp[0]?.method || '—';
      const methodLabel = ({ cash: 'Dinheiro', card: 'Cartão', pix: 'PIX', crediario: 'Crediário', financeira: 'Financeira', store_credit: 'Crédito Loja' } as any)[method] || method;
      const m = ((s as any).notes || '').match(/Entrada manual \(([^)]+)\) - Cliente: ([^-]+?)(?:\s*-\s*(.+))?$/);
      const tipo = m?.[1] || 'Outros';
      const cliente = (m?.[2] || '—').trim();
      const obs = (m?.[3] || '').trim();
      return [
        new Date(s.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        tipo, cliente, obs || '—', methodLabel, fc(Number(s.total)),
      ];
    });

    autoTable(doc, {
      startY: y, margin: { left: margin, right: margin }, theme: 'grid',
      headStyles: { fillColor: [30, 80, 130], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 5: { halign: 'right', fontStyle: 'bold' } },
      head: [['Hora', 'Tipo', 'Cliente', 'Observação', 'Forma Pgto', 'Valor']],
      body: manualRows,
    });
    y = (doc as any).lastAutoTable.finalY + 4;

    const totalManual = manualEntries.reduce((a, s) => a + Number(s.total), 0);
    autoTable(doc, {
      startY: y, margin: { left: margin, right: margin }, theme: 'plain',
      bodyStyles: { fontSize: 9, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 60 }, 1: { halign: 'right' } },
      body: [['Total Recebimentos Manuais', fc(totalManual)]],
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Conferência de Caixa (Dinheiro)', margin, y);
  y += 2;

  const confRows = [
    ['Troco Inicial (Abertura)', fc(Number(register.opening_amount) || 0)],
    ['(+) Vendas em Dinheiro', fc(summary.totalCash)],
    ['(+) Reforços', fc(summary.totalReforco)],
    ['(-) Sangrias', fc(summary.totalSangria)],
    ['(=) Dinheiro Esperado', fc(expectedCash)],
  ];
  if (closingAmount !== undefined) {
    confRows.push(['Valor Contado no Fechamento', fc(closingAmount)]);
    const diff = closingAmount - expectedCash;
    confRows.push([diff >= 0 ? 'Sobra' : 'Falta', fc(Math.abs(diff))]);
  }

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: { fillColor: [50, 50, 50], fontSize: 8 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 }, 1: { halign: 'right' } },
    head: [['Descrição', 'Valor']],
    body: confRows,
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ─── LISTA DE VENDAS ───
  if ((sales || []).length > 0) {
    // Check if needs new page
    if (y > 230) { doc.addPage(); y = 14; }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Vendas Detalhadas', margin, y);
    y += 2;

    const saleRows = (sales || []).map(s => {
      const salePayments = allPayments.filter(p => p.sale_id === s.id);
      const methods = salePayments.map(p => {
        const label = { cash: 'Din', card: 'Cart', pix: 'Pix', crediario: 'Cred', financeira: 'Fin' }[p.method as string] || p.method;
        return `${label} ${fc(Number(p.paid_value))}`;
      }).join(' + ');
      return [
        `#${s.sale_number || '—'}`,
        new Date(s.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        s.customer_id ? (customerMap[s.customer_id] || '—') : 'Consumidor',
        sellerMap[s.seller_id] || '—',
        s.source === 'ecommerce' ? 'Online' : 'PDV',
        methods || '—',
        fc(Number(s.total)),
      ];
    });

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: 'grid',
      headStyles: { fillColor: [50, 50, 50], fontSize: 7 },
      bodyStyles: { fontSize: 7 },
      columnStyles: { 6: { halign: 'right', fontStyle: 'bold' } },
      head: [['Pedido', 'Hora', 'Cliente', 'Vendedor', 'Origem', 'Pagamento', 'Total']],
      body: saleRows,
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Footer
  if (y > 270) { doc.addPage(); y = 14; }
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(140);
  doc.text(`Relatório gerado em ${new Date().toLocaleString('pt-BR')} — Disarah Interiores`, margin, doc.internal.pageSize.getHeight() - 8);
  doc.setTextColor(0);

  // Page numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(140);
    doc.text(`Página ${i} de ${totalPages}`, pw - margin, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
    doc.setTextColor(0);
  }

  const dateFile = new Date(openedAt).toISOString().split('T')[0].replace(/-/g, '');
  doc.save(`relatorio-caixa-${dateFile}.pdf`);
}
