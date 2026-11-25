import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
<<<<<<< HEAD
<<<<<<< HEAD
import { DEMO_ACCOUNTANT_LOGIN, DEMO_ADMIN_LOGIN, DEMO_DRIVER_LOGIN, useAuth } from '../AuthContext.jsx';
=======
import {
  DEMO_ADMIN_LOGIN,
  DEMO_DRIVER_LOGIN,
  DEMO_FINANCE_LOGIN,
  DEMO_OWNER_LOGIN,
  useAuth,
} from '../AuthContext.jsx';
>>>>>>> origin/Pet-Transport
import AuthCard, { safeNext } from '../components/AuthCard.jsx';
<<<<<<< HEAD
import { canAccessPath, homePathForRole, normalizeRole } from '../roles.js';
=======
import { STAFF_HOME } from '../staffSession.js';

/** Staff go back to the staff page they were sent from, otherwise to the start page of their role. */
function staffDestination(staff, next) {
  const home = STAFF_HOME[staff.role] ?? '/';
  return next === home || next.startsWith(`${home}/`) ? next : home;
}

/** True when `next` is a staff page (vet, medical assistant, clinic admin). */
const isStaffPath = (next) => Object.values(STAFF_HOME).some((home) => next === home || next.startsWith(`${home}/`));
>>>>>>> origin/Pet-Owner-Vet
=======
import { DEMO_ADMIN_LOGIN, DEMO_DRIVER_LOGIN, DEMO_OWNER_LOGIN, useAuth } from '../AuthContext.jsx';
import AuthCard, { safeNext } from '../components/AuthCard.jsx';
import { canAccessPath, homePathForRole, normalizeRole } from '../roles.js';
>>>>>>> origin/Admin-transport

export default function LoginPage() {
  const { currentUser, login, staffLogin } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requestedNext = safeNext(params.get('next'), null);

  const [form, setForm] = useState({ email: '', password: '', remember: true });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> origin/Admin-transport
  if (currentUser) {
    const role = normalizeRole(currentUser.role);
    const dest =
      requestedNext && canAccessPath(role, requestedNext)
        ? requestedNext
        : homePathForRole(role);
    return <Navigate to={dest} replace />;
  }
<<<<<<< HEAD
=======
  // Only a customer session skips this page. A staff session is shared by every tab of the browser, so
  // redirecting on it would stop a customer from logging in on another tab while a vet is logged in.
  // A customer sent here from a staff page stays on the form (to log in as staff); redirecting back
  // would loop, since RequireStaff sends them straight back to this page.
  if (currentUser && !isStaffPath(next)) return <Navigate to={next} replace />;
>>>>>>> origin/Pet-Owner-Vet
=======
>>>>>>> origin/Admin-transport

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
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> origin/Admin-transport
      const user = await login(form.email, form.password, form.remember);
      const role = normalizeRole(user.role);
      const dest =
        requestedNext && canAccessPath(role, requestedNext)
          ? requestedNext
          : homePathForRole(role);
      navigate(dest, { replace: true });
    } catch (err) {
      setError(err.message);
=======
      await login(form.email, form.password, form.remember);
      navigate(isStaffPath(next) ? '/' : next, { replace: true });
    } catch (customerError) {
      // Not a customer account: staff (veterinarians) log in on this same page, their accounts are in the backend.
      try {
        const staff = await staffLogin(form.email, form.password, form.remember);
        navigate(staffDestination(staff, next), { replace: true });
      } catch {
        setError(customerError.message);
      }
>>>>>>> origin/Pet-Owner-Vet
    } finally {
      setSubmitting(false);
    }
  }

  return (
<<<<<<< HEAD
    <AuthCard title="ยินดีต้อนรับกลับ" subtitle="เข้าสู่ระบบตามบทบาทของคุณ (Owner / Admin / คนขับ / การเงิน)">
=======
    <AuthCard title="ยินดีต้อนรับกลับ" subtitle="เข้าสู่ระบบตามบทบาทของคุณ (Owner / Admin / คนขับ)">
>>>>>>> origin/Admin-transport
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
          Owner: {DEMO_OWNER_LOGIN.email} / {DEMO_OWNER_LOGIN.password}
        </p>
        <p className="text-center small text-muted mt-1 mb-0">
          คนขับ: {DEMO_DRIVER_LOGIN.email} / {DEMO_DRIVER_LOGIN.password}
          {' · '}
          แอดมิน: {DEMO_ADMIN_LOGIN.email} / {DEMO_ADMIN_LOGIN.password}
<<<<<<< HEAD
          {' · '}
          บัญชี: {DEMO_ACCOUNTANT_LOGIN.email} / {DEMO_ACCOUNTANT_LOGIN.password}
        </p>
        <p className="text-center small text-muted mt-1 mb-0">
          การเงิน: {DEMO_FINANCE_LOGIN.email} / {DEMO_FINANCE_LOGIN.password}
=======
>>>>>>> origin/Admin-transport
        </p>
      </form>
    </AuthCard>
  );
}
