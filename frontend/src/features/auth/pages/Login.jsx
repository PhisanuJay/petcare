import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
<<<<<<< Updated upstream
import { useAuth } from '../AuthContext.jsx';
=======
import {
  DEMO_ACCOUNTANT_LOGIN,
  DEMO_ADMIN_LOGIN,
  DEMO_ADOPTION_STAFF_LOGIN,
  DEMO_DRIVER_LOGIN,
  DEMO_FIND_HOME_LOGIN,
  DEMO_OWNER_LOGIN,
  DEMO_SUPER_ADMIN_LOGIN,
  useAuth,
} from '../AuthContext.jsx';
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
      await login(form.email, form.password, form.remember);
      navigate(next, { replace: true });
    } catch (err) {
      setError(err.message);
=======
      let cctvError = '';
      const email = form.email.trim().toLowerCase();
      if (email === DEMO_SUPER_ADMIN_LOGIN.email) {
        try {
          const response = await fetch('/api/cctv-auth/login', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: form.password }),
          });
          const result = await response.json().catch(() => ({}));
          if (response.ok) {
            navigate('/super-admin', { replace: true });
            return;
          }
          if (response.status !== 401) {
            cctvError = result.error?.message || 'เข้าสู่ระบบ CCTV ไม่สำเร็จ';
          }
        } catch {
          cctvError = 'เชื่อมต่อระบบ CCTV ไม่ได้ กรุณาตรวจสอบว่า Backend ทำงานอยู่';
        }
      }

      let customerError;
      try {
        const user = await login(form.email, form.password, form.remember);
        const role = normalizeRole(user.role);
        const destination =
          requestedNext && canAccessPath(role, requestedNext)
            ? requestedNext
            : homePathForRole(role);
        navigate(destination, { replace: true });
        return;
      } catch (loginError) {
        customerError = loginError;
      }

      let adoptionError = '';
      try {
        const response = await fetch(`${ADOPTION_API_URL}/staff/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: form.email, password: form.password }),
        });
        const result = await response.json();
        if (response.ok) {
          sessionStorage.setItem(ADOPTION_STAFF_TOKEN_KEY, result.token);
          navigate('/adoption', { replace: true });
          return;
        }
        if (response.status !== 401) {
          adoptionError = result.error || 'เข้าสู่ระบบพนักงานไม่สำเร็จ';
        }
      } catch (requestError) {
        adoptionError = requestError instanceof TypeError
          ? 'เชื่อมต่อระบบพนักงานไม่ได้ กรุณาตรวจสอบว่า Backend ทำงานอยู่'
          : requestError.message || 'เข้าสู่ระบบพนักงานไม่สำเร็จ';
      }

      try {
        const staff = await staffLogin(form.email, form.password, form.remember);
        navigate(staffDestination(staff, next), { replace: true });
      } catch (staffError) {
        setError(
          adoptionError
            ? `${adoptionError} (${customerError.message})`
            : cctvError || staffError.message || customerError.message,
        );
      }
>>>>>>> Stashed changes
    } finally {
      setSubmitting(false);
    }
  }

  return (
<<<<<<< Updated upstream
    <AuthCard title="ยินดีต้อนรับกลับ" subtitle="เข้าสู่ระบบเพื่อจองคิวและดูข้อมูลน้องๆ ของคุณ">
=======
    <AuthCard title="ยินดีต้อนรับกลับ" subtitle="เข้าสู่ระบบตามบทบาทของคุณ (Owner / หาบ้าน / พนักงานหาบ้าน / Admin / Staff / Super Admin)">
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
        <p className="text-center small mt-4 mb-0">
          ยังไม่มีบัญชี?{' '}
          <Link to={`/register${params.get('next') ? `?next=${encodeURIComponent(next)}` : ''}`} className="fw-medium">
            สมัครสมาชิกฟรี
          </Link>
=======
        <p className="text-center small mt-4 mb-1">
          ยังไม่มีบัญชีเจ้าของสัตว์?{' '}
          <Link to="/register" className="fw-medium">สมัครสมาชิกฟรี</Link>
        </p>
        <p className="text-center small text-muted mb-0">
          คนขับไม่สามารถสมัครเองได้ — ให้แอดมินสร้างบัญชีให้
        </p>
        <p className="text-center small text-muted mt-2 mb-0">
          Owner: {DEMO_OWNER_LOGIN.email} / {DEMO_OWNER_LOGIN.password}
        </p>
        <p className="text-center small text-muted mt-1 mb-0">
          หาบ้าน: {DEMO_FIND_HOME_LOGIN.email} / {DEMO_FIND_HOME_LOGIN.password}
        </p>
        <p className="text-center small text-muted mt-1 mb-0">
          พนักงานหาบ้าน: {DEMO_ADOPTION_STAFF_LOGIN.email} / {DEMO_ADOPTION_STAFF_LOGIN.password}
        </p>
        <p className="text-center small text-muted mt-1 mb-0">
          คนขับ: {DEMO_DRIVER_LOGIN.email} / {DEMO_DRIVER_LOGIN.password}
          {' · '}แอดมิน: {DEMO_ADMIN_LOGIN.email} / {DEMO_ADMIN_LOGIN.password}
        </p>
        <p className="text-center small text-muted mt-1 mb-0">
          บัญชี: {DEMO_ACCOUNTANT_LOGIN.email} / {DEMO_ACCOUNTANT_LOGIN.password}
        </p>
        <p className="text-center small text-muted mt-1 mb-0">
          Super Admin: {DEMO_SUPER_ADMIN_LOGIN.email} / {DEMO_SUPER_ADMIN_LOGIN.password}
        </p>
        <p className="text-center small text-muted mt-1 mb-0">
          Staff คลินิก: admin@petcare.clinic / vet12345
>>>>>>> Stashed changes
        </p>
      </form>
    </AuthCard>
  );
}
