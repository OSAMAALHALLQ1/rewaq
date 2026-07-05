// src/components/Layout/CashierBottomNavigation.jsx
import React from 'react';
import { Receipt, CheckCircle2, TrendingUp } from 'lucide-react';
import styles from './BottomNavigation.module.css';

const CASHIER_NAV = [
  { label: 'النشطة', tab: 'active', icon: Receipt },
  { label: 'الفواتير', tab: 'bills', icon: CheckCircle2 },
  { label: 'التقارير', tab: 'reports', icon: TrendingUp },
];

export default function CashierBottomNavigation({ activeTab, setActiveTab }) {
  return (
    <nav className={styles.container}>
      {CASHIER_NAV.map(item => {
        const IconComponent = item.icon;
        const isActive = activeTab === item.tab;

        return (
          <button
            key={item.tab}
            onClick={() => setActiveTab(item.tab)}
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
