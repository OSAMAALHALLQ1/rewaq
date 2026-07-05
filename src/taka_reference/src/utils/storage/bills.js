import { supabase } from '../supabaseClient.js';
import { cache, persist, writeRecord, triggerSync, enqueueMutation } from './core.js';
import { clone, mapFromDB } from './helpers.js';
import { BILLS_KEY, MAX_BILLS_KEPT, ARCHIVES_KEY, BILL_FIELD_MAP } from './constants.js';
import { getTenantId } from './tenant.js';

export const getBills = () => clone(cache[BILLS_KEY]);

export const saveBills = async (b, changedItemOrId = null, options = {}) => { 
  if (!Array.isArray(b)) return false; 
  const next = b.slice(0, MAX_BILLS_KEPT);
  if (options.sync === false) {
    cache[BILLS_KEY] = clone(next);
    await writeRecord(BILLS_KEY, next);
    triggerSync(BILLS_KEY);
    return true;
  }
  return await persist(BILLS_KEY, next, changedItemOrId); 
};

export const closeTableInvoiceAtomic = async ({ billId, tableId, paymentMethod, cashierCode, cashierName, notes = '' }) => {
  if (!supabase) return null;

  const { data, error } = await supabase.rpc('close_table_invoice_atomic', {
    p_bill_id: billId,
    p_table_id: String(tableId),
    p_payment_method: paymentMethod,
    p_cashier_code: cashierCode || '',
    p_cashier_name: cashierName || '',
    p_notes: notes || '',
    p_restaurant_id: getTenantId()
  });

  if (error) throw error;
  return mapFromDB(data, BILL_FIELD_MAP);
};

export const getArchives = () => clone(cache[ARCHIVES_KEY]) || [];

export const saveArchive = async (archive) => {
  const archives = getArchives();
  archives.push(archive);
  return await persist(ARCHIVES_KEY, archives, archive.id);
};


export const deleteBills = async (ids) => {
  const current = getBills();
  const next = current.filter(b => !ids.includes(b.id));
  cache[BILLS_KEY] = clone(next);
  await writeRecord(BILLS_KEY, next);
  triggerSync(BILLS_KEY);
  if (supabase) {
    await enqueueMutation(BILLS_KEY, 'delete_in', ids);
  }
};

export const deleteAllBills = async () => {
  cache[BILLS_KEY] = [];
  await writeRecord(BILLS_KEY, []);
  triggerSync(BILLS_KEY);
  if (supabase) {
    await enqueueMutation(BILLS_KEY, 'delete_all');
  }
};

export const exportBills = (ids) => {
  const all = getBills();
  const data = ids && Array.isArray(ids) ? all.filter(b => ids.includes(b.id)) : all;
  try {
    return JSON.stringify(data, null, 2);
  } catch (e) {
    console.error('Failed to export bills:', e);
    return '';
  }
};

export const filterBills = ({ startDate, endDate, minTotal } = {}) => {
  const all = getBills();
  return all.filter(b => {
    const dateOk = (!startDate || new Date(b.timestamp) >= new Date(startDate)) && (!endDate || new Date(b.timestamp) <= new Date(endDate));
    const totalOk = minTotal === undefined || b.total >= minTotal;
    return dateOk && totalOk;
  });
};

export const exportBillsToCSV = (criteria = {}) => {
  const rows = filterBills(criteria);
  if (!rows.length) return;
  const header = ['ID','Table','Waiter','Timestamp','Subtotal','Tax','Service','Total'];
  const csv = [header.join(','), ...rows.map(b => [b.id,b.tableName,b.waiterCode,new Date(b.timestamp).toISOString(),b.subtotal,b.tax,b.serviceCharge,b.total].join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `bills_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
