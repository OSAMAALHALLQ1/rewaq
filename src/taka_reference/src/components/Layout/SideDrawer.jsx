import { useEffect, useRef } from 'react';
import {
  Bell, Volume2, VolumeX, LogOut, User, ShieldCheck, Moon, Sun
} from 'lucide-react';

export default function SideDrawer({
  open, onClose, user, soundEnabled, onToggleSound, onLogout,
  notifications, unreadCount, onMarkAllRead,
}) {
  const drawerRef = useRef(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="side-drawer-overlay" onClick={onClose}>
      <aside
        ref={drawerRef}
        className="side-drawer-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="القائمة الجانبية"
      >
        {/* User profile section */}
        <div className="side-drawer-user">
          <div className="side-drawer-avatar">
            {user?.name?.charAt(0) || '?'}
          </div>
          <div className="side-drawer-user-info">
            <div className="side-drawer-user-name">{user?.name}</div>
            <div className="side-drawer-user-role">{user?.role === 'manager' ? 'مدير النظام' : `موظف #${user?.code}`}</div>
          </div>
        </div>

        {/* Notifications summary */}
        <div className="side-drawer-section">
          <div className="side-drawer-section-title">الإشعارات</div>
          <div className="side-drawer-item" onClick={() => { onMarkAllRead(); }}>
            <Bell size={20} />
            <span>الإشعارات</span>
            {unreadCount > 0 && (
              <span className="side-drawer-badge">{unreadCount}</span>
            )}
          </div>
        </div>

        {/* Settings */}
        <div className="side-drawer-section">
          <div className="side-drawer-section-title">الإعدادات</div>
          <div className="side-drawer-item" onClick={onToggleSound}>
            {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            <span>{soundEnabled ? 'الصوت مفعل' : 'الصوت معطل'}</span>
            <span className="side-drawer-toggle">
              <span className={`side-drawer-toggle-knob ${soundEnabled ? 'on' : ''}`} />
            </span>
          </div>
        </div>

        {/* Logout */}
        <div className="side-drawer-section" style={{ marginTop: 'auto' }}>
          <div className="side-drawer-item side-drawer-item-danger" onClick={onLogout}>
            <LogOut size={20} />
            <span>تسجيل خروج</span>
          </div>
        </div>
      </aside>
    </div>
  );
}