import React, { useState } from 'react';
import { deleteBills, deleteAllBills, exportBills, filterBills, exportBillsToCSV, getRestaurantName } from '../../utils/storage';
import { Receipt, Download, Trash2, Flame, Eye, Printer } from 'lucide-react';

export default function BillsTab({ bills, menuItems }) {
  const [selected, setSelected] = useState(null);
  const [filterMode, setFilterMode] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minTotal, setMinTotal] = useState('');

  const printBill = (bill) => {
    const w = window.open('', '', 'width=400,height=600');
    const rawName = getRestaurantName().trim();
    const displayName = (rawName === 'سول' || rawName.toLowerCase() === 'soul' || rawName === 'تكة' || rawName === 'تكة | TAKKA') 
      ? 'Soul Mate' 
      : rawName.replace(/سول/g, 'Soul Mate').replace(/soul/gi, 'Soul Mate');

    w.document.write(`<html><head><title>فاتورة - ${bill.tableName}</title>
    <style>body{font-family:Arial;direction:rtl;padding:20px;text-align:right}
    h2{text-align:center}.row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed #ccc}
    .total{font-weight:bold;font-size:1.2em;border-top:2px solid #000;margin-top:8px;padding-top:8px}
    </style></head><body>
    <h2>${displayName}</h2>
    <p style="text-align:center">${bill.tableName} | ${bill.timeFormatted} | ${bill.dateFormatted}</p>
    ${bill.notes ? `<p style="white-space:pre-line;font-size:0.9em;color:#555">ملاحظات: ${bill.notes}</p>` : ''}
    <hr>
    ${(bill.items || []).map(item => `<div class="row"><span>${item.name} × ${item.qty}</span><span>${(item.price * item.qty).toFixed(2)} ₪</span></div>`).join('')}
    <div class="row total"><span>الإجمالي النهائي:</span><span>${(bill.total || 0).toFixed(2)} ₪</span></div>
    <p style="text-align:center;margin-top:20px">شكراً لزيارتكم ${displayName}</p>
    </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  const exportJSON = () => {
    const ids = filterMode === 'all' ? null : filteredBills.map(b => b.id);
    const json = exportBills(ids);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bills-${filterMode}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const data = exportBillsToCSV(filteredBills);
    const blob = new Blob(['\ufeff' + data], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bills-${new Date().toLocaleDateString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredBills = (() => {
    let base = bills;
    if (filterMode === 'week') {
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      base = base.filter(b => b.timestamp && new Date(b.timestamp).getTime() >= weekAgo);
    } else if (filterMode === 'today') {
      const today = new Date().toLocaleDateString('ar-EG');
      base = base.filter(b => b.dateFormatted === today);
    }
    
    const criteria = {};
    if (startDate) criteria.startDate = new Date(startDate).getTime();
    if (endDate) criteria.endDate = new Date(endDate).getTime();
    if (minTotal) criteria.minTotal = parseFloat(minTotal);
    
    if (Object.keys(criteria).length) {
      return filterBills(base, criteria);
    }
    return base;
  })();

  const handleDeleteFiltered = async () => {
    if (!window.confirm('هل أنت متأكد من حذف الفواتير المعروضة؟')) return;
    if (!window.confirm('هذه العملية لا يمكن التراجع عنها.')) return;
    const ids = filteredBills.map(b => b.id);
    await deleteBills(ids);
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('هل تريد حذف جميع الفواتير؟')) return;
    if (!window.confirm('تحذف جميع الفواتير نهائيًا ولا يمكن استرجاعها. المتابعة؟')) return;
    await deleteAllBills();
  };

  const PAYMENT_LABELS = { cash: 'نقد', card: 'بطاقة', bank: 'تحويل بنكي', other: 'أخرى' };

  return (
    <div>
      <div className="responsive-filter-bar">
        <h2 className="tab-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Receipt size={24} style={{ color: 'var(--color-primary)' }} />
          الفواتير ({filteredBills.length})
        </h2>
        <div className="responsive-filter-inputs">
          <select value={filterMode} onChange={e => setFilterMode(e.target.value)} style={{ padding: '6px', borderRadius: '4px' }}>
            <option value="all">الكل</option>
            <option value="today">اليوم</option>
            <option value="week">الأسبوع الحالي</option>
          </select>
          <input type="date" className="form-input" style={{ width: '130px', padding: '6px' }} onChange={e => setStartDate(e.target.value)} />
          <input type="date" className="form-input" style={{ width: '130px', padding: '6px' }} onChange={e => setEndDate(e.target.value)} />
          <input type="number" className="form-input" placeholder="الحد الأدنى" style={{ width: '100px', padding: '6px' }} onChange={e => setMinTotal(e.target.value)} />
          <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={exportJSON}>
            <Download size={14} /> JSON
          </button>
          <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={exportCSV}>
            <Download size={14} /> CSV
          </button>
          <button className="btn-danger" style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={handleDeleteFiltered}>
            <Trash2 size={14} /> حذف المعروض
          </button>
          <button className="btn-danger" style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={handleDeleteAll}>
            <Flame size={14} /> حذف الجميع
          </button>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, color: '#27ae60', fontSize: '1.1rem' }}>
            الإجمالي: {filteredBills.reduce((s, b) => s + (b.total || 0), 0).toFixed(2)} ₪
          </div>
        </div>
      </div>

      <div className="responsive-grid-3">
        {[...filteredBills].reverse().map(bill => (
          <div key={bill.id} className="admin-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 800 }}>{bill.tableName}</span>
                <code style={{ fontSize: '0.85rem', background: 'var(--bg-surface-2)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-muted)' }}>{bill.id}</code>
              </div>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, color: '#27ae60', fontSize: '1.1rem' }}>
                {(bill.total || 0).toFixed(2)} ₪
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <div><span style={{ color: 'var(--text-muted)' }}>طريقة الدفع: </span><span style={{ fontWeight: 600 }}>{PAYMENT_LABELS[bill.paymentMethod] || bill.paymentMethod || 'نقد'}</span></div>
              <div style={{ fontFamily: 'Outfit, sans-serif' }}>{bill.timeFormatted}</div>
            </div>
            {bill.notes && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'var(--bg-surface-2)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '8px', whiteSpace: 'pre-line' }}>
                {bill.notes}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid var(--border-light)' }}>
              <button className="btn-secondary" style={{ flex: 1, padding: '8px', fontSize: '0.85rem', display: 'flex', justifyContent: 'center', gap: '4px' }} onClick={() => setSelected(bill)}>
                <Eye size={16} /> تفاصيل
              </button>
              <button className="btn-primary-gold" style={{ flex: 1, padding: '8px', fontSize: '0.85rem', display: 'flex', justifyContent: 'center', gap: '4px' }} onClick={() => printBill(bill)}>
                <Printer size={16} /> طباعة
              </button>
            </div>
          </div>
        ))}
      </div>
      {filteredBills.length === 0 && <div className="admin-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>لا توجد فواتير مكتملة بعد</div>}

      {/* Bill detail modal */}
      {selected && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}>
          <div className="modal-content glass-card">
            <div className="modal-header">
              <h3 className="modal-title">فاتورة {selected.tableName}</h3>
              <button className="modal-close" onClick={() => setSelected(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="responsive-grid-2" style={{ gap: '8px', fontSize: '0.85rem', marginBottom: '16px' }}>
                <div>رقم: <strong style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--color-primary)' }}>{selected.id}</strong></div>
                <div>الوقت: <strong>{selected.timeFormatted}</strong></div>
                <div>الجرسون: <strong>{selected.waiterCode}</strong></div>
                <div>الكاشير: <strong>{selected.cashierCode}</strong></div>
              </div>
              {selected.notes && (
                <div style={{ marginBottom: '12px', padding: '8px 10px', background: 'var(--bg-surface-2)', border: '1px solid var(--border-light)', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'pre-line' }}>
                  {selected.notes}
                </div>
              )}
              {(selected.items || []).map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
                  <span>{item.name} × {item.qty}</span>
                  <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>{(item.price * item.qty).toFixed(2)} ₪</span>
                </div>
              ))}
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.1rem', color: '#27ae60', borderTop: '1px solid var(--border-light)', paddingTop: '8px', marginTop: '4px' }}>
                  <span>الإجمالي النهائي</span>
                  <span style={{ fontFamily: 'Outfit, sans-serif' }}>{(selected.total || 0).toFixed(2)} ₪</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-primary-gold" style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => printBill(selected)}>
                <Printer size={14} /> طباعة
              </button>
              <button className="btn-secondary" onClick={() => setSelected(null)}>إغلاق</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
