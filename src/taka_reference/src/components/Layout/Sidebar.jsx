// src/components/Layout/Sidebar.jsx
import React from 'react';
import { 
  LayoutDashboard, 
  Building2, 
  UtensilsCrossed, 
  Armchair, 
  Users, 
  KeyRound, 
  ShieldCheck, 
  TrendingUp, 
  Receipt,
  LogOut
} from 'lucide-react';

export default function Sidebar({ sidebarOpen, setSidebarOpen, activeTab, setActiveTab, user, onLogout }) {
  // Close drawer when clicking outside on mobile
  const handleOverlayClick = () => setSidebarOpen(false);

  const TABS = [
    { id: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
    { id: 'departments', label: 'الأقسام', icon: Building2 },
    { id: 'menu', label: 'المنيو', icon: UtensilsCrossed },
    { id: 'tables', label: 'الطاولات', icon: Armchair },
    { id: 'staff', label: 'الموظفون', icon: Users },
    { id: 'permissions', label: 'الصلاحيات', icon: ShieldCheck },
    { id: 'reports', label: 'التقارير', icon: TrendingUp },
    { id: 'bills', label: 'الفواتير', icon: Receipt },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 md:hidden z-30"
          onClick={handleOverlayClick}
        />
      )}
      {/* Sidebar container */}
      <aside
        className={`fixed top-0 left-0 h-full bg-white shadow-lg z-40 transition-transform duration-300 md:relative md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 w-64 md:w-60`}
      >
        {/* Close button visible on mobile */}
        <button
          className="md:hidden absolute top-4 right-4 text-xl"
          onClick={() => setSidebarOpen(false)}
          aria-label="إغلاق القائمة"
        >
          ✕
        </button>
        {/* User avatar */}
        <div className="flex items-center gap-3 p-4 border-b border-gray-200">
          <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-white">{user.name?.charAt(0) || 'م'}</div>
          <div>
            <div className="font-bold">{user.name}</div>
            <div className="text-sm text-gray-500">{user.role === 'manager' ? 'ADMIN' : user.role}</div>
          </div>
        </div>
        {/* Navigation items */}
        <nav className="p-4 space-y-2">
          {TABS.map(tab => {
            const IconComponent = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                className={`flex items-center w-full px-3 py-2 rounded gap-2 ${isActive ? 'bg-primary text-white' : 'hover:bg-gray-100'}`}
                onClick={() => { setActiveTab(tab.id); setSidebarOpen(false); }}
                style={{ border: 'none', cursor: 'pointer', textAlign: 'right' }}
              >
                <IconComponent size={18} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
        <button
          className="w-full flex items-center justify-center py-2 mt-4 bg-red-500 text-white rounded gap-2"
          onClick={() => { setSidebarOpen(false); onLogout && onLogout(); }}
          style={{ border: 'none', cursor: 'pointer' }}
        >
          <LogOut size={16} />
          <span>خروج</span>
        </button>
      </aside>
    </>
  );
}
