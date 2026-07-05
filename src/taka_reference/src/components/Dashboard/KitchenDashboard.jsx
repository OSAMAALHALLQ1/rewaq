import { useMemo } from 'react';
import { DepartmentOrderCard } from '../Orders/DepartmentOrderCard';
import { useOrders } from '../../hooks/useOrders';
import ConnectionStatus from '../Common/ConnectionStatus';
import { ChefHat } from 'lucide-react';

export function KitchenDashboard() {
  const { orders } = useOrders();
  
  // فلترة الطلبات: فقط التي لم تكتمل بعد
  const kitchenOrders = useMemo(() => {
    return orders.filter(order => {
      const hasKitchenItems = (order.items || []).some(
        item => item.department === 'kitchen' && item.status !== 'completed' && item.status !== 'delivered' && item.status !== 'ready'
      );
      return hasKitchenItems && order.status !== 'completed';
    });
  }, [orders]);
  
  // ترتيب: الأحدث أولاً
  const sortedOrders = useMemo(() => {
    return [...kitchenOrders].sort(
      (a, b) => (b.timestamp || b.createdAt || 0) - (a.timestamp || a.createdAt || 0)
    );
  }, [kitchenOrders]);
  
  return (
    <div className="space-y-4 pb-6">
      {/* رأس الصفحة */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-primary" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ChefHat size={24} style={{ color: 'var(--color-primary)' }} />
          المطبخ
        </h2>
        <div className="dept-header-badge">
          {kitchenOrders.length} طلب
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
            department="kitchen"
          />
        ))
      )}
    </div>
  );
}

export default KitchenDashboard;
