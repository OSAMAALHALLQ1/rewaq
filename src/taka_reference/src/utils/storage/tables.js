import { cache, persist, triggerSync, writeRecord } from './core.js';
import { clone } from './helpers.js';
import { TABLES_KEY } from './constants.js';
import { normalizeTablesTo70 } from './table-normalization.js';

export const getTables = () => clone(normalizeTablesTo70(cache[TABLES_KEY]));
export const saveTables = async (t, options = {}) => { 
  if (!Array.isArray(t)) return false; 
  const normalized = normalizeTablesTo70(t);
  if (options.sync === false) {
    cache[TABLES_KEY] = clone(normalized);
    await writeRecord(TABLES_KEY, normalized);
    triggerSync(TABLES_KEY);
    return true;
  }
  return persist(TABLES_KEY, normalized, options.changedItemOrId ?? null); 
};
