import { useMemo } from 'react';
import { DepartmentOrderCard } from '../Orders/DepartmentOrderCard';
import { useOrders } from '../../hooks/useOrders';
import ConnectionStatus from '../Common/ConnectionStatus';
import { GlassWater } from 'lucide-react';

export function BarDashboard() {
  const { orders } = useOrders();
  
  // فلترة الطلبات: فقط التي لم تكتمل بعد
  const barOrders = useMemo(() => {
    return orders.filter(order => {
      const hasBarItems = (order.items || []).some(
        item => item.department === 'bar' && item.status !== 'completed' && item.status !== 'delivered' && item.status !== 'ready'
      );
      return hasBarItems && order.status !== 'completed';
    });
  }, [orders]);
  
  // ترتيب: الأحدث أولاً
  const sortedOrders = useMemo(() => {
    return [...barOrders].sort(
      (a, b) => (b.timestamp || b.createdAt || 0) - (a.timestamp || a.createdAt || 0)
    );
  }, [barOrders]);
  
  return (
    <div className="space-y-4 pb-6">
      {/* رأس الصفحة */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-primary" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <GlassWater size={24} style={{ color: 'var(--color-primary)' }} />
          البار
        </h2>
        <div className="dept-header-badge">
          {barOrders.length} طلب
        </div>
        <ConnectionStatus />
      </div>
      
      {/* قائمة الطلبات */}
      {sortedOrders.length === 0 ? (
        <div className="dept-empty-banner">
          <p className="main-text">لا توجد طلبات معلقة</p>
          <p className="sub-text">انتظر الطلبات الجديدة...</p>
        </div>
      ) : (
        sortedOrders.map(order => (
          <DepartmentOrderCard
            key={order.id}
            order={order}
            department="bar"
          />
        ))
      )}
    </div>
  );
}

export default BarDashboard;
