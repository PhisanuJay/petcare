import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import AuthCard, { safeNext } from '../components/AuthCard.jsx';

export default function LoginPage() {
  const { currentUser, login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));

  const [form, setForm] = useState({ email: '', password: '', remember: true });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (currentUser) return <Navigate to={next} replace />;

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.email || !form.password) {
      setError('กรุณากรอกอีเมลและรหัสผ่าน');
      return;
    }
    setSubmitting(true);
    try {
      await login(form.email, form.password, form.remember);
      navigate(next, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard title="ยินดีต้อนรับกลับ" subtitle="เข้าสู่ระบบเพื่อจองคิวและดูข้อมูลน้องๆ ของคุณ">
      <form onSubmit={handleSubmit} noValidate>
        {error && (
          <div className="alert-soft danger mb-3">
            <i className="bi bi-exclamation-circle" />
            {error}
          </div>
        )}
        <div className="mb-3">
          <label className="form-label" htmlFor="login-email">อีเมล</label>
          <div className="input-group">
            <span className="input-group-text"><i className="bi bi-envelope" /></span>
            <input
              id="login-email"
              type="email"
              className="form-control"
              placeholder="you@example.com"
              autoComplete="email"
              value={form.email}
              onChange={set('email')}
            />
          </div>
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="login-password">รหัสผ่าน</label>
          <div className="input-group">
            <span className="input-group-text"><i className="bi bi-lock" /></span>
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              className="form-control"
              placeholder="รหัสผ่าน"
              autoComplete="current-password"
              value={form.password}
              onChange={set('password')}
            />
            <button
              type="button"
              className="btn btn-soft"
              style={{ borderRadius: '0 14px 14px 0', border: '1.5px solid #dbe7f3', borderLeft: 0 }}
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
            >
              <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`} />
            </button>
          </div>
        </div>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div className="form-check">
            <input
              id="login-remember"
              type="checkbox"
              className="form-check-input"
              checked={form.remember}
              onChange={set('remember')}
            />
            <label className="form-check-label small" htmlFor="login-remember">จดจำฉันไว้</label>
          </div>
          <span className="small text-muted">ลืมรหัสผ่าน? ติดต่อคลินิก 02-123-4567</span>
        </div>
        <button type="submit" className="btn btn-sky w-100 py-2" disabled={submitting}>
          {submitting ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
        </button>
        <p className="text-center small mt-4 mb-0">
          ยังไม่มีบัญชี?{' '}
          <Link to={`/register${params.get('next') ? `?next=${encodeURIComponent(next)}` : ''}`} className="fw-medium">
            สมัครสมาชิกฟรี
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
