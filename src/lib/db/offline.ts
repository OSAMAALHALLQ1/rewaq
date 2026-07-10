export type PayMethod = "cash" | "card" | "bank_transfer" | "delivery_app" | "receivable" | "wallet";
export type PaymentLine = { method: PayMethod; amount: number };

export type QueuedInvoice = {
  id: string;
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

export async function getQueuedInvoices(): Promise<QueuedInvoice[]> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, "readonly");
      const store = tx.objectStore(QUEUE_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const sorted = (req.result || []).sort((a, b) => a.timestamp - b.timestamp);
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

export async function getSyncLogs(): Promise<SyncLogEntry[]> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(LOG_STORE, "readonly");
      const store = tx.objectStore(LOG_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const sorted = (req.result || []).sort((a, b) => b.timestamp - a.timestamp);
        resolve(sorted);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function clearSyncLogs(): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LOG_STORE, "readwrite");
    const store = tx.objectStore(LOG_STORE);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
