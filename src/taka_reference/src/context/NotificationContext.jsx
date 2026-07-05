import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import {
  getNotifications,
  addNotification as storeAddNotification,
  deleteNotification as storeDeleteNotification,
} from '../utils/storage';

export const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState(() => getNotifications());

  const sync = useCallback(() => {
    setNotifications(getNotifications());
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

  const addNotification = useCallback((title, message, type = 'info', targetRoles = []) => {
    // Prevent duplicate notifications
    const existing = getNotifications();
    if (existing.some(n => n.title === title && n.message === message && n.type === type)) {
      return null;
    }
    const notif = storeAddNotification(title, message, type, targetRoles);
    sync();
    return notif?.id;
  }, [sync]);

  const removeNotification = useCallback(async (id) => {
    await storeDeleteNotification(id);
    sync();
  }, [sync]);

  const value = useMemo(() => ({
    notifications,
    addNotification,
    removeNotification,
  }), [notifications, addNotification, removeNotification]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}
