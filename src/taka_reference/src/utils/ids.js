const randomPart = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};

export const createEntityId = (prefix) => `${prefix}-${randomPart()}`;

export const createOrderId = () => createEntityId('order');

export const createNotificationId = () => createEntityId('n');

export const createMutationId = () => createEntityId('mut');

export const createSessionToken = () => createEntityId('sess');

export const createBillId = (tableId, seatedAt) => {
  const sessionPart = seatedAt || Date.now();
  return `INV-${tableId}-${sessionPart}`;
};
