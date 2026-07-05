import { useState, useEffect } from 'react';
import { isRealtimeConnected, getSyncQueue } from '../../utils/storage';

export const ConnectionStatus = () => {
  const [isConnected, setIsConnected] = useState(() => {
    try {
      return isRealtimeConnected();
    } catch {
      return true;
    }
  });
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    // Initial fetch of pending count
    try {
      getSyncQueue().then(queue => {
        if (queue) setPendingCount(queue.length);
      }).catch(() => {});
    } catch { /* noop */ }

    const handleStatus = (e) => {
      if (e?.detail && typeof e.detail.connected === 'boolean') {
        setIsConnected(e.detail.connected);
      }
    };
    
    const handleSyncStatus = (e) => {
      if (e?.detail && typeof e.detail.pendingCount === 'number') {
        setPendingCount(e.detail.pendingCount);
      }
    };

    window.addEventListener('taka_connection_status', handleStatus);
    window.addEventListener('taka_sync_status', handleSyncStatus);
    
    return () => {
      window.removeEventListener('taka_connection_status', handleStatus);
      window.removeEventListener('taka_sync_status', handleSyncStatus);
    };
  }, []);

  let color = '#3B6D11';
  let background = '#EAF3DE';
  let border = '1px solid #c9e2b3';
  let dotColor = '#639922';
  let text = 'متصل';

  if (!isConnected) {
    color = '#A32D2D';
    background = '#FCEBEB';
    border = '1px solid #f5c6cb';
    dotColor = '#E24B4A';
    text = pendingCount > 0 ? `غير متصل (${pendingCount} معلقة)` : 'جاري إعادة الاتصال...';
  } else if (pendingCount > 0) {
    color = '#C05621';
    background = '#FEEBC8';
    border = '1px solid #fbd38d';
    dotColor = '#DD6B20';
    text = `جاري المزامنة (${pendingCount} معلقة)`;
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 12,
      color,
      padding: '4px 10px',
      background,
      borderRadius: 20,
      width: 'fit-content',
      fontWeight: 600,
      border,
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      transition: 'all 0.3s ease'
    }}>
      <span style={{
        width: 8, height: 8,
        borderRadius: '50%',
        background: dotColor,
        display: 'inline-block'
      }} />
      {text}
    </div>
  );
};

export default ConnectionStatus;
