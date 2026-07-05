import { useEffect, useRef } from 'react';
import { CheckCircle, AlertTriangle, Info, XCircle, X } from 'lucide-react';

function ToastItem({ n, onClose }) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const timer = setTimeout(() => {
      onCloseRef.current(n.id);
    }, 4000); // 4 seconds as requested
    return () => clearTimeout(timer);
  }, [n.id]);

  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircle size={20} style={{ color: '#10b981' }} />;
      case 'warning':
        return <AlertTriangle size={20} style={{ color: '#f59e0b' }} />;
      case 'danger':
        return <XCircle size={20} style={{ color: '#f43f5e' }} />;
      default:
        return <Info size={20} style={{ color: '#3b82f6' }} />;
    }
  };

  const getToastClass = (type) => {
    switch (type) {
      case 'success':
        return 'toast-success';
      case 'warning':
        return 'toast-warning';
      case 'danger':
        return 'toast-danger';
      default:
        return 'toast-info';
    }
  };

  return (
    <div className={`toast glass-card ${getToastClass(n.type)}`}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {getIcon(n.type)}
          <span className="toast-title">{n.title}</span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose(n.id);
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '6px',
            borderRadius: '50%',
            transition: 'background-color 0.2s'
          }}
          className="toast-close-btn"
          title="إغلاق"
        >
          <X size={16} />
        </button>
      </div>
      <span className="toast-msg">{n.message}</span>
      <span className="toast-time num-font">{n.time}</span>
    </div>
  );
}

export default function NotificationsToast({ notifications, onClose }) {
  return (
    <div className="toast-container">
      {notifications.map((n) => (
        <ToastItem key={n.id} n={n} onClose={onClose} />
      ))}
    </div>
  );
}

