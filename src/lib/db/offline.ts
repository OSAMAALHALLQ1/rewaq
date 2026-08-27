export type PayMethod = "cash" | "card" | "bank_transfer" | "delivery_app" | "receivable" | "wallet";
export type PaymentLine = { method: PayMethod; amount: number };

export type QueuedInvoice = {
  id: string;
  organizationId: string;
  branchId?: string;
  idempotencyKey: string;
  paymentMethod: PayMethod;
  customerName: string;
  notes?: string;
  discount: number;
  serviceFee: number;
  deliveryFee: number;
  payments?: PaymentLine[];
  items: Array<{ catalogItemId: string; quantity: number }>;
  total: number;
  timestamp: number;
};

export type SyncLogEntry = {
  id: string;
  organizationId: string;
  branchId?: string;
  idempotencyKey: string;
  customerName: string;
  total: number;
  timestamp: number;
  status: "success" | "failed" | "conflict";
  message: string;
};

const DB_NAME = "rwq_offline_pos";
const DB_VERSION = 1;
const QUEUE_STORE = "invoice_queue";
const LOG_STORE = "sync_log";

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("IndexedDB is only available in the browser"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(LOG_STORE)) {
        db.createObjectStore(LOG_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveQueuedInvoice(invoice: QueuedInvoice): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readwrite");
    const store = tx.objectStore(QUEUE_STORE);
    const req = store.put(invoice);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getQueuedInvoices(organizationId?: string): Promise<QueuedInvoice[]> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, "readonly");
      const store = tx.objectStore(QUEUE_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        let results = (req.result || []) as QueuedInvoice[];
        if (organizationId) {
          results = results.filter((inv) => inv.organizationId === organizationId);
        }
        const sorted = results.sort((a, b) => a.timestamp - b.timestamp);
        resolve(sorted);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function deleteQueuedInvoice(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readwrite");
    const store = tx.objectStore(QUEUE_STORE);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function saveSyncLog(log: SyncLogEntry): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LOG_STORE, "readwrite");
    const store = tx.objectStore(LOG_STORE);
    const req = store.put(log);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getSyncLogs(organizationId?: string): Promise<SyncLogEntry[]> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(LOG_STORE, "readonly");
      const store = tx.objectStore(LOG_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        let results = (req.result || []) as SyncLogEntry[];
        if (organizationId) {
          results = results.filter((entry) => entry.organizationId === organizationId);
        }
        const sorted = results.sort((a, b) => b.timestamp - a.timestamp);
        resolve(sorted);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function clearSyncLogs(organizationId?: string): Promise<void> {
  const db = await getDB();
  if (!organizationId) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(LOG_STORE, "readwrite");
      const store = tx.objectStore(LOG_STORE);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // Clear only logs for the specific organization
  const allLogs = await getSyncLogs(organizationId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LOG_STORE, "readwrite");
    const store = tx.objectStore(LOG_STORE);
    for (const log of allLogs) {
      store.delete(log.id);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearTenantOfflineData(organizationId: string): Promise<void> {
  if (!organizationId) return;
  const db = await getDB();
  const [invoices, logs] = await Promise.all([
    getQueuedInvoices(organizationId),
    getSyncLogs(organizationId),
  ]);

  return new Promise((resolve, reject) => {
    const tx = db.transaction([QUEUE_STORE, LOG_STORE], "readwrite");
    const qStore = tx.objectStore(QUEUE_STORE);
    const lStore = tx.objectStore(LOG_STORE);
    for (const inv of invoices) {
      qStore.delete(inv.id);
    }
    for (const l of logs) {
      lStore.delete(l.id);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
