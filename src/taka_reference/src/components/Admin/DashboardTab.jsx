import React from 'react';
import StatCard from './StatCard';
import { STATUS_COLORS, STATUS_LABELS } from './constants';
import { 
  LayoutDashboard, 
  Armchair, 
  ClipboardList, 
  Coins, 
  Flame, 
  TrendingUp, 
  Receipt 
} from 'lucide-react';

export default function DashboardTab({ tables, bills, occupied, activeOrders, activeStaff, menuItems }) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

  const todayBills = bills.filter(b => b.timestamp >= startOfToday);
  const weekBills = bills.filter(b => b.timestamp >= startOfWeek.getTime());

  const todayRevenue = todayBills.reduce((s, b) => s + (b.total || b.subtotal || 0), 0);

  const itemSales = weekBills.reduce((acc, b) => {
    (b.items || []).forEach(item => { acc[item.id] = (acc[item.id] || 0) + (item.qty || 0); });
    return acc;
  }, {});
  const topItem = Object.entries(itemSales).sort((a, b) => b[1] - a[1])[0];
  const topItemName = topItem ? (menuItems.find(m => m.id === topItem[0])?.name || topItem[0]) : 'لا يوجد';
  const recentBills = [...bills].reverse().slice(0, 5);

  return (
    <div>
      <h2 className="tab-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <LayoutDashboard size={24} style={{ color: 'var(--color-primary)' }} />
        لوحة التحكم الرئيسية
      </h2>

      <div className="stats-grid-4">
        <StatCard icon={<Armchair size={32} />} label="الطاولات المشغولة" value={`${occupied} / ${tables.length}`} color="var(--color-primary)" />
        <StatCard icon={<ClipboardList size={32} />} label="الطلبات النشطة" value={activeOrders} color="#ea580c" />
        <StatCard icon={<Coins size={32} />} label="إيرادات اليوم" value={`${todayRevenue.toFixed(2)} ₪`} color="#16a34a" />
        <StatCard icon={<Flame size={32} />} label="الأكثر طلباً (أسبوع)" value={topItemName} color="#8b5cf6" />
      </div>

      <div className="responsive-grid-2" style={{ marginTop: '24px' }}>
        {/* Tables Status */}
        <div className="admin-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <Armchair size={20} style={{ color: 'var(--color-primary)' }} />
              حالة الطاولات
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700 }}>{tables.length} طاولة</span>
          </div>
          <div className="dashboard-tables-scroll" aria-label="حالة جميع الطاولات">
            <div className="responsive-grid-5 dashboard-tables-grid">
              {tables.map(t => (
                <div key={t.id} className="dashboard-table-cell" style={{
                  background: `${STATUS_COLORS[t.status] || '#555'}12`,
                  border: `1px solid ${STATUS_COLORS[t.status] || '#555'}33`
                }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem', fontFamily: 'Outfit, sans-serif', color: 'var(--text-main)' }}>{t.id}</div>
                  <div style={{ fontSize: '0.65rem', color: STATUS_COLORS[t.status], marginTop: '2px', fontWeight: 600 }}>
                    {STATUS_LABELS[t.status] || t.status}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Bills */}
        <div className="admin-card">
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Receipt size={20} style={{ color: 'var(--color-primary)' }} />
            آخر الفواتير
          </h3>
          {recentBills.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '12px' }}>لا توجد فواتير بعد</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
              {recentBills.map(b => (
                <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-surface-2)', border: '1px solid var(--border-light)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{b.tableName}</span>
                  <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, color: '#16a34a' }}>{(b.total || 0).toFixed(2)} ₪</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div className="admin-card" style={{ marginTop: '20px' }}>
        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TrendingUp size={20} style={{ color: 'var(--color-primary)' }} />
          ملخص إحصائي
        </h3>
        <div className="responsive-grid-3" style={{ marginTop: '12px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-primary)', fontFamily: 'Outfit, sans-serif' }}>{bills.length}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>إجمالي الفواتير</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#16a34a', fontFamily: 'Outfit, sans-serif' }}>
              {bills.length > 0 ? (todayRevenue / bills.length).toFixed(1) : '0'} ₪
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>متوسط الفاتورة</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#2563eb' }}>{topItemName}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>الأكثر طلباً</div>
          </div>
        </div>
      </div>
    </div>
  );
}
