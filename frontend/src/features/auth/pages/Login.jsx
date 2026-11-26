import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import {
  DEMO_ACCOUNTANT_LOGIN,
  DEMO_ADMIN_LOGIN,
  DEMO_DRIVER_LOGIN,
  DEMO_OWNER_LOGIN,
  DEMO_SUPER_ADMIN_LOGIN,
  useAuth,
} from '../AuthContext.jsx';
import AuthCard, { safeNext } from '../components/AuthCard.jsx';
import { canAccessPath, homePathForRole, normalizeRole } from '../roles.js';
import { STAFF_HOME } from '../staffSession.js';

function staffDestination(staff, next) {
  const home = STAFF_HOME[staff.role] || '/';
  return next === home || next.startsWith(`${home}/`) ? next : home;
}

const DEMO_CLINIC_ADMIN_LOGIN = { email: 'admin@petcare.clinic', password: 'vet12345' };
const DEMO_VET_LOGIN = { email: 'vet1@petcare.clinic', password: 'vet12345' };

const DEMO_SHORTCUTS = [
  { label: 'แอดมินโรงแรม', ...DEMO_ADMIN_LOGIN },
  { label: 'แอดมินคลินิก', ...DEMO_CLINIC_ADMIN_LOGIN },
  { label: 'สัตวแพทย์', ...DEMO_VET_LOGIN },
  { label: 'คนขับ (โรงแรม)', ...DEMO_DRIVER_LOGIN },
  { label: 'บัญชี', ...DEMO_ACCOUNTANT_LOGIN },
  { label: 'เจ้าของสัตว์', ...DEMO_OWNER_LOGIN },
  { label: 'Super Admin', ...DEMO_SUPER_ADMIN_LOGIN },
];

export default function LoginPage() {

  const { currentUser, currentStaff, login, staffLogin } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requestedNext = safeNext(params.get('next'), null);
  const next = requestedNext || '/';
  const [form, setForm] = useState({ email: '', password: '', remember: true });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (currentUser) {
    const role = normalizeRole(currentUser.role);
    const destination =
      requestedNext && canAccessPath(role, requestedNext)
        ? requestedNext
        : homePathForRole(role);
    return <Navigate to={destination} replace />;
  }
  if (currentStaff) {
    return <Navigate to={staffDestination(currentStaff, next)} replace />;
  }

  const set = (key) => (event) =>
    setForm((value) => ({
      ...value,
      [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value,
    }));

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (!form.email || !form.password) {
      setError('กรุณากรอกอีเมลและรหัสผ่าน');
      return;
    }

    setSubmitting(true);
    try {
      let cctvError = '';
      const email = form.email.trim().toLowerCase();

      let customerError;
      try {
        const user = await login(form.email, form.password, form.remember);
        const role = normalizeRole(user.role);

        // Super Admin: เปิด session CCTV ควบคู่ (best-effort) เพื่อเข้าโมดูลกล้องได้
        if (role === 'super_admin' || email === DEMO_SUPER_ADMIN_LOGIN.email) {
          try {
            const response = await fetch('/api/cctv-auth/login', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password: form.password }),
            });
            if (!response.ok && response.status !== 401) {
              const result = await response.json().catch(() => ({}));
              cctvError = result.error?.message || 'เข้าสู่ระบบ CCTV ไม่สำเร็จ';
            }
          } catch {
            cctvError = 'เชื่อมต่อระบบ CCTV ไม่ได้ (ภาพรวม PetCare ยังใช้ได้)';
          }
        }

        const destination =
          requestedNext && canAccessPath(role, requestedNext)
            ? requestedNext
            : homePathForRole(role);
        navigate(destination, { replace: true });
        if (cctvError) {
          // ไม่บล็อกเข้า console — CCTV login ล้มเหลวแค่แจ้งใน console
          console.warn(cctvError);
        }
        return;
      } catch (loginError) {
        customerError = loginError;
      }

      try {
        const staff = await staffLogin(form.email, form.password, form.remember);
        navigate(staffDestination(staff, next), { replace: true });
      } catch (staffError) {
        setError(cctvError || staffError.message || customerError.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="ยินดีต้อนรับกลับ"
      subtitle="เข้าสู่ระบบตามบทบาท (เจ้าของสัตว์ · แอดมินโรงแรม · แอดมินคลินิก · สัตวแพทย์ · MA · คนขับ · บัญชี · Super Admin)"
    >
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
              onClick={() => setShowPassword((value) => !value)}
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
          <Link to="/register" className="fw-medium">สมัครสมาชิกฟรี</Link>
        </p>
        <p className="text-center small text-muted mb-0">
          คนขับสมัครเองไม่ได้ — ให้แอดมินโรงแรมสร้างบัญชีให้
        </p>
        <div className="login-demo-shortcuts mt-3">
          <p className="text-center small text-muted mb-2">ทางลัดบัญชีทดสอบ — กดเพื่อกรอกอีเมล/รหัสผ่าน</p>
          <div className="login-demo-shortcuts__list">
            {DEMO_SHORTCUTS.map((item) => (
              <button
                key={item.email}
                type="button"
                className="login-demo-shortcuts__chip"
                onClick={() => {
                  setError('');
                  setForm((value) => ({
                    ...value,
                    email: item.email,
                    password: item.password,
                  }));
                }}
              >
                <strong>{item.label}</strong>
                <span>{item.email}</span>
              </button>
            ))}
          </div>
        </div>
      </form>
    </AuthCard>
  );
}
