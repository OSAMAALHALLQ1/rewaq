import { cache, persist } from './core.js';
import { clone } from './helpers.js';
import { MENU_KEY } from './constants.js';
import { normalizeMenuItems } from './menu-normalization.js';

export const getMenu = () => normalizeMenuItems(clone(cache[MENU_KEY]));

export const saveMenu = async (m) => { 
  if (!Array.isArray(m)) return false; 
  return await persist(MENU_KEY, normalizeMenuItems(m));
};
