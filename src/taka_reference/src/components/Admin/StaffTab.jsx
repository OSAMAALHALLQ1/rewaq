import React, { useState } from 'react';
import { saveEmployees } from '../../utils/storage';
import { ROLE_COLORS, ROLE_LABELS } from './constants';
import { Users, Check, X, Pencil, Trash2 } from 'lucide-react';

const MAX_STAFF_MEMBERS = 12;

export default function StaffTab({ employees, setEmployees }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const emptyForm = { name: '', username: '', password: '1234', role: 'waiter', phone: '', email: '', salary: '', active: true };
  const [form, setForm] = useState(emptyForm);

  const nonManagers = employees.filter(e => e.role !== 'manager');

  const handleSave = () => {
    if (!editId && nonManagers.length >= MAX_STAFF_MEMBERS) {
      alert(`عذراً، لقد وصلت للحد الأقصى المسموح به للموظفين وهو ${MAX_STAFF_MEMBERS} موظف`);
      return;
    }
    if (!form.name.trim()) { alert('يرجى إدخال الاسم الكامل'); return; }

    const cleanPhone = String(form.phone || '').trim();
    if (!cleanPhone) {
      alert('يرجى إدخال رقم الهاتف');
      return;
    }
    const phoneRegex = /^(059|056)\d{7}$/;
    if (!phoneRegex.test(cleanPhone)) {
      alert('رقم الهاتف يجب أن يبدأ بـ 059 أو 056 ويتكون من 10 أرقام');
      return;
    }

    const PREFIXES = { waiter: 'W', cashier: 'C', kitchen: 'K', bar: 'B', shisha: 'S', manager: 'M' };
    const code = editId ? employees.find(e => e.id === editId)?.code : `${PREFIXES[form.role] || 'E'}-${Math.floor(1000 + Math.random() * 9000)}`;
    const username = editId ? (employees.find(e => e.id === editId)?.username || code.toLowerCase()) : code.toLowerCase();

    const emp = {
      id: editId || `emp-${Date.now()}`,
      ...form,
      username,
      code,
      phone: cleanPhone,
      salary: parseFloat(form.salary) || 0,
      lastLogin: null
    };

    let updated;
    if (editId) {
      updated = employees.map(e => e.id === editId ? { ...e, ...emp } : e);
    } else {
      updated = [...employees, emp];
    }
    saveEmployees(updated);
    setEmployees(updated);
    setShowForm(false);
    setEditId(null);
    setForm(emptyForm);
  };

  const toggleActive = (emp) => {
    const updated = employees.map(e => e.id === emp.id ? { ...e, active: !e.active } : e);
    saveEmployees(updated);
    setEmployees(updated);
  };

  const handleDelete = (emp) => {
    if (!window.confirm(`حذف ${emp.name}؟`)) return;
    const updated = employees.filter(e => e.id !== emp.id);
    saveEmployees(updated);
    setEmployees(updated);
  };

  const handleEdit = (emp) => {
    setForm({ name: emp.name, username: emp.username, password: emp.password, role: emp.role, phone: emp.phone || '', email: emp.email || '', salary: emp.salary?.toString() || '', active: emp.active });
    setEditId(emp.id);
    setShowForm(true);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 className="tab-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={24} style={{ color: 'var(--color-primary)' }} />
          إدارة الموظفين
        </h2>
        <button className="btn-primary-gold" onClick={() => { 
          if (nonManagers.length >= MAX_STAFF_MEMBERS) {
            alert(`عذراً، لقد وصلت للحد الأقصى المسموح به للموظفين وهو ${MAX_STAFF_MEMBERS} موظف`);
            return;
          }
          setForm(emptyForm); 
          setEditId(null); 
          setShowForm(true); 
        }}>+ موظف جديد</button>
      </div>

      {showForm && (
        <div className="admin-card" style={{ marginBottom: '24px', borderColor: 'var(--color-primary)' }}>
          <h3 className="card-title">{editId ? 'تعديل موظف' : 'موظف جديد'}</h3>
          <div className="responsive-grid-2" style={{ marginTop: '16px' }}>
            <div className="form-group">
              <label className="form-label">الاسم الكامل *</label>
              <input className="form-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="محمد علي" />
            </div>
            <div className="form-group">
              <label className="form-label">الدور</label>
              <select className="form-input" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                <option value="waiter">جرسون</option>
                <option value="cashier">محاسب</option>
                <option value="kitchen">مطبخ</option>
                <option value="bar">بار</option>
                <option value="shisha">شيشة</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">رقم الهاتف *</label>
              <input className="form-input" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="059XXXXXXX أو 056XXXXXXX" />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '24px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                <input type="checkbox" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary)' }} />
                نشط
              </label>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button className="btn-primary-gold" onClick={handleSave}>{editId ? 'حفظ' : 'إضافة'}</button>
            <button className="btn-secondary" onClick={() => { setShowForm(false); setEditId(null); }}>إلغاء</button>
          </div>
        </div>
      )}

      <div className="responsive-grid-3">
        {nonManagers.map(emp => (
          <div key={emp.id} className="admin-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: `${ROLE_COLORS[emp.role]}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.2rem', color: ROLE_COLORS[emp.role] }}>
                {emp.name?.charAt(0)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{emp.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{emp.phone}</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--border-light)', borderBottom: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>الدور</span>
                <span className="role-badge" style={{ background: `${ROLE_COLORS[emp.role]}15`, color: ROLE_COLORS[emp.role], border: `1px solid ${ROLE_COLORS[emp.role]}33` }}>
                  {ROLE_LABELS[emp.role]}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>كود الدخول</span>
                <code style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--color-primary)', fontWeight: 700, fontSize: '1.1rem' }}>
                  {emp.code}
                </code>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
              <button onClick={() => toggleActive(emp)} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', background: emp.active ? 'rgba(39, 174, 96, 0.1)' : 'rgba(231, 76, 60, 0.1)', color: emp.active ? '#27ae60' : '#e74c3c' }}>
                {emp.active ? <Check size={14} /> : <X size={14} />}
                {emp.active ? 'نشط' : 'معطل'}
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="icon-btn" onClick={() => handleEdit(emp)} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)' }}>
                  <Pencil size={16} />
                </button>
                <button className="icon-btn danger" onClick={() => handleDelete(emp)} style={{ background: 'rgba(231, 76, 60, 0.1)' }}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
