import { useState } from 'react';
import { KeyRound, Eye, EyeOff, LogIn, ShieldCheck, AlertTriangle, UserRound } from 'lucide-react';
import { loginManager, verifyManagerPassword } from '../utils/auth-store';
import BrandLogo from './BrandLogo';

export default function ManagerLogin({ onSwitch, onLogin }) {
  const [managerCode, setManagerCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleLoginSubmit(e) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    
    try {
      const isValid = await verifyManagerPassword(managerCode.trim());
      setBusy(false);
      if (isValid) {
        await loginManager();
        onLogin?.();
      } else {
        setError('كود دخول المدير غير صحيح');
      }
    } catch {
      setBusy(false);
      setError('حدث خطأ أثناء التحقق، يرجى المحاولة لاحقاً');
    }
  }

  return (
    <div className="login-container">
      <div className="login-card glass-card" style={{ maxWidth: '440px' }}>
        <div className="login-header">
          <div className="brand" style={{ justifyContent: 'center', marginBottom: '20px' }}>
            <span className="brand-logo">
              <BrandLogo size={28} style={{ marginLeft: '10px' }} /> تكة | TAKA
            </span>
            <span className="brand-tag">لوحة التحكم والعمليات</span>
          </div>
          <div className="login-icon-box" style={{ background: 'var(--color-primary-glow)', color: 'var(--color-primary)', border: '2px solid color-mix(in srgb, var(--color-primary) 35%, transparent)' }}>
            <ShieldCheck size={32} />
          </div>
          <h2 className="login-title">دخول المدير العام</h2>
          <p className="login-desc">
            أدخل كود المدير الخاص بك للوصول لوظائف الفروع، الموظفين، التقارير والصلاحيات.
          </p>
        </div>

        {error && (
          <div className="login-error" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLoginSubmit}>
          <div className="form-group">
            <label>كود دخول المدير</label>
            <div className="input-with-icon">
              <KeyRound size={18} />
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="أدخل كود دخول المدير..."
                value={managerCode}
                onChange={(e) => setManagerCode(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="input-toggle"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'إخفاء' : 'إظهار'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={busy} 
            className="btn btn-primary" 
            style={{ 
              width: '100%', 
              padding: '12px', 
              background: 'var(--color-primary)', 
              borderColor: 'var(--color-primary)', 
              color: 'var(--text-dark)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '8px' 
            }}
          >
            <LogIn size={18} /> {busy ? 'جاري التحقق...' : 'تسجيل الدخول'}
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center', borderTop: '1px solid var(--border-light)', paddingTop: '20px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onSwitch}
            style={{ width: '100%', display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center' }}
          >
            <UserRound size={18} /> تسجيل دخول الموظفين (عبر أكواد الدعوة)
          </button>
        </div>
      </div>
    </div>
  );
}
