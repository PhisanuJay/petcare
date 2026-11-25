import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext.jsx';
import { fileToResizedDataUrl } from '../../../shared/utils/storage.js';
import '../transport.css';

function emptyForm(user) {
  return {
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    phone: user?.phone || '',
    licenseNumber: user?.licenseNumber || '',
    licenseExpiry: user?.licenseExpiry || '',
    vehicle: user?.vehicle || '',
    plateNumber: user?.plateNumber || '',
  };
}

export default function DriverProfilePage() {
  const { currentUser, updateProfile } = useAuth();
  const [form, setForm] = useState(() => emptyForm(currentUser));
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(emptyForm(currentUser));
  }, [currentUser]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onAvatar(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErr('');
    setMsg('');
    try {
      updateProfile({ avatar: await fileToResizedDataUrl(file, 320) });
      setMsg('อัปเดตรูปโปรไฟล์แล้ว');
    } catch (error) {
      setErr(error.message);
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    setErr('');
    setMsg('');
    setSaving(true);
    try {
      if (!form.firstName.trim() || !form.lastName.trim()) {
        throw new Error('กรุณากรอกชื่อและนามสกุล');
      }
      if (!form.phone.trim()) {
        throw new Error('กรุณากรอกเบอร์โทร');
      }
      updateProfile({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
        licenseNumber: form.licenseNumber.trim(),
        licenseExpiry: form.licenseExpiry.trim(),
        vehicle: form.vehicle.trim(),
        plateNumber: form.plateNumber.trim(),
      });
      setMsg('บันทึกโปรไฟล์แล้ว');
    } catch (error) {
      setErr(error.message);
    } finally {
      setSaving(false);
    }
  }

  const name = `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || 'คนขับ';

  return (
    <section className="driver-page dv-light">
      <header className="dv-hero">
        <div>
          <h1>โปรไฟล์ของฉัน</h1>
          <p>ชื่อ เบอร์ รูป ใบขับขี่ และข้อมูลรถ</p>
        </div>
      </header>

      {msg ? <div className="tp-alert tp-alert--ok">{msg}</div> : null}
      {err ? <div className="tp-alert tp-alert--danger">{err}</div> : null}

      <div className="driver-profile-layout">
        <div className="tp-card driver-profile-avatar-card">
          <div className="driver-profile-avatar">
            {currentUser?.avatar ? (
              <img src={currentUser.avatar} alt="" />
            ) : (
              <span aria-hidden="true">{name.slice(0, 1)}</span>
            )}
          </div>
          <strong>{name}</strong>
          <small>{currentUser?.email}</small>
          <label className="tp-btn tp-btn--ghost driver-profile-upload">
            เปลี่ยนรูปโปรไฟล์
            <input type="file" accept="image/*" hidden onChange={onAvatar} />
          </label>
        </div>

        <form className="tp-card tp-form driver-profile-form" onSubmit={onSubmit}>
          <h2>ชื่อและเบอร์โทร</h2>
          <div className="row-2">
            <div className="field">
              <label htmlFor="dp-first">ชื่อ</label>
              <input id="dp-first" value={form.firstName} onChange={set('firstName')} required />
            </div>
            <div className="field">
              <label htmlFor="dp-last">นามสกุล</label>
              <input id="dp-last" value={form.lastName} onChange={set('lastName')} required />
            </div>
          </div>
          <div className="field">
            <label htmlFor="dp-phone">เบอร์โทร</label>
            <input
              id="dp-phone"
              type="tel"
              value={form.phone}
              onChange={set('phone')}
              placeholder="08x-xxx-xxxx"
              required
            />
          </div>

          <h2>ข้อมูลใบขับขี่</h2>
          <div className="row-2">
            <div className="field">
              <label htmlFor="dp-license">เลขที่ใบขับขี่</label>
              <input
                id="dp-license"
                value={form.licenseNumber}
                onChange={set('licenseNumber')}
                placeholder="เช่น 12345678"
              />
            </div>
            <div className="field">
              <label htmlFor="dp-license-exp">วันหมดอายุ</label>
              <input
                id="dp-license-exp"
                type="date"
                value={form.licenseExpiry}
                onChange={set('licenseExpiry')}
              />
            </div>
          </div>

          <h2>ข้อมูลรถและทะเบียน</h2>
          <div className="row-2">
            <div className="field">
              <label htmlFor="dp-vehicle">ประเภทรถ / รุ่น</label>
              <input
                id="dp-vehicle"
                value={form.vehicle}
                onChange={set('vehicle')}
                placeholder="เช่น รถตู้ Toyota Commuter"
              />
            </div>
            <div className="field">
              <label htmlFor="dp-plate">ทะเบียนรถ</label>
              <input
                id="dp-plate"
                value={form.plateNumber}
                onChange={set('plateNumber')}
                placeholder="เช่น สก 1234"
              />
            </div>
          </div>

          <div className="tp-actions">
            <button type="submit" className="tp-btn" disabled={saving}>
              {saving ? 'กำลังบันทึก…' : 'บันทึกโปรไฟล์'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
