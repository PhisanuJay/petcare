import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext.jsx';
import '../transport.css';

const EMPTY = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  vehicle: '',
};

export default function DriversPage() {
  const { drivers, createDriver, updateDriver, setDriverActive } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setMsg('');
    setSaving(true);
    try {
      await createDriver(form);
      setForm(EMPTY);
      setMsg('สร้างบัญชีคนขับแล้ว — คนขับสามารถ login ได้ทันที และจะโผล่ในรายการ Assign');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <h1>จัดการคนขับ</h1>
      <p className="tp-lead">
        Admin สร้างบัญชีคนขับเท่านั้น — คนขับสมัครเองไม่ได้ และบัญชีจะปรากฏใน Assign อัตโนมัติ
      </p>

      {msg && <div className="tp-alert tp-alert--ok">{msg}</div>}
      {error && <div className="tp-alert tp-alert--danger">{error}</div>}

      <form className="tp-card tp-form" onSubmit={handleCreate}>
        <h3>สร้างบัญชีคนขับ</h3>
        <div className="row-2">
          <div className="field">
            <label htmlFor="dfn">ชื่อ</label>
            <input id="dfn" value={form.firstName} onChange={set('firstName')} required />
          </div>
          <div className="field">
            <label htmlFor="dln">นามสกุล</label>
            <input id="dln" value={form.lastName} onChange={set('lastName')} required />
          </div>
        </div>
        <div className="row-2">
          <div className="field">
            <label htmlFor="dem">อีเมล (ใช้ login)</label>
            <input id="dem" type="email" value={form.email} onChange={set('email')} required />
          </div>
          <div className="field">
            <label htmlFor="dph">เบอร์โทร</label>
            <input id="dph" value={form.phone} onChange={set('phone')} />
          </div>
        </div>
        <div className="row-2">
          <div className="field">
            <label htmlFor="dpw">รหัสผ่านชั่วคราว</label>
            <input id="dpw" type="text" value={form.password} onChange={set('password')} required minLength={8} />
          </div>
          <div className="field">
            <label htmlFor="dveh">รถ / ทะเบียน</label>
            <input id="dveh" value={form.vehicle} onChange={set('vehicle')} placeholder="เช่น รถตู้ขาว กข 1234" />
          </div>
        </div>
        <button type="submit" className="tp-btn" disabled={saving}>
          {saving ? 'กำลังสร้าง...' : 'สร้างบัญชีคนขับ'}
        </button>
      </form>

      <h3 style={{ marginTop: '1.25rem' }}>รายชื่อคนขับในระบบ</h3>
      <div className="tp-list">
        {drivers.map((d) => (
          <div key={d.id} className="tp-list-item">
            <div>
              <strong>
                {d.firstName} {d.lastName}
              </strong>
              <div className="tp-list-item__meta">{d.email} · {d.phone || '-'}</div>
              <div className="tp-list-item__meta">{d.vehicle || 'ยังไม่ระบุรถ'}</div>
            </div>
            <div className="tp-actions" style={{ marginTop: 0 }}>
              <input
                className="form-control form-control-sm"
                style={{ maxWidth: 180 }}
                defaultValue={d.vehicle || ''}
                placeholder="รถ / ทะเบียน"
                onBlur={(e) => {
                  if (e.target.value !== (d.vehicle || '')) {
                    updateDriver(d.id, { vehicle: e.target.value });
                  }
                }}
              />
              <button
                type="button"
                className={`tp-btn ${d.active === false ? 'tp-btn--ok' : 'tp-btn--ghost'}`}
                onClick={() => setDriverActive(d.id, d.active === false)}
              >
                {d.active === false ? 'เปิดใช้' : 'ระงับ'}
              </button>
            </div>
          </div>
        ))}
        {!drivers.length && (
          <div className="tp-card">
            <p className="tp-muted" style={{ margin: 0 }}>ยังไม่มีคนขับ — สร้างบัญชีด้านบน</p>
          </div>
        )}
      </div>
    </>
  );
}
