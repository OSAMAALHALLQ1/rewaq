export const mapToDB = (obj, map) => {
  if (!obj || typeof obj !== 'object') return obj;
  const dbObj = {};
  for (const [jsKey, dbKey] of Object.entries(map)) {
    if (obj[jsKey] !== undefined) {
      dbObj[dbKey] = obj[jsKey];
    }
  }
  for (const key of Object.keys(obj)) {
    if (map[key] === undefined && !key.startsWith('_')) {
      const autoSnake = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      dbObj[autoSnake] = obj[key];
    }
  }
  return dbObj;
};

export const mapFromDB = (dbObj, map) => {
  if (!dbObj || typeof dbObj !== 'object') return dbObj;
  const jsObj = {};
  const reverseMap = Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k]));
  for (const key of Object.keys(dbObj)) {
    const jsKey = reverseMap[key];
    if (jsKey) {
      jsObj[jsKey] = dbObj[key];
    } else {
      const autoCamel = key.replace(/([-_][a-z])/g, group =>
        group.toUpperCase().replace('-', '').replace('_', '')
      );
      jsObj[autoCamel] = dbObj[key];
    }
  }
  return jsObj;
};

export const normalizeEmployee = (e) => ({
  active: true, salary: 0, email: '', lastLogin: null, ...e
});

export const clone = (v) => {
  try { return structuredClone(v); } catch { return JSON.parse(JSON.stringify(v)); }
};
