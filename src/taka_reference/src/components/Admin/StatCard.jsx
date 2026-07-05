import React from 'react';

export default function StatCard({ icon, label, value, color }) {
  return (
    <div className="admin-card" style={{ borderTop: `3px solid ${color}`, display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ color, display: 'flex', alignItems: 'center' }}>{icon}</div>
      <div>
        <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'Outfit, sans-serif', lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 600 }}>{label}</div>
      </div>
    </div>
  );
}
