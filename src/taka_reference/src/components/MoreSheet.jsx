import { createPortal } from 'react-dom';
import { Settings, Armchair, Receipt, ClipboardList, KeyRound, ShieldCheck, LogOut, X } from 'lucide-react';

export default function MoreSheet({ show, onClose, userRole, onLogout, onNavigate }) {
  if (!show) return null;

  const managerOptions = [
    { tab: 'tables', icon: Armchair, label: 'الطاولات' },
    { tab: 'bills', icon: Receipt, label: 'الفواتير' },
    { tab: 'menu', icon: ClipboardList, label: 'المنيو' },
    { tab: 'permissions', icon: ShieldCheck, label: 'الصلاحيات' },
  ];

  const cashierOptions = [
    { tab: 'reports', icon: Receipt, label: 'التقارير' },
    { tab: 'bills', icon: ClipboardList, label: 'الفواتير' },
  ];

  const options = userRole === 'manager' ? managerOptions : cashierOptions;

  return createPortal(
    <div className="bottom-sheet-overlay animate-fade-in" onClick={onClose} dir="rtl">
      <div className="bottom-sheet-drawer animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="bottom-sheet-handle" />
        <div className="bottom-sheet-header">
          <div className="bottom-sheet-title">
            <Settings size={18} style={{ color: 'var(--color-primary)' }} />
            <span>التحكم الإضافي</span>
          </div>
          <button className="bottom-sheet-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="bottom-sheet-content">
          <div className="more-options-grid">
            {options.map(opt => (
              <button
                key={opt.tab}
                className="more-option-btn"
                onClick={() => { onNavigate(opt.tab); onClose(); }}
              >
                <opt.icon size={22} style={{ color: 'var(--text-muted)' }} />
                <span className="more-option-label">{opt.label}</span>
              </button>
            ))}
            <button
              className="more-option-btn"
              style={{ color: '#dc2626', borderColor: 'rgba(220, 38, 38, 0.15)' }}
              onClick={() => { onClose(); onLogout(); }}
            >
              <LogOut size={22} />
              <span className="more-option-label">تسجيل خروج</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
