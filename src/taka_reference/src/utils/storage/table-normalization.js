export const DEFAULT_TABLE_COUNT = 70;

export const makeDefaultTable = (id) => ({
  id,
  name: `طاولة ${id}`,
  seats: id <= 30 ? 4 : id <= 55 ? 6 : 8,
  area: id <= 35 ? 'indoor' : id <= 55 ? 'outdoor' : 'terrace',
  status: 'empty',
  currentOrder: [],
  notes: '',
  subtotal: 0,
  tax: 0,
  serviceCharge: 0,
  total: 0,
  waiterCode: null,
  seatedAt: null,
  guests: 0
});

export const isManagedTableId = (id) => {
  const numId = Number(id);
  return Number.isInteger(numId) && numId >= 1 && numId <= DEFAULT_TABLE_COUNT;
};

export const normalizeTablesTo70 = (tablesList) => {
  const existingMap = new Map();

  if (Array.isArray(tablesList)) {
    tablesList.forEach((table) => {
      if (!table || !isManagedTableId(table.id)) return;

      const numId = Number(table.id);
      const existing = existingMap.get(numId);
      const tableHasOrder = table.status && table.status !== 'empty';
      const existingIsEmpty = !existing || existing.status === 'empty';
      const tableHasTotal = Number(table.total || 0) > Number(existing?.total || 0);

      if (!existing || (tableHasOrder && existingIsEmpty) || tableHasTotal) {
        existingMap.set(numId, { ...makeDefaultTable(numId), ...table, id: numId });
      }
    });
  }

  return Array.from({ length: DEFAULT_TABLE_COUNT }, (_, index) => {
    const id = index + 1;
    return existingMap.get(id) || makeDefaultTable(id);
  });
};
