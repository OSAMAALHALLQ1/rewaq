export * from './constants.js';
export * from './defaults.js';
export * from './core.js';
export * from './helpers.js';
export * from './tables.js';
export * from './auth.js';
export * from './notifications.js';
export * from './bills.js';
export * from './menu.js';
export * from './departments.js';
export * from './orders.js';
export * from './sync.js';

import { getEmployees } from './auth.js';

export const getRestaurantName = () => {
  try {
    const emps = getEmployees();
    const mgr = emps.find(e => e.role === 'manager');
    if (mgr && mgr.restaurantName) return mgr.restaurantName;
    const raw = localStorage.getItem('takka_manager_account');
    if (raw) {
      const acc = JSON.parse(raw);
      if (acc && acc.restaurantName) return acc.restaurantName;
    }
  } catch (e) {
    // ignore
  }
  return 'تكة';
};
export const RESTAURANT_NAME = getRestaurantName(); // Legacy - use getRestaurantName() instead
