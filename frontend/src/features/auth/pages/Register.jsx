import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import AuthCard, { safeNext } from '../components/AuthCard.jsx';

const EMPTY = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  confirm: '',
  accept: false,
};

function validate(form) {
  const errors = {};
  if (!form.firstName.trim()) errors.firstName = 'กรุณากรอกชื่อ';
  if (!form.lastName.trim()) errors.lastName = 'กรุณากรอกนามสกุล';
  if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = 'รูปแบบอีเมลไม่ถูกต้อง';
  if (!/^0\d{8,9}$/.test(form.phone.replace(/[-\s]/g, ''))) errors.phone = 'เบอร์โทร 9-10 หลัก ขึ้นต้นด้วย 0';
  if (form.password.length < 8) errors.password = 'รหัสผ่านอย่างน้อย 8 ตัวอักษร';
  if (form.confirm !== form.password) errors.confirm = 'รหัสผ่านไม่ตรงกัน';
  if (!form.accept) errors.accept = 'กรุณายอมรับเงื่อนไขการใช้งาน';
  return errors;
}

export default function RegisterPage() {
  const { currentUser, register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));

  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (currentUser && !submitting) return <Navigate to={next} replace />;

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSubmitting(true);
    try {
      await register({ ...form, phone: form.phone.replace(/[-\s]/g, '') });
      navigate(next, { replace: true });
    } catch (err) {
      setFormError(err.message);
      setSubmitting(false);
    }
  }

  const field = (key, label, props = {}) => (
    <div className={props.col ?? 'col-12'}>
      <label className="form-label" htmlFor={`reg-${key}`}>{label}</label>
      <input
        id={`reg-${key}`}
        className={`form-control ${errors[key] ? 'is-invalid' : ''}`}
        value={form[key]}
        onChange={set(key)}
        type={props.type ?? 'text'}
        placeholder={props.placeholder}
        autoComplete={props.autoComplete}
      />
      {errors[key] && <div className="invalid-feedback">{errors[key]}</div>}
    </div>
  );

  return (
    <AuthCard title="สมัครสมาชิก" subtitle="สมัครฟรี รับ 50 แต้มต้อนรับ ใช้เวลาไม่ถึง 1 นาที">
      <form onSubmit={handleSubmit} noValidate>
        {formError && (
          <div className="alert-soft danger mb-3">
            <i className="bi bi-exclamation-circle" />
            {formError}
          </div>
        )}
        <div className="row g-3">
          {field('firstName', 'ชื่อ', { col: 'col-sm-6', autoComplete: 'given-name' })}
          {field('lastName', 'นามสกุล', { col: 'col-sm-6', autoComplete: 'family-name' })}
          {field('email', 'อีเมล', { type: 'email', placeholder: 'you@example.com', autoComplete: 'email' })}
          {field('phone', 'เบอร์โทรศัพท์', { type: 'tel', placeholder: '08x-xxx-xxxx', autoComplete: 'tel' })}
          {field('password', 'รหัสผ่าน', { col: 'col-sm-6', type: 'password', autoComplete: 'new-password' })}
          {field('confirm', 'ยืนยันรหัสผ่าน', { col: 'col-sm-6', type: 'password', autoComplete: 'new-password' })}
          <div className="col-12">
            <div className="form-check">
              <input
                id="reg-accept"
                type="checkbox"
                className={`form-check-input ${errors.accept ? 'is-invalid' : ''}`}
                checked={form.accept}
                onChange={set('accept')}
              />
              <label className="form-check-label small" htmlFor="reg-accept">
                ยอมรับเงื่อนไขการใช้งานและนโยบายความเป็นส่วนตัว
              </label>
              {errors.accept && <div className="invalid-feedback">{errors.accept}</div>}
            </div>
          </div>
        </div>
        <button type="submit" className="btn btn-sky w-100 py-2 mt-4" disabled={submitting}>
          {submitting ? 'กำลังสมัคร...' : 'สมัครสมาชิก'}
        </button>
        <p className="text-center small mt-4 mb-0">
          มีบัญชีอยู่แล้ว?{' '}
          <Link to={`/login${params.get('next') ? `?next=${encodeURIComponent(next)}` : ''}`} className="fw-medium">
            เข้าสู่ระบบ
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
