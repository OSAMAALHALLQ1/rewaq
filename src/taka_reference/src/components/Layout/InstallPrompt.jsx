import { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    const installedHandler = () => {
      setIsInstalled(true);
      setShowPrompt(false);
    };
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  if (!showPrompt || isInstalled) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '80px',
        left: '16px',
        right: '16px',
        zIndex: 1000,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-light)',
        borderRadius: '16px',
        padding: '16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        animation: 'fadeInUp 0.3s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        direction: 'rtl',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          background: 'var(--color-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 800,
          fontSize: '1.2rem',
          flexShrink: 0,
        }}
      >
        تكة
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
          ثبّت تطبيق تكة
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
          استخدم التطبيق بشكل أسرع من شاشتك الرئيسية
        </div>
      </div>
      <button
        onClick={handleInstall}
        style={{
          background: 'var(--color-primary)',
          color: '#fff',
          border: 'none',
          borderRadius: '10px',
          padding: '10px 16px',
          fontWeight: 700,
          fontSize: '0.85rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          whiteSpace: 'nowrap',
          fontFamily: 'var(--font-arabic)',
          minHeight: '44px',
        }}
      >
        <Download size={16} />
        تثبيت
      </button>
      <button
        onClick={() => setShowPrompt(false)}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
        aria-label="إغلاق"
      >
        <X size={18} />
      </button>
    </div>
  );
}