import React, { useState } from 'react';
import { Archive, Download, Calendar, Coins, Hash, Search } from 'lucide-react';

export default function ArchivesTab({ archives = [] }) {
  const [searchTerm, setSearchTerm] = useState('');

  const downloadPDF = (base64Data, filename) => {
    try {
      const link = document.createElement('a');
      link.href = `data:application/pdf;base64,${base64Data}`;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('Failed to download PDF:', e);
      alert('حدث خطأ أثناء تحميل الملف، يرجى المحاولة مرة أخرى.');
    }
  };

  const filteredArchives = archives.filter(arch => 
    String(arch.archiveName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalArchivedAmount = archives.reduce((sum, arch) => sum + (parseFloat(arch.totalAmount) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="responsive-filter-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ 
            background: 'var(--color-primary-glow)', 
            color: 'var(--color-primary)', 
            padding: '8px', 
            borderRadius: '10px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center' 
          }}>
            <Archive size={24} />
          </div>
          <div>
            <h2 className="tab-title" style={{ margin: 0, fontWeight: 800 }}>أرشيف الفواتير المجمعة</h2>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              الفواتير المكتملة التي تم ضغطها تلقائياً بعد كل 50 عملية.
            </p>
          </div>
        </div>

        <div className="responsive-filter-inputs" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Search Box */}
          <div className="input-with-icon" style={{ width: '220px' }}>
            <Search size={16} />
            <input
              type="text"
              className="form-input"
              placeholder="بحث باسم الدفعة..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ padding: '6px 8px 6px 30px', fontSize: '0.85rem' }}
            />
          </div>

          {/* Stats Box */}
          <div style={{ 
            background: 'var(--bg-surface-2)', 
            border: '1px solid var(--border-light)', 
            borderRadius: '8px', 
            padding: '6px 12px', 
            textAlign: 'center',
            minWidth: '150px'
          }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>إجمالي المبيعات المؤرشفة</div>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, color: 'var(--color-primary)', fontSize: '1rem' }}>
              {totalArchivedAmount.toFixed(1)} ₪
            </div>
          </div>
        </div>
      </div>

      {/* Grid List */}
      {filteredArchives.length === 0 ? (
        <div className="glass-card" style={{ padding: '80px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Archive size={54} style={{ color: 'var(--text-light)', marginBottom: '16px' }} />
          <h4 style={{ fontWeight: 800, color: 'var(--text-main)', marginBottom: '6px' }}>لا توجد دفعات مؤرشفة</h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            بمجرد وصول عدد الفواتير المكتملة عند الكاشير إلى 50 فاتورة، سيتم أرشفتها تلقائياً هنا.
          </p>
        </div>
      ) : (
        <div className="responsive-grid-3">
          {[...filteredArchives].reverse().map(arch => (
            <div 
              key={arch.id} 
              className="admin-card glass-card animate-fade-in" 
              style={{ 
                padding: '20px', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '16px',
                border: '1px solid var(--border-light)',
                borderRadius: '12px',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* Gold decorative accent line */}
              <div style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                right: 0, 
                height: '4px', 
                background: 'linear-gradient(90deg, var(--color-primary), #f59e0b)' 
              }} />

              {/* Header Title */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-main)' }}>
                  {arch.archiveName}
                </span>
                <span className="badge badge-ordering" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                  مكتملة
                </span>
              </div>

              {/* Info stats */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                  <Calendar size={14} style={{ color: 'var(--color-primary)' }} />
                  <span>تاريخ الأرشفة: </span>
                  <strong style={{ color: 'var(--text-main)' }} className="num-font">
                    {new Date(arch.createdAt).toLocaleDateString('ar-EG')}
                  </strong>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                  <Hash size={14} style={{ color: 'var(--color-primary)' }} />
                  <span>عدد الفواتير المدمجة: </span>
                  <strong style={{ color: 'var(--text-main)' }} className="num-font">
                    {arch.invoiceCount} فواتير
                  </strong>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                  <Coins size={14} style={{ color: 'var(--color-primary)' }} />
                  <span>إجمالي إيرادات الدفعة: </span>
                  <strong style={{ color: '#16a34a' }} className="num-font">
                    {parseFloat(arch.totalAmount || 0).toFixed(1)} ₪
                  </strong>
                </div>
              </div>

              {/* Action Button */}
              <button 
                className="btn btn-primary" 
                onClick={() => downloadPDF(arch.pdfData, `${arch.archiveName}.pdf`)}
                style={{ 
                  width: '100%', 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '8px',
                  padding: '10px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  background: 'var(--color-primary)',
                  border: 'none',
                  color: 'var(--text-dark)',
                  transition: 'transform 0.15s ease'
                }}
                onMouseOver={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <Download size={16} />
                تحميل التقرير PDF
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
