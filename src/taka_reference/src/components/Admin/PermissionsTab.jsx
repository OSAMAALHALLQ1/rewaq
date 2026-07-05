import React from 'react';
import { ROLE_COLORS, ROLE_LABELS, PERMISSIONS } from './constants';
import { ShieldCheck, Check, X } from 'lucide-react';

export default function PermissionsTab() {
  const roles = ['manager', 'waiter', 'cashier', 'kitchen', 'bar', 'shisha'];
  return (
    <div>
      <h2 className="tab-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <ShieldCheck size={24} style={{ color: 'var(--color-primary)' }} />
        جدول الصلاحيات
      </h2>
      <div className="responsive-grid-2" style={{ marginTop: '16px' }}>
        {PERMISSIONS.map(perm => (
          <div key={perm.key} className="admin-card" style={{ padding: '16px' }}>
            <h3 style={{ marginBottom: '16px', fontSize: '1rem', fontWeight: 700, borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>{perm.label}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '8px' }}>
              {roles.map(r => (
                <div key={r} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--bg-surface-2)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                  <span style={{ fontSize: '0.85rem', color: ROLE_COLORS[r], fontWeight: 600 }}>{ROLE_LABELS[r]}</span>
                  {perm[r] ? <Check size={16} style={{ color: '#16a34a' }} /> : <X size={16} style={{ color: '#dc2626' }} />}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
