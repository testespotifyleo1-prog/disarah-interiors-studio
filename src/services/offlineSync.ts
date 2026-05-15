/**
 * Offline Sync Service - synchronizes offline sales to the backend.
 * Prevents duplicates using local ID tracking.
 */

import { supabase } from '@/integrations/supabase/client';
import {
  getOfflineSales,
  updateOfflineSaleStatus,
  type OfflineSale,
} from './offlineStore';

export type SyncResult = {
  id: string;
  success: boolean;
  remoteSaleId?: string;
  error?: string;
};

let syncing = false;

export async function syncOfflineSales(storeId?: string): Promise<SyncResult[]> {
  if (syncing) return [];
  syncing = true;

  const results: SyncResult[] = [];

  try {
    const all = await getOfflineSales(storeId);
    const pending = all.filter(s => s.status === 'pending' || s.status === 'error');

    for (const sale of pending) {
      // Mark as syncing
      await updateOfflineSaleStatus(sale.id, 'syncing');

      try {
        const remoteSaleId = await syncSingleSale(sale);
        await updateOfflineSaleStatus(sale.id, 'synced', {
          synced_sale_id: remoteSaleId,
          sync_error: undefined,
        });
        results.push({ id: sale.id, success: true, remoteSaleId });
      } catch (err: any) {
        const errMsg = err?.message || 'Erro desconhecido';
        await updateOfflineSaleStatus(sale.id, 'error', {
          sync_error: errMsg,
          sync_attempts: (sale.sync_attempts || 0) + 1,
        });
        results.push({ id: sale.id, success: false, error: errMsg });
      }
    }
  } finally {
    syncing = false;
  }

  return results;
}

async function syncSingleSale(sale: OfflineSale): Promise<string> {
  // 1. Create sale
  const { data: remoteSale, error: saleErr } = await supabase
    .from('sales')
    .insert({
      account_id: sale.account_id,
      store_id: sale.store_id,
      seller_user_id: sale.seller_user_id,
      customer_id: sale.customer_id || null,
      status: 'open',
      discount: sale.discount,
      delivery_fee: sale.delivery_fee,
      assembly_fee: sale.assembly_fee || 0,
      subtotal: sale.subtotal,
      total: sale.total,
      notes: sale.notes ? `[OFFLINE ${sale.created_at}] ${sale.notes}` : `[OFFLINE ${sale.created_at}]`,
    })
    .select()
    .single();

  if (saleErr) throw saleErr;

  const saleId = remoteSale.id;

  // 2. Insert items
  const items = sale.items.map(item => ({
    sale_id: saleId,
    product_id: item.product_id,
    qty: item.base_qty || item.qty,
    unit_price: item.unit_price,
    unit_cost: item.unit_cost,
    total_line: item.total_line,
    variant_id: item.variant_id || null,
    presentation_id: item.presentation_id || null,
    presentation_name: item.presentation_name || null,
    sold_qty: item.sold_qty || null,
    base_qty: item.base_qty || null,
  }));

  const { error: itemsErr } = await supabase.from('sale_items').insert(items);
  if (itemsErr) throw itemsErr;

  // 3. Insert payments
  for (const payment of sale.payments) {
    const feeValue = payment.card_fee_percent > 0
      ? Math.round(payment.amount * payment.card_fee_percent / 100 * 100) / 100
      : 0;

    const paymentData = {
      sale_id: saleId,
      method: payment.method as any,
      card_type: payment.method === 'card' ? (payment.card_type || null) : null,
      brand: payment.method === 'card' ? (payment.card_brand || null) : null,
      installments: payment.installments,
      card_fee_percent: payment.card_fee_percent || 0,
      card_fee_value: feeValue,
      paid_value: payment.amount,
    };

    const { error: payErr } = await (supabase as any).from('payments').insert(paymentData);
    if (payErr) throw payErr;
  }

  // 4. Mark as paid (triggers inventory deduction, commission, delivery)
  const { error: paidErr } = await supabase
    .from('sales')
    .update({ status: 'paid', updated_at: new Date().toISOString() })
    .eq('id', saleId);

  if (paidErr) throw paidErr;

  return saleId;
}

export function isSyncing(): boolean {
  return syncing;
}
