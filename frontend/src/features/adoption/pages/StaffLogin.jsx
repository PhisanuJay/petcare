import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ADOPTION_API_URL, ADOPTION_STAFF_TOKEN_KEY } from '../api.js';
import '../adoptionStaff.css';

export default function AdoptionStaffLoginPage() {
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const formData = new FormData(event.currentTarget);
      const response = await fetch(`${ADOPTION_API_URL}/staff/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.get('email'),
          password: formData.get('password'),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'เข้าสู่ระบบไม่สำเร็จ');
      sessionStorage.setItem(ADOPTION_STAFF_TOKEN_KEY, result.token);
      navigate(location.state?.from?.pathname || '/adoption', { replace: true });
    } catch (requestError) {
      if (requestError instanceof TypeError && requestError.message === 'Failed to fetch') {
        setError('เชื่อมต่อ Backend ไม่ได้ กรุณาเปิด Backend แล้วลองอีกครั้ง');
      } else {
        setError(requestError.message || 'เข้าสู่ระบบไม่สำเร็จ');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="adoption-staff-login">
      <div className="adoption-staff-login-card">
        <span className="chip">พื้นที่สำหรับพนักงาน</span>
        <h1>ดูแลการหาบ้านให้น้อง</h1>
        <p>เข้าสู่ระบบเพื่อพิจารณาคำร้องและจัดการสถานะสัตว์</p>
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        <form onSubmit={handleSubmit}>
          <label className="form-label" htmlFor="staff-email">อีเมลพนักงาน</label>
          <input
            className="form-control mb-3"
            id="staff-email"
            name="email"
            type="email"
            autoComplete="username"
            required
          />
          <label className="form-label" htmlFor="staff-password">รหัสผ่าน</label>
          <input
            className="form-control mb-4"
            id="staff-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
          <button className="btn btn-sky w-100" type="submit" disabled={submitting}>
            {submitting ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>
        <Link className="adoption-staff-home-link" to="/">กลับหน้าหาบ้าน</Link>
      </div>
    </section>
  );
}
