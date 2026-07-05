import { Menu } from 'lucide-react';
import BrandLogo from '../BrandLogo';

const ROLE_LABELS = { manager: 'المدير', waiter: 'جرسون', cashier: 'محاسب', kitchen: 'مطبخ', bar: 'بار', shisha: 'شيشة' };

export default function MobileHeader({ user, onMenuClick }) {
  return (
    <header className="mobile-header">
      <div className="mobile-header-brand">
        <BrandLogo size={22} />
        <span className="mobile-header-title">تكة</span>
        <span className="mobile-header-role-badge">{ROLE_LABELS[user?.role] || user?.role}</span>
      </div>

      <div className="mobile-header-center">
        <span className="mobile-header-user-name">{user?.name}</span>
        <span className="mobile-header-user-code">{user?.role === 'manager' ? 'ADMIN' : `#${user?.code}`}</span>
      </div>

      <button
        className="mobile-header-menu-btn"
        onClick={onMenuClick}
        aria-label="فتح القائمة"
      >
        <Menu size={22} strokeWidth={2.5} />
      </button>
    </header>
  );
}