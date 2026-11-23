import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { DEMO_ADMIN_LOGIN, useAuth } from '../AuthContext.jsx';
import AuthCard, { safeNext } from '../components/AuthCard.jsx';
import { canAccessPath, homePathForRole, normalizeRole } from '../roles.js';

export default function LoginPage() {
  const { currentUser, login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requestedNext = safeNext(params.get('next'), null);

  const [form, setForm] = useState({ email: '', password: '', remember: true });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (currentUser) {
    const role = normalizeRole(currentUser.role);
    const dest =
      requestedNext && canAccessPath(role, requestedNext)
        ? requestedNext
        : homePathForRole(role);
    return <Navigate to={dest} replace />;
  }

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
      const user = await login(form.email, form.password, form.remember);
      const role = normalizeRole(user.role);
      const dest =
        requestedNext && canAccessPath(role, requestedNext)
          ? requestedNext
          : homePathForRole(role);
      navigate(dest, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard title="ยินดีต้อนรับกลับ" subtitle="เข้าสู่ระบบตามบทบาทของคุณ (Owner / Admin / คนขับ)">
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
          <span className="small text-muted">ลืมรหัสผ่าน? ติดต่อแอดมิน</span>
        </div>
        <button type="submit" className="btn btn-sky w-100 py-2" disabled={submitting}>
          {submitting ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
        </button>
        <p className="text-center small mt-4 mb-1">
          ยังไม่มีบัญชีเจ้าของสัตว์?{' '}
          <Link to="/register" className="fw-medium">
            สมัครสมาชิกฟรี
          </Link>
        </p>
        <p className="text-center small text-muted mb-0">
          คนขับไม่สามารถสมัครเองได้ — ให้แอดมินสร้างบัญชีให้
        </p>
        <p className="text-center small text-muted mt-2 mb-0">
          Demo Admin: {DEMO_ADMIN_LOGIN.email} / {DEMO_ADMIN_LOGIN.password}
        </p>
      </form>
    </AuthCard>
  );
}
