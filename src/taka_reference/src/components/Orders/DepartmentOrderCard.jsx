import { useCallback, useState, useEffect } from 'react';
import { OptimizedButton } from '../Common/OptimizedButton';
import { useOrders } from '../../hooks/useOrders';
import { useNotifications } from '../../hooks/useNotifications';
import { ChefHat, GlassWater, Wind, Check, Clock, FileText } from 'lucide-react';

export function DepartmentOrderCard({ order, department }) {
  const { updateOrderStatus, loading } = useOrders();
  const { addNotification } = useNotifications();
  const isReady = order.status === 'ready' || 
    (order.items || [])
      .filter(i => i.department === department)
      .every(i => i.status === 'ready');
  const [now, setNow] = useState(Date.now());

  // Update elapsed time every second
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  
  // وقت الانتظار المنقضي
  const orderTime = order.timestamp || order.createdAt || now;
  const elapsedTime = Math.max(0, Math.floor((now - orderTime) / 1000));
  const minutes = Math.floor(elapsedTime / 60);
  const seconds = elapsedTime % 60;
  
  const handleMarkReady = useCallback(async () => {
    try {
      const success = await updateOrderStatus(order.id, 'ready', undefined, department);
      if (success) {
        const deptLabel = department === 'kitchen' ? 'المطبخ' : department === 'bar' ? 'البار' : 'الشيشة';
        addNotification(
          `طلب الطاولة #${order.tableName || order.tableId || order.tableNumber} جاهز!`,
          `قسم ${deptLabel} جهّز الأصناف المطلوبة`,
          'success',
          ['waiter', order.waiterCode]
        );
      }
    } catch (error) {
      addNotification('حدث خطأ في تحديث الطلب', 'error');
    }
  }, [order.id, order.tableName, order.tableId, order.tableNumber, order.waiterCode, department, updateOrderStatus, addNotification]);
  
  const isProcessing = loading[order.id];
  
  return (
    <div className={`department-order-card dept-${department}`}>
      {/* رأس البطاقة */}
      <div className="card-header">
        <div>
          <h3 className="card-table-title">
            الطاولة #{order.tableName || order.tableNumber || order.tableId}
          </h3>
          <div className="card-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {department === 'kitchen' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><ChefHat size={14} /> المطبخ</span>}
            {department === 'bar' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><GlassWater size={14} /> البار</span>}
            {department === 'shisha' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Wind size={14} /> الشيشة</span>}
          </div>
        </div>
        
        {/* حالة الطلب */}
        <span className={`card-status-badge ${isReady ? 'status-ready' : 'status-pending'}`}>
          {isReady ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Check size={12} /> جاهز</span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> جديد</span>
          )}
        </span>
      </div>
      
      {/* الأصناف */}
      <div className="card-items-list">
        {(order.items || [])
          .filter(item => item.department === department)
          .map(item => (
            <div key={item.id} style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
              <div className="card-item-row" style={{ padding: '4px 0 2px 0' }}>
                <span className="card-item-name">{item.name}</span>
                <div className="card-item-qty-wrapper">
                  <span className="card-item-qty">× {item.qty || item.quantity}</span>
                </div>
              </div>
              {item.changedFrom && (
                <span style={{ fontSize: '0.78rem', color: '#dc2626', fontWeight: 'bold', background: '#fef2f2', padding: '2px 8px', borderRadius: '4px', marginTop: '2px', border: '1px solid #fee2e2', display: 'inline-block', width: 'fit-content' }}>
                  ⚠️ تم تغيير الصنف بدلاً من: {item.changedFrom}
                </span>
              )}
            </div>
          ))}
      </div>
      
      {/* الوقت المنقضي */}
      <div className="card-wait-time" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p className="wait-time-label" style={{ display: 'flex', alignItems: 'center', gap: '4px', margin: 0 }}>
          <Clock size={14} />
          <span>وقت الانتظار:</span>
        </p>
        <p className="wait-time-value" style={{ margin: 0 }}>
          {minutes}:{seconds.toString().padStart(2, '0')} دقيقة
        </p>
      </div>
      
      {/* الزر - الخيار الوحيد */}
      {!isReady ? (
        <OptimizedButton
          onClick={handleMarkReady}
          loading={isProcessing}
          className="btn btn-primary"
          style={{ width: '100%', background: '#27ae60', color: '#fff', border: 'none', cursor: 'pointer', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px 0' }}
        >
          <Check size={16} /> جاهز للتسليم
        </OptimizedButton>
      ) : (
        <div className="status-complete-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <Check size={14} /> تم التسليم للجرسون
        </div>
      )}
      
      {/* ملاحظات (إذا وجدت) */}
      {(order.notes || order.note) && (
        <div className="card-notes-banner" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <FileText size={14} />
          <span>ملاحظات: {order.notes || order.note}</span>
        </div>
      )}
    </div>
  );
}

export default DepartmentOrderCard;
