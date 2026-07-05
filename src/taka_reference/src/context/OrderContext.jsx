import React, { createContext, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  getTables,
  saveTables,
  getDeptOrders,
  saveDeptOrders,
  updateDeptOrderItem,
  getBills,
  saveBills,
  deleteDeptOrdersForTable
} from '../utils/storage';

export const OrderContext = createContext();

export function OrderProvider({ children }) {
  const [orders, setOrders] = useState(() => Object.values(getDeptOrders()));
  const [tables, setTables] = useState(() => getTables());
  const [invoices, setInvoices] = useState(() => getBills());
  const [loading, setLoading] = useState({});
  
  const pendingOperationsRef = useRef(new Set());

  const sync = useCallback(() => {
    setOrders(Object.values(getDeptOrders()));
    setTables(getTables());
    setInvoices(getBills());
  }, []);

  useEffect(() => {
    window.addEventListener('taka_sync', sync);
    window.addEventListener('takah_sync', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('taka_sync', sync);
      window.removeEventListener('takah_sync', sync);
      window.removeEventListener('storage', sync);
    };
  }, [sync]);

  // Update order or item status with double-click/race prevention
  const updateOrderStatus = useCallback(async (orderId, itemIdOrStatus, possibleStatus, department) => {
    let itemId = null;
    let newStatus = itemIdOrStatus;
    if (possibleStatus !== undefined) {
      itemId = itemIdOrStatus;
      newStatus = possibleStatus;
    }

    const opKey = `order-${orderId}-${itemId || 'all'}-${newStatus}-${department || 'all'}`;
    if (pendingOperationsRef.current.has(opKey)) {
      return false;
    }
    
    pendingOperationsRef.current.add(opKey);
    setLoading(prev => ({ ...prev, [orderId]: true }));
    
    try {
      if (itemId) {
        // Update single item
        await updateDeptOrderItem(orderId, itemId, { status: newStatus });
      } else {
        // Update all items in the order
        const currentOrders = getDeptOrders();
        const order = currentOrders[orderId];
        if (order) {
          order.items = (order.items || []).map(item => {
            if (department && item.department !== department) {
              return item;
            }
            return {
              ...item,
              status: newStatus,
              readyAt: newStatus === 'ready' ? Date.now() : item.readyAt
            };
          });
          await saveDeptOrders(currentOrders);

          // Update corresponding table order state
          const currentTables = getTables();
          const tableIdx = currentTables.findIndex(t => t.id === order.tableId);
          if (tableIdx !== -1) {
            const table = currentTables[tableIdx];
            table.currentOrder = (table.currentOrder || []).map(item => {
              if (item.orderId === orderId) {
                if (department && item.department !== department) {
                  return item;
                }
                return {
                  ...item,
                  status: newStatus,
                  readyAt: newStatus === 'ready' ? Date.now() : item.readyAt
                };
              }
              return item;
            });
            await saveTables(currentTables);
          }
        }
      }

      // Trigger sync
      window.dispatchEvent(new CustomEvent('taka_sync'));
      return true;
    } catch (error) {
      console.error('Failed to update order status:', error);
      return false;
    } finally {
      pendingOperationsRef.current.delete(opKey);
      setLoading(prev => ({ ...prev, [orderId]: false }));
    }
  }, []);

  // Update table status with double-click/race prevention
  const updateTableStatus = useCallback(async (tableId, newStatus) => {
    const opKey = `table-${tableId}-${newStatus}`;
    if (pendingOperationsRef.current.has(opKey)) {
      return false;
    }
    
    pendingOperationsRef.current.add(opKey);
    setLoading(prev => ({ ...prev, [tableId]: true }));
    
    try {
      const currentTables = getTables();
      const tableIdx = currentTables.findIndex(t => t.id === tableId);
      if (tableIdx !== -1) {
        const table = currentTables[tableIdx];
        table.status = newStatus;
        if (newStatus === 'empty') {
          table.currentOrder = [];
          table.notes = '';
          table.subtotal = 0;
          table.tax = 0;
          table.serviceCharge = 0;
          table.total = 0;
          table.waiterCode = null;
          table.seatedAt = null;
          table.guests = 0;
        }
        await saveTables(currentTables);
        window.dispatchEvent(new CustomEvent('taka_sync'));
      }
      return true;
    } catch (error) {
      console.error('Failed to update table status:', error);
      return false;
    } finally {
      pendingOperationsRef.current.delete(opKey);
      setLoading(prev => ({ ...prev, [tableId]: false }));
    }
  }, []);

  // Close invoice with double-click/race prevention
  const closeInvoice = useCallback(async (invoiceId) => {
    const opKey = `invoice-${invoiceId}`;
    if (pendingOperationsRef.current.has(opKey)) {
      return false;
    }
    
    pendingOperationsRef.current.add(opKey);
    setLoading(prev => ({ ...prev, [invoiceId]: true }));
    
    try {
      const currentBills = getBills();
      const bill = currentBills.find(b => b.id === invoiceId);
      if (!bill) return false;
      
      // Update table to empty
      const currentTables = getTables();
      const tableIdx = currentTables.findIndex(t => t.id === bill.tableId);
      if (tableIdx !== -1) {
        const table = currentTables[tableIdx];
        table.status = 'empty';
        table.currentOrder = [];
        table.notes = '';
        table.subtotal = 0;
        table.tax = 0;
        table.serviceCharge = 0;
        table.total = 0;
        table.waiterCode = null;
        table.seatedAt = null;
        table.guests = 0;
        await saveTables(currentTables);
      }
      
      // Remove dept orders for this table
      await deleteDeptOrdersForTable(bill.tableId);
      
      // Trigger sync
      window.dispatchEvent(new CustomEvent('taka_sync'));
      
      return true;
    } catch (error) {
      console.error('Failed to close invoice:', error);
      return false;
    } finally {
      pendingOperationsRef.current.delete(opKey);
      setLoading(prev => ({ ...prev, [invoiceId]: false }));
    }
  }, []);

  const value = useMemo(() => ({
    orders,
    tables,
    invoices,
    loading,
    updateOrderStatus,
    updateTableStatus,
    closeInvoice,
  }), [orders, tables, invoices, loading, updateOrderStatus, updateTableStatus, closeInvoice]);

  return (
    <OrderContext.Provider value={value}>
      {children}
    </OrderContext.Provider>
  );
}
