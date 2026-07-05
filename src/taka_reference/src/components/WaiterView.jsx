import { useState, useEffect, useCallback, useRef } from 'react';
import {
  saveDeptOrders, getDeptOrders, addNotification, updateDeptOrderItem,
  updateOngoingItemQty, cancelOngoingItem, modifyOngoingItem,
  submitOrderAtomic,
  TAX_RATE, SERVICE_RATE
} from '../utils/storage';
import { createOrderId } from '../utils/ids';
import { 
  LayoutGrid, 
  ChefHat, 
  CupSoda, 
  Wind, 
  Search, 
  ShoppingCart, 
  Clock, 
  Notebook, 
  Trash2, 
  Edit,
  CheckCircle2, 
  Timer, 
  Package, 
  Receipt, 
  Bell, 
  Sparkles, 
  Users,
  Check,
  ArrowRight,
  ClipboardList
} from 'lucide-react';

const DEPT_TABS = [
  { id: 'all', label: 'الكل', icon: LayoutGrid },
  { id: 'kitchen', label: 'مطبخ', icon: ChefHat },
  { id: 'bar', label: 'بار', icon: CupSoda },
  { id: 'shisha', label: 'شيشة', icon: Wind }
];

const STATUS_COLORS = { empty: '#10b981', eating: '#dc2626', bill_requested: '#d97706', unavailable: '#71717a' };
const STATUS_LABELS_AR = { empty: 'فاضية', eating: 'مشغولة', bill_requested: 'تنتظر دفع', unavailable: 'غير متوفرة' };
const STATUS_BADGE = { empty: 'badge-empty', eating: 'badge-eating', bill_requested: 'badge-bill-requested', unavailable: 'badge-unavailable' };

const renderItemImage = (image, name, isCard = false) => {
  const isUrl = image && (image.startsWith('http') || image.startsWith('data:image/'));
  
  if (isUrl) {
    return (
      <img 
        src={image} 
        alt={name} 
        loading="lazy"
        decoding="async"
        width={isCard ? 400 : 40}
        height={isCard ? 300 : 40}
        onError={(e) => {
          e.currentTarget.style.display = 'none';
          e.currentTarget.onerror = null;
        }}
        style={isCard ? { 
          width: '100%', 
          height: '90px', 
          objectFit: 'cover', 
          borderRadius: '6px', 
          marginBottom: '6px', 
          display: 'block' 
        } : { 
          width: '40px', 
          height: '40px', 
          objectFit: 'cover', 
          borderRadius: '6px', 
          display: 'block',
          flexShrink: 0
        }} 
      />
    );
  }

  return (
    <div 
      style={isCard ? {
        width: '100%',
        height: '90px',
        borderRadius: '6px',
        marginBottom: '6px',
        background: 'linear-gradient(135deg, var(--color-primary-glow) 0%, transparent 100%)',
        border: '1px dashed color-mix(in srgb, var(--color-primary) 20%, transparent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-primary)'
      } : {
        width: '40px',
        height: '40px',
        borderRadius: '6px',
        background: 'linear-gradient(135deg, var(--color-primary-glow) 0%, transparent 100%)',
        border: '1px dashed color-mix(in srgb, var(--color-primary) 20%, transparent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-primary)',
        flexShrink: 0
      }}
    >
      <svg width={isCard ? 24 : 16} height={isCard ? 24 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    </div>
  );
};

function WaiterOrders({ employee, deptOrders, onDeliverItem }) {
  const waiterOrders = Object.entries(deptOrders).filter(([, order]) =>
    order.waiterCode === employee.code
  );

  if (waiterOrders.length === 0) {
    return (
      <div className="view-container" style={{ textAlign: 'center', paddingTop: '80px' }}>
        <ClipboardList size={56} style={{ color: 'var(--text-light)', marginBottom: '16px' }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>لا توجد طلبات نشطة</p>
      </div>
    );
  }

  return (
    <div className="view-container">
      <h3 style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <ClipboardList size={20} style={{ color: 'var(--color-primary)' }} />
        طلباتي ({waiterOrders.length})
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {waiterOrders.map(([orderId, order]) => {
          const pending = (order.items || []).filter(i => i.status === 'new' || i.status === 'preparing');
          const ready = (order.items || []).filter(i => i.status === 'ready');
          return (
            <div key={orderId} className="glass-card" style={{ padding: '16px', borderRight: `4px solid ${ready.length > 0 ? '#10b981' : '#d97706'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <strong style={{ fontSize: '1rem' }}>الطاولة #{order.tableId}</strong>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {new Date(order.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {pending.length > 0 && (
                <div style={{ fontSize: '0.85rem', color: '#d97706', marginBottom: '4px' }}>
                  ⏳ {pending.length} قيد التحضير
                </div>
              )}
              {ready.map((item) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                  <span style={{ fontSize: '0.88rem' }}>{item.name} × {item.qty}</span>
                  <button
                    className="deliver-btn"
                    onClick={() => onDeliverItem(orderId, item.id)}
                    style={{ padding: '8px 16px', fontSize: '0.82rem' }}
                  >
                    تسليم ✓
                  </button>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WaiterProfile({ employee }) {
  return (
    <div className="view-container" style={{ paddingTop: '40px' }}>
      <div className="glass-card" style={{ padding: '32px', textAlign: 'center' }}>
        <div style={{
          width: '80px', height: '80px', borderRadius: '50%',
          background: 'var(--color-primary-glow)',
          border: '3px solid var(--color-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px', fontSize: '2rem', fontWeight: 800,
          color: 'var(--color-primary)'
        }}>
          {employee.name?.charAt(0) || '?'}
        </div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '4px' }}>{employee.name}</h2>
        <p style={{ color: 'var(--color-role-accent)', fontWeight: 700, fontSize: '0.9rem', marginBottom: '16px' }}>
          #{employee.code} • جرسون
        </p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <div style={{ padding: '12px 20px', background: 'var(--bg-surface-2)', borderRadius: '12px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.3rem' }}>{employee.id?.slice(0, 8) || '—'}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>المعرف</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WaiterView({ tables, onSaveTables, employee, menuItems = [], activeTab = 'tables' }) {
  const [now, setNow] = useState(() => Date.now());
  const [view, setView] = useState('tables');
  const [selectedTable, setSelectedTable] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [guestsCount, setGuestsCount] = useState(2);
  const [tableNotes, setTableNotes] = useState('');
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [isSendingOrder, setIsSendingOrder] = useState(false);
  const [billConfirmOpen, setBillConfirmOpen] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [deptOrders, setDeptOrders] = useState(getDeptOrders());
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshingPTR, setRefreshingPTR] = useState(false);
  const startYRef = useRef(0);
  const pullingRef = useRef(false);
  const tablesContainerRef = useRef(null);

  const [waiterActiveTab, setWaiterActiveTab] = useState(activeTab);
  const [expandedId, setExpandedId] = useState(null);

  const [editingItem, setEditingItem] = useState(null);
  const [selectedReplacement, setSelectedReplacement] = useState(null);
  const [editQty, setEditQty] = useState(1);
  const [editNote, setEditNote] = useState('');
  const [editSearch, setEditSearch] = useState('');
  const [editCategory, setEditCategory] = useState('all');

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (activeTab === 'tables' || activeTab === 'orders' || activeTab === 'profile') {
      setWaiterActiveTab(activeTab);
    }
  }, [activeTab]);

  const handleWaiterDeliverItem = async (orderId, itemId) => {
    const success = await updateDeptOrderItem(orderId, itemId, { status: 'delivered' });
    if (success) {
      window.dispatchEvent(new CustomEvent('taka_sync'));
    }
  };

  const handleEditItemClick = (item) => {
    setEditingItem(item);
    const menuMatch = menuItems.find(m => m.id === item.id);
    setSelectedReplacement(menuMatch || null);
    setEditQty(item.qty || 1);
    setEditNote(item.note || '');
    setEditSearch('');
    setEditCategory('all');
  };

  const handleConfirmEdit = async () => {
    if (!editingItem || !selectedReplacement) return;
    const result = await modifyOngoingItem(
      selectedTable.id,
      editingItem.orderId,
      editingItem.id,
      selectedReplacement,
      editQty,
      editNote
    );
    if (result && result.success) {
      addNotification(
        `تعديل طلب الطاولة #${selectedTable.id}`,
        `تم تغيير الصنف من ${result.oldItemName} إلى ${selectedReplacement.nameAr || selectedReplacement.name} × ${editQty}`,
        'warning',
        [selectedReplacement.department, employee.code, 'manager']
      );
      setEditingItem(null);
      setSelectedReplacement(null);
      window.dispatchEvent(new CustomEvent('taka_sync'));
    }
  };

  const handleRefresh = useCallback(() => {
    window.dispatchEvent(new Event('taka_sync'));
  }, []);

  useEffect(() => {
    const el = tablesContainerRef.current?.parentElement;
    if (!el) return;
    const onTouchStart = (e) => {
      if (refreshingPTR) return;
      if (el.scrollTop > 5) return;
      startYRef.current = e.touches[0].clientY;
      pullingRef.current = true;
    };
    const onTouchMove = (e) => {
      if (!pullingRef.current || refreshingPTR) return;
      const diff = e.touches[0].clientY - startYRef.current;
      if (diff <= 0) { setPullDistance(0); return; }
      setPullDistance(Math.min(diff * 0.5, 120));
    };
    const onTouchEnd = () => {
      if (!pullingRef.current || refreshingPTR) return;
      pullingRef.current = false;
      if (pullDistance >= 80) {
        setRefreshingPTR(true);
        setPullDistance(0);
        Promise.resolve().then(() => {
          handleRefresh();
          setTimeout(() => setRefreshingPTR(false), 800);
        });
      } else {
        setPullDistance(0);
      }
    };
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [refreshingPTR, pullDistance, handleRefresh]);

  useEffect(() => {
    const sync = () => setDeptOrders(getDeptOrders());
    window.addEventListener('taka_sync', sync);
    window.addEventListener('takah_sync', sync);
    return () => { window.removeEventListener('taka_sync', sync); window.removeEventListener('takah_sync', sync); };
  }, []);

  const filteredMenu = menuItems.filter(item => {
    if (!item.available) return false;
    const matchDept = activeCategory === 'all' || item.department === activeCategory;
    const matchSearch = !search || item.name?.includes(search) || item.nameAr?.includes(search);
    return matchDept && matchSearch;
  });

  const addToCart = (item) => {
    setCart(prev => {
      const ex = prev.find(i => i.id === item.id);
      if (ex) return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...item, qty: 1, note: '' }];
    });
  };

  const removeFromCart = (itemId) => {
    setCart(prev => {
      const ex = prev.find(i => i.id === itemId);
      if (ex?.qty === 1) return prev.filter(i => i.id !== itemId);
      return prev.map(i => i.id === itemId ? { ...i, qty: i.qty - 1 } : i);
    });
  };

  const increaseCart = (itemId) => setCart(prev => prev.map(i => i.id === itemId ? { ...i, qty: i.qty + 1 } : i));
  const updateNote = (itemId, note) => setCart(prev => prev.map(i => i.id === itemId ? { ...i, note } : i));

  const calcTotals = useCallback(() => {
    const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const tax = subtotal * TAX_RATE;
    const serviceCharge = subtotal * SERVICE_RATE;
    const total = subtotal + tax + serviceCharge;
    return { subtotal, tax, serviceCharge, total };
  }, [cart]);

  if (waiterActiveTab === 'orders') {
    return <WaiterOrders employee={employee} deptOrders={deptOrders} onDeliverItem={handleWaiterDeliverItem} />;
  }
  if (waiterActiveTab === 'profile') {
    return <WaiterProfile employee={employee} />;
  }

  const openTable = (table) => {
    setSelectedTable(table);
    setCart(table.currentOrder?.map(i => ({ ...i })) || []);
    setTableNotes(table.notes || '');
    setGuestsCount(table.guests || 2);
    if (table.status === 'empty') {
      setView('new-order');
    } else {
      setView('manage');
    }
  };

  const handleSendOrder = async () => {
    if (cart.length === 0 || isSendingOrder) return;
    setIsSendingOrder(true);
    const { subtotal, tax, serviceCharge, total } = calcTotals();
    const nowTs = Date.now();
    const orderId = createOrderId();
    const itemsWithStatus = cart.map(item => ({ ...item, orderId, status: 'new', orderedAt: nowTs }));

    const newOrder = {
      id: orderId, tableId: selectedTable.id, tableName: selectedTable.name,
      waiterCode: employee.code, waiterName: employee.name,
      timestamp: nowTs, items: itemsWithStatus,
      subtotal, tax, serviceCharge, total, status: 'new'
    };

    try {
      let syncedByDatabase = false;
      try {
        await submitOrderAtomic({ order: newOrder, notes: tableNotes, guests: guestsCount });
        syncedByDatabase = true;
      } catch (rpcErr) {
        console.warn('Atomic order submit unavailable, falling back to queued sync:', rpcErr);
      }

      const existing = getDeptOrders();
      existing[orderId] = newOrder;
      await saveDeptOrders(existing, orderId, { sync: !syncedByDatabase });

      const updatedTables = tables.map(t => {
        if (t.id !== selectedTable.id) return t;
        const existingItems = t.currentOrder || [];
        const combined = [...existingItems, ...itemsWithStatus];
        const newSubtotal = combined.reduce((s, i) => s + i.price * i.qty, 0);
        const newTax = newSubtotal * TAX_RATE;
        const newServiceCharge = newSubtotal * SERVICE_RATE;
        return { ...t, status: 'eating', currentOrder: combined, notes: tableNotes, subtotal: newSubtotal, tax: newTax, serviceCharge: newServiceCharge, total: newSubtotal + newTax + newServiceCharge, waiterCode: employee.code, guests: guestsCount, seatedAt: t.seatedAt || nowTs };
      });
      await onSaveTables(updatedTables, { sync: !syncedByDatabase, changedItemOrId: selectedTable.id });

      const deptsInvolved = [...new Set(itemsWithStatus.map(i => i.department))];

      deptsInvolved.forEach(dept => {
        const deptItems = itemsWithStatus.filter(i => i.department === dept);
        const itemsStr = deptItems.map(i => `${i.name} × ${i.qty}`).join('، ');
        addNotification(
          `طلب جديد من الطاولة #${selectedTable.id}`,
          `${itemsStr}`,
          'success',
          [dept, employee.code, 'manager']
        );
      });

      setOrderSuccess(true);
      setTimeout(() => { setOrderSuccess(false); setView('tables'); setCart([]); }, 2000);
    } finally {
      setIsSendingOrder(false);
    }
  };

  const handleRequestBill = () => {
    const updatedTables = tables.map(t => t.id === selectedTable.id ? { ...t, status: 'bill_requested' } : t);
    onSaveTables(updatedTables);
    
    // Check if all items are already ready/delivered
    const tableOrders = Object.values(deptOrders).filter(o => o.tableId === selectedTable.id);
    const allItems = tableOrders.flatMap(o => o.items || []);
    const allReady = allItems.length > 0 && allItems.every(i => ['ready', 'delivered'].includes(i.status));
    
    if (allReady) {
      addNotification(
        `فاتورة الطاولة #${selectedTable.id} مكتملة - انتظار الدفع`,
        `جميع الطلبات جاهزة، في انتظار تحصيل المبلغ: ${(selectedTable.total || 0).toFixed(2)} ₪`,
        'success',
        ['cashier', 'manager']
      );
    } else {
      addNotification(
        `طلب حساب جديد من الطاولة #${selectedTable.id}`,
        `${selectedTable.name} تطلب الحساب`,
        'warning',
        ['cashier', 'manager']
      );
    }
    
    setBillConfirmOpen(false);
    setView('tables');
  };

  const handleDeliverItem = async (orderId, itemId) => {
    const success = await updateDeptOrderItem(orderId, itemId, { status: 'delivered' });
    if (success) {
      window.dispatchEvent(new CustomEvent('taka_sync'));
    }
  };

  // Ready items for this waiter
  const readyItems = Object.entries(deptOrders).flatMap(([orderId, order]) =>
    (order.items || []).filter(item => item.status === 'ready').map(item => ({ ...item, orderId, tableName: order.tableName }))
  );

  const getOrderIdForItem = (itemId) => {
    const orders = getDeptOrders();
    for (const [orderId, order] of Object.entries(orders)) {
      if (order.tableId === selectedTable?.id) {
        const match = (order.items || []).find(i => i.id === itemId && i.status === 'ready');
        if (match) return orderId;
      }
    }
    return null;
  };

  const tableCurrentOrder = selectedTable ? (tables.find(t => t.id === selectedTable.id)?.currentOrder || []) : [];
  const tableData = selectedTable ? tables.find(t => t.id === selectedTable.id) : null;

  const elapsedMin = tableData?.seatedAt ? Math.floor((now - tableData.seatedAt) / 60000) : 0;

  // ── VIEWS ──────────────────────────────────
  if (view === 'new-order' && selectedTable) {
    const { total } = calcTotals();
    return (
      <div className="view-container view-enter">
        {orderSuccess && (
          <div className="order-success-banner">تم إرسال الطلب للأقسام بنجاح!</div>
        )}

        <div className="order-header">
          <div>
            <button className="back-btn" onClick={() => { setView('tables'); setCart([]); }} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <ArrowRight size={16} /> عودة
            </button>
            <span className="order-table-num" style={{ marginRight: '16px' }}>الطاولة #{selectedTable.id}</span>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>عدد الأشخاص:</label>
            <select className="form-input" value={guestsCount} onChange={e => setGuestsCount(parseInt(e.target.value))} style={{ width: '80px' }}>
              {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>

        <div className="order-layout">
          {/* Left: Menu */}
          <div className="menu-col">
            {/* Dept Tabs */}
            <div className="dept-tabs">
              {DEPT_TABS.map(tab => {
                const IconComponent = tab.icon;
                return (
                  <button key={tab.id} className={`dept-tab ${activeCategory === tab.id ? 'active' : ''}`} onClick={() => setActiveCategory(tab.id)}>
                    <IconComponent size={16} /> <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
            {/* Search */}
            <div style={{ position: 'relative', marginBottom: '12px' }}>
              <input className="form-input" placeholder="بحث..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingRight: '40px' }} />
              <Search size={18} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
            {/* Items */}
            <div className="menu-items-grid">
              {filteredMenu.map(item => {
                const inCart = cart.find(c => c.id === item.id);
                return (
                  <div key={item.id} className={`menu-item-card ${inCart ? 'in-cart' : ''}`} onClick={() => addToCart(item)}>
                    {renderItemImage(item.image, item.nameAr || item.name, true)}
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', lineHeight: 1.3 }}>{item.name || item.nameAr}</div>
                    {item.description && (
                      <>
                        <p className={`item-desc ${expandedId === item.id ? '' : 'text-clamp-2'}`}>
                          {item.description}
                        </p>
                        {item.description.length > 80 && (
                          <span
                            className={`read-more-btn ${expandedId === item.id ? 'expanded' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedId(expandedId === item.id ? null : item.id);
                            }}
                          >
                            {expandedId === item.id ? 'عرض أقل' : 'قراءة المزيد'}
                          </span>
                        )}
                      </>
                    )}
                    <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, color: 'var(--color-primary)', marginTop: '8px' }}>{item.price} ₪</div>
                    {inCart && <div className="cart-badge">+{inCart.qty}</div>}
                  </div>
                );
              })}
              {filteredMenu.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>لا توجد أصناف</div>}
            </div>
          </div>

          {/* Right: Cart - hidden on mobile, shown on desktop */}
          <div className="cart-col desktop-cart">
            <div className="cart-header-bar">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <ShoppingCart size={18} /> الطلب الحالي
              </span>
              <span className="cart-count">{cart.reduce((s, i) => s + i.qty, 0)} صنف</span>
            </div>

            <div className="cart-items-scroll">
              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <ShoppingCart size={48} style={{ color: 'var(--text-light)', marginBottom: '12px' }} />
                  <p style={{ fontSize: '0.85rem' }}>اختر أصنافاً من القائمة</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="cart-item-row">
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{item.name}</div>
                      <div style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--color-primary)', fontSize: '0.82rem' }}>{(item.price * item.qty).toFixed(2)} ₪</div>
                      <input
                        type="text"
                        className="note-input"
                        placeholder="ملاحظة (مثل: بدون بصل)"
                        value={item.note || ''}
                        onChange={e => updateNote(item.id, e.target.value)}
                      />
                    </div>
                    <div className="qty-controls">
                      <button className="qty-btn" onClick={() => removeFromCart(item.id)}>−</button>
                      <span className="qty-num">{item.qty}</span>
                      <button className="qty-btn" onClick={() => increaseCart(item.id)}>+</button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="cart-totals-section">
                <div className="total-row grand"><span>الإجمالي</span><span>{total.toFixed(2)} ₪</span></div>
              </div>
            )}

            <div style={{ padding: '12px', borderTop: '1px solid var(--border-light)' }}>
              <input
                className="form-input"
                placeholder="ملاحظة للطاولة..."
                value={tableNotes}
                onChange={e => setTableNotes(e.target.value)}
                style={{ marginBottom: '12px' }}
              />
              <button
                className="send-order-btn"
                onClick={handleSendOrder}
                disabled={cart.length === 0 || isSendingOrder}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <Check size={18} /> {isSendingOrder ? 'جاري الإرسال...' : 'أرسل الطلب للأقسام'}
              </button>
              <button className="back-btn" style={{ width: '100%', marginTop: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} onClick={() => { setView('tables'); setCart([]); }}>
                <ArrowRight size={16} /> عودة للطاولات
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Floating Cart Button */}
        <button
          className="mobile-cart-fab"
          onClick={() => setShowMobileCart(true)}
          style={{
            position: 'fixed',
            bottom: 'calc(80px + env(safe-area-inset-bottom))',
            left: '16px',
            zIndex: 100,
            background: 'var(--color-primary)',
            color: '#fff',
            border: 'none',
            borderRadius: '50%',
            width: '60px',
            height: '60px',
            display: 'none',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            cursor: 'pointer',
            transition: 'transform 0.2s ease',
          }}
          aria-label="عرض السلة"
        >
          <ShoppingCart size={24} />
          {cart.length > 0 && (
            <span style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              background: '#22c55e',
              color: '#fff',
              borderRadius: '50%',
              width: '22px',
              height: '22px',
              fontSize: '0.7rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'Outfit, sans-serif',
            }}>
              {cart.reduce((s, i) => s + i.qty, 0)}
            </span>
          )}
        </button>

        {/* Mobile Cart Bottom Sheet */}
        {showMobileCart && (
          <div className="bottom-sheet-overlay animate-fade-in" onClick={() => setShowMobileCart(false)}>
            <div className="bottom-sheet-drawer animate-slide-up" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
              <div className="bottom-sheet-handle" />
              <div className="bottom-sheet-header">
                <div className="bottom-sheet-title">
                  <ShoppingCart size={18} style={{ color: 'var(--color-primary)' }} />
                  <span>الطلب الحالي</span>
                </div>
                <button className="bottom-sheet-close" onClick={() => setShowMobileCart(false)}>×</button>
              </div>
              
              {/* Scrollable Items list container */}
              <div className="bottom-sheet-content" style={{ flex: 1, overflowY: 'auto' }}>
                {cart.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    اختر أصنافاً من القائمة
                  </div>
                ) : (
                  cart.map(item => (
                    <div key={item.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{item.name}</div>
                        <div style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--color-primary)', fontSize: '0.82rem' }}>{(item.price * item.qty).toFixed(2)} ₪</div>
                        <input type="text" className="note-input" placeholder="ملاحظة" value={item.note || ''} onChange={e => updateNote(item.id, e.target.value)} />
                      </div>
                      <div className="qty-controls">
                        <button className="qty-btn" onClick={() => removeFromCart(item.id)}>−</button>
                        <span className="qty-num">{item.qty}</span>
                        <button className="qty-btn" onClick={() => increaseCart(item.id)}>+</button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Fixed Footer pinned to the bottom of the drawer */}
              {cart.length > 0 && (
                <div className="bottom-sheet-footer">
                  <div className="total-row grand"><span>الإجمالي</span><span>{total.toFixed(2)} ₪</span></div>
                  <input className="form-input" placeholder="ملاحظة للطاولة..." value={tableNotes} onChange={e => setTableNotes(e.target.value)} style={{ marginTop: '8px', marginBottom: '8px' }} />
                  <button className="send-order-btn" onClick={async () => { await handleSendOrder(); setShowMobileCart(false); }} disabled={cart.length === 0 || isSendingOrder} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <Check size={18} /> {isSendingOrder ? 'جاري الإرسال...' : 'أرسل الطلب للأقسام'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (view === 'manage' && selectedTable && tableData) {
    const ongoingItems = tableCurrentOrder.filter(item => ['new', 'preparing'].includes(item.status));
    const readyItemsList = tableCurrentOrder.filter(item => item.status === 'ready');
    const deliveredItemsList = tableCurrentOrder.filter(item => item.status === 'delivered');

    return (
      <div className="view-container view-enter">
        <div className="order-header">
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <button className="back-btn" onClick={() => setView('tables')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <ArrowRight size={16} /> عودة
            </button>
            <div>
              <span className="order-table-num">الطاولة #{selectedTable.id}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginRight: '12px' }}>
                | {tableData.guests || 0} أشخاص | {elapsedMin} دقيقة
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn-add-more" onClick={() => { setCart([]); setView('new-order'); }}>+ إضافة طلب</button>
            {tableData.status !== 'bill_requested' && (
              <button className="btn-request-bill" onClick={() => setBillConfirmOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Receipt size={16} /> طلب الحساب
              </button>
            )}
          </div>
        </div>

        {/* Ready items alert */}
        {readyItems.filter(ri => {
          const order = Object.values(deptOrders).find(o => o.tableId === selectedTable.id);
          return order && ri.tableName === selectedTable.name;
        }).length > 0 && (
          <div className="ready-alert-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
              <Bell size={20} style={{ color: 'var(--color-primary)' }} />
              طلبات جاهزة للتسليم!
            </div>
            {readyItems.filter(ri => ri.tableName === selectedTable.name).map((ri, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                <span>{ri.name} × {ri.qty}</span>
                <button className="deliver-btn" onClick={() => handleDeliverItem(ri.orderId, ri.id)}>تسليم ✓</button>
              </div>
            ))}
          </div>
        )}

        {/* Current order items */}
        <div className="responsive-grid-2">
          <div className="admin-card">
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ClipboardList size={18} style={{ color: 'var(--color-primary)' }} />
              حالة الطلبات
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '12px' }}>
              {tableCurrentOrder.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>لا توجد طلبات لهذه الطاولة</p>
              ) : (
                <>
                  {/* الطلبات الجارية */}
                  <div>
                    <h4 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: '8px', color: '#d97706', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={16} /> الطلبات الجارية ({ongoingItems.length})
                    </h4>
                    {ongoingItems.length === 0 ? (
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '6px 12px' }}>لا توجد طلبات قيد التحضير</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {ongoingItems.map((item, i) => {
                          const statusText = item.status === 'preparing' ? 'يتحضر' : 'جديد';
                          const statusColor = item.status === 'preparing' ? '#d97706' : '#dc2626';
                          const statusBg = item.status === 'preparing' ? '#fffbeb' : '#fef2f2';

                          return (
                            <div key={i} style={{ padding: '12px', background: statusBg, borderRadius: '8px', borderRight: `3px solid ${statusColor}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#09090b' }}>{item.name} × {item.qty}</span>
                                {item.note && <div style={{ fontSize: '0.75rem', color: '#d97706', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}><Notebook size={12} /> {item.note}</div>}
                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginTop: '4px' }}>
                                  <button className="qty-btn" onClick={() => updateOngoingItemQty(selectedTable.id, item.orderId, item.id, Math.max(1, item.qty - 1))} disabled={item.qty <= 1}>−</button>
                                  <span>{item.qty}</span>
                                  <button className="qty-btn" onClick={() => updateOngoingItemQty(selectedTable.id, item.orderId, item.id, item.qty + 1)}>+</button>
                                  <button className="qty-btn" onClick={() => handleEditItemClick(item)} title="تعديل الصنف" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Edit size={12} /></button>
                                  <button className="qty-btn" onClick={() => cancelOngoingItem(selectedTable.id, item.orderId, item.id)} title="إلغاء الصنف" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={12} /></button>
                                </div>
                              </div>
                              <span style={{ fontSize: '0.78rem', color: statusColor, fontWeight: 700 }}>{statusText}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* الطلبات الجاهزة */}
                  <div>
                    <h4 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: '8px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle2 size={16} /> الطلبات الجاهزة للتسليم ({readyItemsList.length})
                    </h4>
                    {readyItemsList.length === 0 ? (
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '6px 12px' }}>لا توجد طلبات جاهزة</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {readyItemsList.map((item, i) => {
                          const readyDuration = item.readyAt ? Math.floor((now - item.readyAt) / 60000) : 0;
                          const ordId = getOrderIdForItem(item.id);
                          return (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#f0fdf4', borderRight: '3px solid #10b981', borderRadius: '8px' }}>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#09090b' }}>{item.name} × {item.qty}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Timer size={12} /> جاهز منذ: {readyDuration} دقائق
                                </div>
                              </div>
                              <button
                                className="deliver-btn"
                                onClick={() => ordId && handleDeliverItem(ordId, item.id)}
                                disabled={!ordId}
                                style={{ padding: '6px 12px', fontSize: '0.78rem', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700 }}
                              >
                                تسليم الجرسون
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* الطلبات المسلّمة */}
                  {deliveredItemsList.length > 0 && (
                    <div>
                      <h4 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Package size={16} /> الطلبات المسلمة ({deliveredItemsList.length})
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {deliveredItemsList.map((item, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-surface-2)', border: '1px solid var(--border-light)', borderRadius: '6px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            <span>{item.name} × {item.qty}</span>
                            <span>مسلم ✓</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="admin-card">
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Receipt size={18} style={{ color: 'var(--color-primary)' }} />
              الفاتورة الحالية
            </h3>
            <div style={{ marginTop: '12px' }}>
              <div className="total-row grand"><span>الإجمالي النهائي</span><span>{(tableData.total || 0).toFixed(2)} ₪</span></div>
            </div>

            {tableData.status === 'bill_requested' && (
              <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(243,156,18,0.05)', border: '1px solid rgba(243,156,18,0.2)', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ color: '#d97706', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <Receipt size={16} /> تم إرسال طلب الحساب للمحاسب
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>في انتظار المعالجة والتصفير</div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // MAIN TABLES VIEW
  return (
    <div className="view-container" ref={tablesContainerRef}>
      {/* Pull-to-refresh indicator */}
      {(pullDistance > 0 || refreshingPTR) && (
        <div
          style={{
            height: refreshingPTR ? '48px' : `${Math.min(pullDistance, 80)}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            transition: refreshingPTR ? 'height 0.3s ease' : 'none',
            color: 'var(--color-role-accent)',
            fontSize: '0.82rem',
            fontWeight: 600,
          }}
        >
          {refreshingPTR ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              جاري التحديث...
            </span>
          ) : pullDistance >= 80 ? (
            'أفلت للتحديث'
          ) : (
            'اسحب للتحديث'
          )}
        </div>
      )}

      {/* Ready items global bar */}
      {readyItems.length > 0 && (
        <div className="ready-alert-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
            <Bell size={18} /> طلبات جاهزة للتسليم! ({readyItems.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
            {readyItems.map((ri, i) => (
              <div key={i} style={{ display: 'inline-flex', gap: '8px', alignItems: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', padding: '4px 12px', borderRadius: '20px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{ri.tableName} – {ri.name} ×{ri.qty}</span>
                <button className="deliver-btn" onClick={() => handleDeliverItem(ri.orderId, ri.id)}>تسليم ✓</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            مرحباً، {employee.name}
            <Sparkles size={20} style={{ color: 'var(--color-primary)' }} />
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '4px' }}>اختر طاولة للبدء</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', fontSize: '0.82rem' }}>
          {Object.entries(STATUS_LABELS_AR).slice(0, 3).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: '5px', alignItems: 'center', fontWeight: 600 }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: STATUS_COLORS[k], display: 'inline-block' }} />
              {v}
            </div>
          ))}
        </div>
      </div>

      {/* Tables Grid */}
      <div className="tables-grid">
        {tables.map(t => {
          const elMin = t.seatedAt ? Math.floor((now - t.seatedAt) / 60000) : 0;
          return (
            <div
              key={t.id}
              className={`table-card status-${t.status}`}
              onClick={() => openTable(t)}
            >
              <div className="table-number">{t.id}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                <Users size={12} /> {t.seats} مقاعد
              </div>
              <span className={`badge ${STATUS_BADGE[t.status] || ''}`}>{STATUS_LABELS_AR[t.status] || t.status}</span>
              {t.status !== 'empty' && t.total > 0 && (
                <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, color: 'var(--color-primary)', fontSize: '0.88rem' }}>{t.total.toFixed(2)} ₪</div>
              )}
              {t.status !== 'empty' && t.seatedAt && (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                  <Timer size={10} /> {elMin} دقيقة
                </div>
              )}
              {t.status === 'bill_requested' && (
                <div style={{ position: 'absolute', top: '8px', left: '8px', color: '#d97706' }}>
                  <Receipt size={16} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bill confirm modal -> Bottom Sheet */}
      {billConfirmOpen && selectedTable && (
        <div className="bottom-sheet-overlay" onClick={e => { if (e.target === e.currentTarget) setBillConfirmOpen(false); }}>
          <div className="bottom-sheet-drawer" style={{ maxWidth: '400px', margin: 'auto' }}>
            <div className="bottom-sheet-handle" />
            <div className="bottom-sheet-header">
              <h3 className="bottom-sheet-title">
                <Receipt size={20} style={{ color: 'var(--color-primary)' }} />
                طلب الحساب
              </h3>
              <button className="bottom-sheet-close" onClick={() => setBillConfirmOpen(false)}>×</button>
            </div>
            <div className="bottom-sheet-content" style={{ textAlign: 'center', padding: '20px 16px' }}>
              <p style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>هل تريد إرسال طلب الحساب للمحاسب؟</p>
              <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '2.2rem', fontWeight: 800, color: 'var(--color-primary)', margin: '16px 0' }}>
                {tableData ? (tableData.total || 0).toFixed(2) : '0.00'} ₪
              </p>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button className="send-order-btn" onClick={handleRequestBill} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', height: '50px', fontSize: '1rem' }}>
                  <Check size={18} /> نعم، إرسال الطلب
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit/Change Item Modal */}
      {editingItem && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setEditingItem(null); }}>
          <div className="modal-content glass-card" style={{ maxWidth: '500px', width: '100%', padding: 0, overflow: 'hidden' }}>
            <div className="modal-header">
              <h3 className="modal-title">تعديل الصنف</h3>
              <button className="modal-close" onClick={() => setEditingItem(null)}>×</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', padding: '16px' }}>
              <div style={{ marginBottom: '12px', background: 'var(--bg-surface-2)', padding: '12px', borderRadius: '10px' }}>
                <strong>الصنف الحالي: </strong>
                <span>{editingItem.name} × {editingItem.qty}</span>
              </div>
              
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '8px' }}>اختر الصنف البديل:</div>
              
              {/* Category selector */}
              <div className="dept-tabs" style={{ gap: '6px', marginBottom: '10px' }}>
                {DEPT_TABS.map(tab => {
                  const IconComponent = tab.icon;
                  return (
                    <button 
                      key={tab.id} 
                      className={`dept-tab ${editCategory === tab.id ? 'active' : ''}`} 
                      onClick={() => setEditCategory(tab.id)}
                      style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                    >
                      <IconComponent size={14} /> <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
              
              {/* Search */}
              <div style={{ position: 'relative', marginBottom: '12px' }}>
                <input 
                  className="form-input" 
                  placeholder="بحث عن صنف بديل..." 
                  value={editSearch} 
                  onChange={e => setEditSearch(e.target.value)} 
                  style={{ paddingRight: '40px', padding: '8px 12px' }} 
                />
                <Search size={16} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              </div>
              
              {/* Menu items list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '8px', background: 'var(--bg-surface)' }}>
                {menuItems.filter(item => {
                  if (!item.available) return false;
                  const matchDept = editCategory === 'all' || item.department === editCategory;
                  const matchSearch = !editSearch || item.name?.includes(editSearch) || item.nameAr?.includes(editSearch);
                  return matchDept && matchSearch;
                }).map(item => {
                  const isSelected = selectedReplacement?.id === item.id;
                  return (
                    <div 
                      key={item.id} 
                      onClick={() => setSelectedReplacement(item)}
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        padding: '8px 12px', 
                        borderRadius: '6px', 
                        cursor: 'pointer',
                        background: isSelected ? 'var(--color-primary-glow)' : 'transparent',
                        border: isSelected ? '1px solid var(--color-primary)' : '1px solid transparent',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{item.nameAr || item.name}</span>
                      <span style={{ color: 'var(--color-primary)', fontWeight: 700, fontSize: '0.85rem' }}>{item.price} ₪</span>
                    </div>
                  );
                })}
              </div>
              
              {selectedReplacement && (
                <div style={{ marginTop: '16px', background: 'var(--bg-surface-2)', padding: '12px', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <strong>الصنف المختار:</strong>
                    <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>{selectedReplacement.nameAr || selectedReplacement.name}</span>
                  </div>
                  
                  {/* Quantity & Note */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>الكمية:</span>
                    <div className="qty-controls">
                      <button className="qty-btn" onClick={() => setEditQty(q => Math.max(1, q - 1))}>−</button>
                      <span className="qty-num">{editQty}</span>
                      <button className="qty-btn" onClick={() => setEditQty(q => q + 1)}>+</button>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>الملاحظة:</span>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="مثال: بدون بصل" 
                      value={editNote} 
                      onChange={e => setEditNote(e.target.value)} 
                      style={{ padding: '8px 12px' }}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ padding: '12px 16px' }}>
              <button 
                className="send-order-btn" 
                onClick={handleConfirmEdit}
                disabled={!selectedReplacement}
                style={{ flex: 1, padding: '10px 14px', fontSize: '0.9rem' }}
              >
                تأكيد التعديل
              </button>
              <button 
                className="back-btn" 
                onClick={() => setEditingItem(null)}
                style={{ padding: '10px 14px', fontSize: '0.9rem' }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
