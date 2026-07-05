import React, { useState } from 'react';
import { saveMenu } from '../../utils/storage';
import { compressImage } from '../../utils/image-compressor';
import { supabase } from '../../utils/supabaseClient';
import { CATEGORY_LABELS } from './constants';
import { renderItemImage } from './utils';
import { UtensilsCrossed, Search, FolderOpen, Check, X, Pencil, Trash2 } from 'lucide-react';

export default function MenuTab({ menuItems, setMenuItems, departments }) {
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('all');
  const [filterCat, setFilterCat] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const emptyForm = { nameAr: '', nameEn: '', description: '', price: '', category: 'mains', department: 'kitchen', image: 'utensils', available: true, prepTime: 15 };
  const [form, setForm] = useState(emptyForm);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageCompressionInfo, setImageCompressionInfo] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const filtered = menuItems.filter(item => {
    const matchSearch = item.name?.includes(search) || item.nameAr?.includes(search) || item.nameEn?.toLowerCase().includes(search.toLowerCase());
    const matchDept = filterDept === 'all' || item.department === filterDept;
    const matchCat = filterCat === 'all' || item.category === filterCat;
    return matchSearch && matchDept && matchCat;
  });

  const handleSave = () => {
    if (!form.nameAr || !form.price) return;
    const item = {
      ...form,
      name: form.nameAr,
      price: parseFloat(form.price) || 0,
      id: editId || `item-${Date.now()}`
    };
    let updated;
    if (editId) {
      updated = menuItems.map(m => m.id === editId ? item : m);
    } else {
      updated = [...menuItems, item];
    }
    saveMenu(updated);
    setMenuItems(updated);
    setShowForm(false);
    setEditId(null);
    setForm(emptyForm);
    setImageCompressionInfo(null);
  };

  const handleEdit = (item) => {
    setForm({ nameAr: item.nameAr || item.name, nameEn: item.nameEn || '', description: item.description || '', price: item.price.toString(), category: item.category, department: item.department, image: item.image || 'utensils', available: item.available !== false, prepTime: item.prepTime || 15 });
    setImageCompressionInfo(null);
    setEditId(item.id);
    setShowForm(true);
  };

  const handleDelete = (item) => {
    if (!window.confirm(`حذف "${item.name || item.nameAr}"؟`)) return;
    const updated = menuItems.filter(m => m.id !== item.id);
    saveMenu(updated);
    setMenuItems(updated);
  };

  const toggleAvailable = (itemId) => {
    const updated = menuItems.map(m => m.id === itemId ? { ...m, available: !m.available } : m);
    saveMenu(updated);
    setMenuItems(updated);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('الرجاء اختيار صورة فقط');
      return;
    }

    const maxUploadMB = 25;
    if (file.size > maxUploadMB * 1024 * 1024) {
      alert(`حجم الصورة كبير جداً. الحد الأقصى ${maxUploadMB} ميجا`);
      return;
    }

    setIsUploadingImage(true);
    setImageCompressionInfo(null);
    try {
      const result = await compressImage(file, {
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.86,
        minQuality: 0.72,
        maxSizeKB: 450
      });

      let imageValue = '';
      if (supabase) {
        const safeName = result.file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
        const filePath = `menu/${Date.now()}_${safeName}`;
        const { error } = await supabase.storage
          .from('menu-images')
          .upload(filePath, result.file, {
            contentType: 'image/webp',
            upsert: false
          });

        if (!error) {
          const { data: urlData } = supabase.storage
            .from('menu-images')
            .getPublicUrl(filePath);
          imageValue = urlData.publicUrl;
        }
      }

      if (!imageValue) {
        imageValue = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target.result);
          reader.onerror = () => reject(new Error('فشل قراءة الصورة المضغوطة'));
          reader.readAsDataURL(result.file);
        });
      }

      setForm(p => ({ ...p, image: imageValue }));
      setImageCompressionInfo(result);
    } catch (err) {
      alert(`فشل رفع الصورة: ${err.message}`);
    } finally {
      setIsUploadingImage(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 className="tab-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <UtensilsCrossed size={24} style={{ color: 'var(--color-primary)' }} />
          إدارة المنيو
        </h2>
        <button className="btn-primary-gold" onClick={() => { setForm(emptyForm); setImageCompressionInfo(null); setEditId(null); setShowForm(true); }}>+ إضافة صنف</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="input-with-icon" style={{ flex: 1, minWidth: '200px', display: 'flex', alignItems: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '0 10px' }}>
          <Search size={16} style={{ color: 'var(--text-muted)' }} />
          <input className="form-input" placeholder="بحث عن صنف..." value={search} onChange={e => setSearch(e.target.value)} style={{ border: 'none', background: 'transparent', flex: 1, outline: 'none' }} />
        </div>
        <select className="form-input" value={filterDept} onChange={e => setFilterDept(e.target.value)} style={{ flex: '0 0 auto', width: 'auto' }}>
          <option value="all">كل الأقسام</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select className="form-input" value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ flex: '0 0 auto', width: 'auto' }}>
          <option value="all">كل الفئات</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {showForm && (
        <div className="admin-card" style={{ marginBottom: '24px', borderColor: 'var(--color-primary)' }}>
          <h3 className="card-title">{editId ? 'تعديل الصنف' : 'صنف جديد'}</h3>
          <div className="responsive-grid-2" style={{ marginTop: '16px' }}>
            <div className="form-group">
              <label className="form-label">الاسم (عربي) *</label>
              <input className="form-input" value={form.nameAr} onChange={e => setForm(p => ({ ...p, nameAr: e.target.value }))} placeholder="برغر كلاسيكي" />
            </div>
            <div className="form-group">
              <label className="form-label">الاسم (إنجليزي)</label>
              <input className="form-input" value={form.nameEn} onChange={e => setForm(p => ({ ...p, nameEn: e.target.value }))} placeholder="Classic Burger" />
            </div>
            <div className="form-group">
              <label className="form-label">السعر (₪) *</label>
              <input type="number" className="form-input" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} placeholder="8" />
            </div>
            <div className="form-group">
              <label className="form-label">القسم</label>
              <select className="form-input" value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))}>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">الفئة</label>
              <select className="form-input" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">صورة الصنف (رابط أو ملف حتى 25 ميجا)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input className="form-input" value={form.image} onChange={e => setForm(p => ({ ...p, image: e.target.value }))} placeholder="رابط صورة الصنف (URL) أو رمز الأيقونة..." style={{ flex: 1 }} />
                <label className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', padding: '0 12px', borderRadius: '8px', fontSize: '0.85rem' }}>
                  <FolderOpen size={14} />
                  <span>{isUploadingImage ? 'يضغط ويرفع...' : 'رفع'}</span>
                  <input type="file" accept="image/*" disabled={isUploadingImage} style={{ display: 'none' }} onChange={handleImageUpload} />
                </label>
              </div>
              {imageCompressionInfo && (
                <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#15803d', fontWeight: 700 }}>
                  تم ضغط الصورة من {imageCompressionInfo.originalSizeLabel} إلى {imageCompressionInfo.compressedSizeLabel}
                  {' '}({imageCompressionInfo.savedPercent}% توفير، {imageCompressionInfo.width}×{imageCompressionInfo.height})
                </div>
              )}
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">وصف الصنف</label>
              <input className="form-input" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="وصف مختصر للصنف" />
            </div>
            <div className="form-group">
              <label className="form-label">وقت التحضير (دقيقة)</label>
              <input type="number" className="form-input" value={form.prepTime} onChange={e => setForm(p => ({ ...p, prepTime: parseInt(e.target.value) || 15 }))} />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '24px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                <input type="checkbox" checked={form.available} onChange={e => setForm(p => ({ ...p, available: e.target.checked }))} style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary)' }} />
                متوفر للطلب
              </label>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button className="btn-primary-gold" onClick={handleSave}>{editId ? 'حفظ' : 'إضافة'}</button>
            <button className="btn-secondary" onClick={() => { setShowForm(false); setImageCompressionInfo(null); setEditId(null); }}>إلغاء</button>
          </div>
        </div>
      )}

      {/* Menu list */}
      <div className="responsive-grid-3">
        {filtered.map(item => (
          <div key={item.id} className="admin-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              {renderItemImage(item.image, item.nameAr || item.name, false)}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-main)' }}>{item.nameAr || item.name}</div>
                {item.nameEn && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.nameEn}</div>}
              </div>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, color: 'var(--color-primary)', fontSize: '1.1rem' }}>
                {item.price} ₪
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '0.8rem' }}>
              <span className="role-badge" style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border-light)' }}>
                {departments.find(d => d.id === item.department)?.name || item.department}
              </span>
              <span className="role-badge" style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border-light)' }}>
                {CATEGORY_LABELS[item.category] || item.category}
              </span>
            </div>

            {item.description && (
              <div>
                <p className={`item-desc ${expandedId === item.id ? 'text-clamp-2 expanded' : 'text-clamp-2'}`}>
                  {item.description}
                </p>
                {item.description.length > 80 && (
                  <button className="read-more-btn" onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}>
                    {expandedId === item.id ? 'عرض أقل' : 'قراءة المزيد'}
                  </button>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid var(--border-light)' }}>
              <button onClick={() => toggleAvailable(item.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', background: item.available ? 'rgba(39, 174, 96, 0.1)' : 'rgba(231, 76, 60, 0.1)', color: item.available ? '#27ae60' : '#e74c3c' }}>
                {item.available ? <Check size={14} /> : <X size={14} />}
                {item.available ? 'متوفر' : 'غير متوفر'}
              </button>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="icon-btn" onClick={() => handleEdit(item)} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)' }}>
                  <Pencil size={16} />
                </button>
                <button className="icon-btn danger" onClick={() => handleDelete(item)} style={{ background: 'rgba(231, 76, 60, 0.1)' }}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {filtered.length === 0 && <div className="admin-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>لا توجد أصناف مطابقة للبحث</div>}
    </div>
  );
}
