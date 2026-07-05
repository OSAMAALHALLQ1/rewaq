import { supabase } from '../supabaseClient.js';
import { cache, persist, writeRecord, triggerSync, enqueueMutation } from './core.js';
import { clone, mapFromDB } from './helpers.js';
import { DEPT_ORDERS_KEY, TABLES_KEY, TAX_RATE, SERVICE_RATE, DEPT_ORDER_FIELD_MAP } from './constants.js';
import { getTenantId } from './tenant.js';
import { getTables } from './tables.js';

export const getDeptOrders = () => clone(cache[DEPT_ORDERS_KEY]);

export const saveDeptOrders = async (d, changedItemOrId = null, options = {}) => { 
  if (!d || typeof d !== 'object') return false; 
  if (options.sync === false) {
    cache[DEPT_ORDERS_KEY] = clone(d);
    await writeRecord(DEPT_ORDERS_KEY, d);
    triggerSync(DEPT_ORDERS_KEY);
    return true;
  }
  return await persist(DEPT_ORDERS_KEY, d, changedItemOrId); 
};

export const submitOrderAtomic = async ({ order, notes = '', guests = 1 }) => {
  if (!supabase || !order) return null;

  const { data, error } = await supabase.rpc('submit_order_atomic', {
    p_order_id: order.id,
    p_table_id: String(order.tableId),
    p_waiter_code: order.waiterCode || '',
    p_waiter_name: order.waiterName || '',
    p_items: order.items || [],
    p_notes: notes || '',
    p_guests: guests || 1,
    p_restaurant_id: getTenantId()
  });

  if (error) throw error;
  return mapFromDB(data, DEPT_ORDER_FIELD_MAP);
};

export const deleteDeptOrder = async (id) => {
  const orders = getDeptOrders();
  if (orders[id]) {
    delete orders[id];
    cache[DEPT_ORDERS_KEY] = clone(orders);
    await writeRecord(DEPT_ORDERS_KEY, orders);
    triggerSync(DEPT_ORDERS_KEY);
    if (supabase) {
      await enqueueMutation(DEPT_ORDERS_KEY, 'delete', id);
    }
  }
};

export const deleteDeptOrdersForTable = async (tableId, options = {}) => {
  const orders = getDeptOrders();
  const toDeleteIds = Object.keys(orders).filter(id => Number(orders[id].tableId) === Number(tableId));
  if (toDeleteIds.length > 0) {
    const filtered = Object.fromEntries(Object.entries(orders).filter(([, o]) => Number(o.tableId) !== Number(tableId)));
    cache[DEPT_ORDERS_KEY] = clone(filtered);
    await writeRecord(DEPT_ORDERS_KEY, filtered);
    triggerSync(DEPT_ORDERS_KEY);
    if (supabase && options.sync !== false) {
      await enqueueMutation(DEPT_ORDERS_KEY, 'delete_in', toDeleteIds);
    }
    return toDeleteIds.length;
  }
  return 0;
};

export const updateDeptOrderItem = async (orderId, itemId, updates) => {
  const orders = getDeptOrders();
  if (!orders[orderId]) return false;

  const finalUpdates = { ...updates };
  if (updates.status === 'ready' && !updates.readyAt) {
    finalUpdates.readyAt = Date.now();
  }
  if (updates.status === 'delivered' && !updates.deliveredAt) {
    finalUpdates.deliveredAt = Date.now();
  }

  orders[orderId].items = (orders[orderId].items || []).map(item =>
    item.id === itemId ? { ...item, ...finalUpdates } : item
  );
  await persist(DEPT_ORDERS_KEY, orders, orderId);

  // Sync item status back to the corresponding table
  const tableId = orders[orderId].tableId;
  if (tableId) {
    const tables = getTables();
    const tableIndex = tables.findIndex(t => Number(t.id) === Number(tableId));
    if (tableIndex !== -1) {
      const table = tables[tableIndex];
      let updated = false;
      table.currentOrder = (table.currentOrder || []).map(item => {
        if (item.id === itemId && item.status !== 'delivered') {
          updated = true;
          return { ...item, ...finalUpdates };
        }
        return item;
      });
      // Fallback matching if not already updated
      if (!updated) {
        table.currentOrder = (table.currentOrder || []).map(item => {
          if (item.id === itemId) return { ...item, ...finalUpdates };
          return item;
        });
      }
      await persist(TABLES_KEY, tables, tableId);
    }
  }

  return true;
};

export const cancelOngoingItem = async (tableId, orderId, itemId) => {
  // 1. Update table's currentOrder by removing the item
  const tables = getTables();
  const tableIdx = tables.findIndex(t => Number(t.id) === Number(tableId));
  if (tableIdx === -1) return false;
  
  const table = tables[tableIdx];
  let updatedTable = false;
  
  table.currentOrder = (table.currentOrder || []).filter(item => {
    const matchOrder = !orderId || item.orderId === orderId;
    const isMatch = matchOrder && item.id === itemId && ['new', 'preparing'].includes(item.status);
    if (isMatch) {
      updatedTable = true;
      return false;
    }
    return true;
  });
  
  if (updatedTable) {
    if (table.currentOrder.length === 0) {
      table.status = 'empty';
      table.notes = '';
      table.subtotal = 0;
      table.tax = 0;
      table.serviceCharge = 0;
      table.total = 0;
      table.waiterCode = null;
      table.seatedAt = null;
      table.guests = 0;
    } else {
      const sub = table.currentOrder.reduce((s, i) => s + i.price * i.qty, 0);
      table.subtotal = sub;
      table.tax = sub * TAX_RATE;
      table.serviceCharge = sub * SERVICE_RATE;
      table.total = sub + table.tax + table.serviceCharge;
    }
    await persist(TABLES_KEY, tables, tableId);
  }

  // 2. Update/remove item from corresponding dept order
  if (orderId) {
    const orders = getDeptOrders();
    const order = orders[orderId];
    if (order) {
      order.items = (order.items || []).filter(item => {
        return !(item.id === itemId && ['new', 'preparing'].includes(item.status));
      });
      
      if (order.items.length === 0) {
        await deleteDeptOrder(orderId);
      } else {
        const sub = order.items.reduce((s, i) => s + i.price * i.qty, 0);
        order.subtotal = sub;
        order.tax = sub * TAX_RATE;
        order.serviceCharge = sub * SERVICE_RATE;
        order.total = sub + order.tax + order.serviceCharge;
        await persist(DEPT_ORDERS_KEY, orders, orderId);
      }
    }
  }
  return true;
};

export const updateOngoingItemQty = async (tableId, orderId, itemId, newQty) => {
  if (newQty <= 0) {
    return await cancelOngoingItem(tableId, orderId, itemId);
  }

  // 1. Update the table's currentOrder
  const tables = getTables();
  const tableIdx = tables.findIndex(t => Number(t.id) === Number(tableId));
  if (tableIdx === -1) return false;
  
  const table = tables[tableIdx];
  let updatedTable = false;
  table.currentOrder = (table.currentOrder || []).map(item => {
    const matchOrder = !orderId || item.orderId === orderId;
    if (matchOrder && item.id === itemId && ['new', 'preparing'].includes(item.status)) {
      updatedTable = true;
      return { ...item, qty: newQty };
    }
    return item;
  });
  
  if (updatedTable) {
    const sub = table.currentOrder.reduce((s, i) => s + i.price * i.qty, 0);
    table.subtotal = sub;
    table.tax = sub * TAX_RATE;
    table.serviceCharge = sub * SERVICE_RATE;
    table.total = sub + table.tax + table.serviceCharge;
    
    await persist(TABLES_KEY, tables, tableId);
  }

  // 2. Update the corresponding dept order
  if (orderId) {
    const orders = getDeptOrders();
    const order = orders[orderId];
    if (order) {
      order.items = (order.items || []).map(item => {
        if (item.id === itemId && ['new', 'preparing'].includes(item.status)) {
          return { ...item, qty: newQty };
        }
        return item;
      });
      const sub = order.items.reduce((s, i) => s + i.price * i.qty, 0);
      order.subtotal = sub;
      order.tax = sub * TAX_RATE;
      order.serviceCharge = sub * SERVICE_RATE;
      order.total = sub + order.tax + order.serviceCharge;
      
      await persist(DEPT_ORDERS_KEY, orders, orderId);
    }
  }
  return true;
};

export const modifyOngoingItem = async (tableId, orderId, itemId, newItem, newQty, newNote) => {
  // 1. Update the table's currentOrder
  const tables = getTables();
  const tableIdx = tables.findIndex(t => Number(t.id) === Number(tableId));
  if (tableIdx === -1) return { success: false };

  const table = tables[tableIdx];
  let updatedTable = false;
  let oldItemName = '';

  table.currentOrder = (table.currentOrder || []).map(item => {
    const matchOrder = !orderId || item.orderId === orderId;
    if (matchOrder && item.id === itemId && ['new', 'preparing'].includes(item.status)) {
      updatedTable = true;
      oldItemName = item.name;
      return {
        ...item,
        id: newItem.id,
        name: newItem.nameAr || newItem.name,
        price: newItem.price,
        department: newItem.department,
        image: newItem.image || '',
        qty: newQty,
        note: newNote,
        status: 'new', // reset status to 'new' for kitchen to prepare
        changedFrom: item.name
      };
    }
    return item;
  });

  if (updatedTable) {
    const sub = table.currentOrder.reduce((s, i) => s + i.price * i.qty, 0);
    table.subtotal = sub;
    table.tax = sub * TAX_RATE;
    table.serviceCharge = sub * SERVICE_RATE;
    table.total = sub + table.tax + table.serviceCharge;

    await persist(TABLES_KEY, tables, tableId);
  }

  // 2. Update the corresponding dept order
  if (orderId) {
    const orders = getDeptOrders();
    const order = orders[orderId];
    if (order) {
      order.items = (order.items || []).map(item => {
        if (item.id === itemId && ['new', 'preparing'].includes(item.status)) {
          return {
            ...item,
            id: newItem.id,
            name: newItem.nameAr || newItem.name,
            price: newItem.price,
            department: newItem.department,
            image: newItem.image || '',
            qty: newQty,
            note: newNote,
            status: 'new',
            changedFrom: oldItemName
          };
        }
        return item;
      });
      const sub = order.items.reduce((s, i) => s + i.price * i.qty, 0);
      order.subtotal = sub;
      order.tax = sub * TAX_RATE;
      order.serviceCharge = sub * SERVICE_RATE;
      order.total = sub + order.tax + order.serviceCharge;

      await persist(DEPT_ORDERS_KEY, orders, orderId);
    }
  }
  return { success: true, oldItemName };
};
