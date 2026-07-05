import { useState, useEffect } from 'react';
import {
  getTables, getEmployees, getMenu, getBills, getDepartments, getDeptOrders, getArchives
} from '../utils/storage';
import { 
  LayoutDashboard, 
  Building2, 
  UtensilsCrossed, 
  Armchair, 
  Users, 
  ShieldCheck, 
  TrendingUp, 
  Receipt,
  Archive,
  LogOut
} from 'lucide-react';


// Import Tabs
import DashboardTab from './Admin/DashboardTab';
import DepartmentsTab from './Admin/DepartmentsTab';
import MenuTab from './Admin/MenuTab';
import TablesTab from './Admin/TablesTab';
import StaffTab from './Admin/StaffTab';
import PermissionsTab from './Admin/PermissionsTab';
import ReportsTab from './Admin/ReportsTab';
import BillsTab from './Admin/BillsTab';
import ArchivesTab from './Admin/ArchivesTab';


export default function AdminDashboard({ user, onLogout, sidebarOpen, setSidebarOpen, activeTab, setActiveTab }) {
  const [tables, setTables] = useState(getTables());
  const [employees, setEmployees] = useState(getEmployees());
  const [menuItems, setMenuItems] = useState(getMenu());
  const [bills, setBills] = useState(getBills());
  const [departments, setDepartments] = useState(getDepartments());
  const [deptOrders, setDeptOrders] = useState(getDeptOrders());
  const [archives, setArchives] = useState(getArchives());


  // Refresh on sync
  useEffect(() => {
    const sync = () => {
      setTables(getTables());
      setEmployees(getEmployees());
      setMenuItems(getMenu());
      setBills(getBills());
      setDepartments(getDepartments());
      setDeptOrders(getDeptOrders());
      setArchives(getArchives());
    };
    window.addEventListener('taka_sync', sync);
    window.addEventListener('takah_sync', sync);
    return () => { window.removeEventListener('taka_sync', sync); window.removeEventListener('takah_sync', sync); };

  }, []);

  const TABS = [
    { id: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
    { id: 'departments', label: 'الأقسام', icon: Building2 },
    { id: 'menu', label: 'المنيو', icon: UtensilsCrossed },
    { id: 'tables', label: 'الطاولة', icon: Armchair },
    { id: 'staff', label: 'الموظفون', icon: Users },
    { id: 'permissions', label: 'الصلاحيات', icon: ShieldCheck },
    { id: 'reports', label: 'التقارير', icon: TrendingUp },
    { id: 'bills', label: 'الفواتير', icon: Receipt },
    { id: 'archives', label: 'أرشيف الفواتير', icon: Archive },
  ];


  const occupied = tables.filter(t => t.status !== 'empty').length;
  const todayRevenue = bills.reduce((s, b) => s + (b.total || 0), 0);
  const activeOrders = Object.keys(deptOrders).length;
  const activeStaff = employees.filter(e => e.active && e.role !== 'manager').length;

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 65px)', width: '100%', position: 'relative' }}>
      {/* Sidebar Backdrop overlay on mobile */}
      {sidebarOpen && (
        <div className="admin-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div style={{ padding: '20px', fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>تـكـة • الإدارة</div>
        <nav>
          {TABS.map(tab => {
            const IconComponent = tab.icon;
            return (
              <button key={tab.id} className={`sidebar-item ${activeTab === tab.id ? 'active' : ''}`} onClick={() => { setActiveTab(tab.id); setSidebarOpen(false); }}>
                <IconComponent size={18} /> <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
        <button
          className="sidebar-item"
          style={{ marginTop: 'auto', color: '#dc2626' }}
          onClick={() => { setSidebarOpen(false); onLogout(); }}
          title="تسجيل خروج"
        >
          <LogOut size={18} />
          <span> تسجيل خروج</span>
        </button>
      </aside>

      {/* Main content */}
      <main className="admin-main">
        {activeTab === 'dashboard' && <DashboardTab tables={tables} bills={bills} occupied={occupied} todayRevenue={todayRevenue} activeOrders={activeOrders} activeStaff={activeStaff} menuItems={menuItems} />}
        {activeTab === 'departments' && <DepartmentsTab departments={departments} setDepartments={setDepartments} employees={employees} deptOrders={deptOrders} />}
        {activeTab === 'menu' && <MenuTab menuItems={menuItems} setMenuItems={setMenuItems} departments={departments} />}
        {activeTab === 'tables' && <TablesTab tables={tables} setTables={setTables} />}
        {activeTab === 'staff' && <StaffTab employees={employees} setEmployees={setEmployees} />}
        {activeTab === 'permissions' && <PermissionsTab />}
        {activeTab === 'reports' && <ReportsTab bills={bills} menuItems={menuItems} tables={tables} />}
        {activeTab === 'bills' && <BillsTab bills={bills} menuItems={menuItems} />}
        {activeTab === 'archives' && <ArchivesTab archives={archives} />}
      </main>

    </div>
  );
}
