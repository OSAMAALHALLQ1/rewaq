import React, { useState } from 'react';
import { saveTables } from '../../utils/storage';
import { normalizeTablesTo70 } from '../../utils/storage/table-normalization';
import { STATUS_LABELS, STATUS_COLORS, AREA_LABELS } from './constants';
import { Armchair, Pencil } from 'lucide-react';

export default function TablesTab({ tables, setTables }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const emptyForm = { seats: 4, area: 'indoor', description: '' };
  const [form, setForm] = useState(emptyForm);
  const [selected, setSelected] = useState(null);

  const normalizedTables = React.useMemo(() => normalizeTablesTo70(tables), [tables]);

  React.useEffect(() => {
    let needsUpdate = false;
    if (!Array.isArray(tables) || tables.length !== 70) {
      needsUpdate = true;
    } else {
      for (let i = 0; i < 70; i++) {
        if (tables[i].id !== normalizedTables[i].id) {
          needsUpdate = true;
          break;
        }
      }
    }
    if (needsUpdate) {
      saveTables(normalizedTables);
      setTables(normalizedTables);
    }
  }, [tables, normalizedTables, setTables]);

  const handleSave = () => {
    if (!editId) return;
    const updated = normalizedTables.map(t => t.id === editId ? { ...t, seats: form.seats, area: form.area, description: form.description } : t);
    saveTables(updated);
    setTables(updated);
    setShowForm(false);
    setEditId(null);
    setForm(emptyForm);
  };

  const handleStatusChange = (tableId, newStatus) => {
    const updated = normalizedTables.map(t => t.id === tableId ? { ...t, status: newStatus } : t);
    saveTables(updated);
    setTables(updated);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 className="tab-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Armchair size={24} style={{ color: 'var(--color-primary)' }} />
          إدارة الطاولات
        </h2>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {Object.entries(STATUS_LABELS).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.82rem' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: STATUS_COLORS[k], display: 'inline-block' }} />
            {v}
          </div>
        ))}
      </div>

      {showForm && (
        <div className="admin-card" style={{ marginBottom: '24px', borderColor: 'var(--color-primary)' }}>
          <h3 className="card-title">تعديل طاولة {editId}</h3>
          <div className="responsive-grid-3" style={{ marginTop: '16px' }}>
            <div className="form-group">
              <label className="form-label">عدد المقاعد</label>
              <select className="form-input" value={form.seats} onChange={e => setForm(p => ({ ...p, seats: parseInt(e.target.value) }))}>
                {[2, 4, 6, 8, 10, 12].map(n => <option key={n} value={n}>{n} مقاعد</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">المنطقة</label>
              <select className="form-input" value={form.area} onChange={e => setForm(p => ({ ...p, area: e.target.value }))}>
                {Object.entries(AREA_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button className="btn-primary-gold" onClick={handleSave}>حفظ</button>
            <button className="btn-secondary" onClick={() => { setShowForm(false); setEditId(null); }}>إلغاء</button>
          </div>
        </div>
      )}

      {/* Tables grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px' }}>
        {normalizedTables.map(t => (
          <div key={t.id} onClick={() => setSelected(selected?.id === t.id ? null : t)}
            className="table-card-admin"
            style={{ borderTop: `4px solid ${STATUS_COLORS[t.status] || '#555'}`, cursor: 'pointer', background: selected?.id === t.id ? 'rgba(212,175,55,0.08)' : 'var(--bg-surface-glass)' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>{t.id}</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{t.name}</div>
            <div style={{ fontSize: '0.75rem', color: STATUS_COLORS[t.status], fontWeight: 600, marginTop: '4px' }}>{STATUS_LABELS[t.status]}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              <Armchair size={12} />
              <span>{t.seats} | {AREA_LABELS[t.area]}</span>
            </div>
            {t.total > 0 && <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, color: 'var(--color-primary)', fontSize: '0.85rem', marginTop: '4px' }}>{t.total.toFixed(2)} ₪</div>}
          </div>
        ))}
      </div>

      {/* Selected table details */}
      {selected && (
        <div className="admin-card" style={{ marginTop: '24px', borderColor: 'var(--color-primary)' }}>
          <h3 className="card-title">{selected.name} - تفاصيل</h3>
          <div className="responsive-grid-3" style={{ marginTop: '12px', fontSize: '0.85rem' }}>
            <div><span style={{ color: 'var(--text-muted)' }}>الحالة: </span><strong>{STATUS_LABELS[selected.status]}</strong></div>
            <div><span style={{ color: 'var(--text-muted)' }}>المقاعد: </span><strong>{selected.seats}</strong></div>
            <div><span style={{ color: 'var(--text-muted)' }}>المنطقة: </span><strong>{AREA_LABELS[selected.area]}</strong></div>
            {selected.waiterCode && <div><span style={{ color: 'var(--text-muted)' }}>الجرسون: </span><strong>{selected.waiterCode}</strong></div>}
            {selected.total > 0 && <div><span style={{ color: 'var(--text-muted)' }}>الإجمالي: </span><strong style={{ color: 'var(--color-primary)' }}>{selected.total.toFixed(2)} ₪</strong></div>}
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="icon-btn" style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => { setForm({ number: selected.id, seats: selected.seats, area: selected.area, description: selected.description || '' }); setEditId(selected.id); setShowForm(true); setSelected(null); }}>
              <Pencil size={14} /> تعديل
            </button>
            <select className="form-input" style={{ flex: '0 0 auto', width: 'auto' }} value={selected.status} onChange={e => { handleStatusChange(selected.id, e.target.value); setSelected(p => ({ ...p, status: e.target.value })); }}>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
