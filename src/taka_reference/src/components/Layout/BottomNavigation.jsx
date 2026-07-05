// src/components/Layout/BottomNavigation.jsx
import React from 'react';
import {
  LayoutGrid, ClipboardList, User,
  Receipt, CheckCircle2, TrendingUp,
  LayoutDashboard, Users, Grid3X3
} from 'lucide-react';
import styles from './BottomNavigation.module.css';


const ROLE_NAV = {
  waiter: [
    { label: 'الطاولات', tab: 'dashboard', icon: LayoutGrid },
    { label: 'الطلبات', tab: 'orders', icon: ClipboardList },
    { label: 'الملف', tab: 'profile', icon: User },
  ],
  cashier: [
    { label: 'النشطة', tab: 'active', icon: Receipt },
    { label: 'الفواتير', tab: 'bills', icon: CheckCircle2 },
    { label: 'التقارير', tab: 'reports', icon: TrendingUp },
    { label: 'المزيد', tab: 'more', icon: Grid3X3 },
  ],
  manager: [
    { label: 'الرئيسية', tab: 'dashboard', icon: LayoutDashboard },
    { label: 'الطلبات', tab: 'orders', icon: ClipboardList },
    { label: 'الموظفون', tab: 'staff', icon: Users },
    { label: 'المزيد', tab: 'more', icon: Grid3X3 },
  ],
};

const secondaryTabs = ['tables', 'bills', 'staff', 'codes', 'permissions', 'settings'];

export default function BottomNavigation({ activeTab, setActiveTab, role = 'manager', onMoreClick }) {
  const items = ROLE_NAV[role] || ROLE_NAV.manager;

  return (
    <nav className={styles.container}>
      {items.map(item => {
        const IconComponent = item.icon;
        const isMore = item.tab === 'more';
        const isActive = isMore
          ? secondaryTabs.includes(activeTab)
          : activeTab === item.tab;

        return (
          <button
            key={item.tab}
            onClick={() => isMore ? (onMoreClick ? onMoreClick() : setActiveTab(item.tab)) : setActiveTab(item.tab)}
            className={styles.navItem}
          >
            <span className={`${styles.iconWrapper} ${isActive ? styles.iconWrapperActive : ''}`}>
              <IconComponent size={22} strokeWidth={isActive ? 2.5 : 2} />
            </span>
            <span className={`${styles.label} ${isActive ? styles.labelActive : ''}`}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
