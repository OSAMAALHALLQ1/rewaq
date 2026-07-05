import { cache, persist } from './core.js';
import { clone } from './helpers.js';
import { DEPARTMENTS_KEY } from './constants.js';

export const getDepartments = () => clone(cache[DEPARTMENTS_KEY]);

export const saveDepartments = async (d) => { 
  if (!Array.isArray(d)) return false; 
  return await persist(DEPARTMENTS_KEY, d); 
};
