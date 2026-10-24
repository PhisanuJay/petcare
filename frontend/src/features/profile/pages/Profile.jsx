import { useState } from 'react';
import { Link } from 'react-router-dom';
import { memberTier, useAuth } from '../../auth/AuthContext.jsx';
import { usePets } from '../../pet-owner/usePets.js';
import { ageText, careReminders, formatDate, speciesOf } from '../../pet-owner/petUtils.js';
import PetPhoto from '../../pet-owner/components/PetPhoto.jsx';
import UserAvatar from '../../../shared/components/UserAvatar.jsx';
import { useToast } from '../../../shared/components/Toast.jsx';
import { fileToResizedDataUrl } from '../../../shared/utils/storage.js';

const TABS = [
  { id: 'info', label: 'ข้อมูลส่วนตัว', icon: 'bi-person' },
  { id: 'pets', label: 'สัตว์เลี้ยงของฉัน', icon: 'bi-heart' },
  { id: 'password', label: 'เปลี่ยนรหัสผ่าน', icon: 'bi-shield-lock' },
];

function InfoForm({ user, onSaved }) {
  const { updateProfile } = useAuth();
  const [form, setForm] = useState({
    firstName: user.firstName ?? '',
    lastName: user.lastName ?? '',
    email: user.email ?? '',
    phone: user.phone ?? '',
    address: user.address ?? '',
    emergencyName: user.emergencyName ?? '',
    emergencyPhone: user.emergencyPhone ?? '',
  });
  const [error, setError] = useState('');

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.firstName.trim() || !form.lastName.trim()) return setError('กรุณากรอกชื่อและนามสกุล');
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return setError('รูปแบบอีเมลไม่ถูกต้อง');
    try {
      updateProfile({ ...form, firstName: form.firstName.trim(), lastName: form.lastName.trim() });
      onSaved('บันทึกข้อมูลส่วนตัวแล้ว');
    } catch (err) {
      setError(err.message);
    }
    return undefined;
  }

  const input = (key, label, props = {}) => (
    <div className={props.col ?? 'col-md-6'}>
      <label className="form-label" htmlFor={`pf-${key}`}>{label}</label>
      {props.textarea ? (
        <textarea id={`pf-${key}`} className="form-control" rows={3} value={form[key]} onChange={set(key)} />
      ) : (
        <input id={`pf-${key}`} className="form-control" type={props.type ?? 'text'} value={form[key]} onChange={set(key)} />
      )}
    </div>
  );

  return (
    <form className="card-soft" onSubmit={handleSubmit}>
      <div className="section-label"><i className="bi bi-person-vcard" />ข้อมูลส่วนตัว</div>
      {error && <div className="alert-soft danger mb-3"><i className="bi bi-exclamation-circle" />{error}</div>}
      <div className="row g-3">
        {input('firstName', 'ชื่อ')}
        {input('lastName', 'นามสกุล')}
        {input('email', 'อีเมล', { type: 'email' })}
        {input('phone', 'เบอร์โทรศัพท์', { type: 'tel' })}
        {input('address', 'ที่อยู่ (สำหรับบริการรับ-ส่งสัตว์เลี้ยง)', { col: 'col-12', textarea: true })}
      </div>
      <div className="section-label mt-4"><i className="bi bi-telephone-plus" />ผู้ติดต่อฉุกเฉิน</div>
      <div className="row g-3">
        {input('emergencyName', 'ชื่อผู้ติดต่อ')}
        {input('emergencyPhone', 'เบอร์โทร', { type: 'tel' })}
      </div>
      <div className="text-end mt-4">
        <button type="submit" className="btn btn-sky"><i className="bi bi-check2 me-1" />บันทึกข้อมูล</button>
      </div>
    </form>
  );
}

function PasswordForm({ onSaved }) {
  const { changePassword } = useAuth();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.next.length < 8) return setError('รหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร');
    if (form.next !== form.confirm) return setError('รหัสผ่านใหม่ไม่ตรงกัน');
    setSaving(true);
    try {
      await changePassword(form.current, form.next);
      setForm({ current: '', next: '', confirm: '' });
      onSaved('เปลี่ยนรหัสผ่านแล้ว');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
    return undefined;
  }

  return (
    <form className="card-soft" onSubmit={handleSubmit} style={{ maxWidth: 520 }}>
      <div className="section-label"><i className="bi bi-shield-lock" />เปลี่ยนรหัสผ่าน</div>
      {error && <div className="alert-soft danger mb-3"><i className="bi bi-exclamation-circle" />{error}</div>}
      {[
        ['current', 'รหัสผ่านปัจจุบัน', 'current-password'],
        ['next', 'รหัสผ่านใหม่', 'new-password'],
        ['confirm', 'ยืนยันรหัสผ่านใหม่', 'new-password'],
      ].map(([key, label, ac]) => (
        <div className="mb-3" key={key}>
          <label className="form-label" htmlFor={`pw-${key}`}>{label}</label>
          <input id={`pw-${key}`} type="password" className="form-control" autoComplete={ac} value={form[key]} onChange={set(key)} />
        </div>
      ))}
      <button type="submit" className="btn btn-sky" disabled={saving}>
        {saving ? 'กำลังบันทึก...' : 'เปลี่ยนรหัสผ่าน'}
      </button>
    </form>
  );
}

function PetsSummary({ pets }) {
  return (
    <div className="card-soft">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="section-label mb-0"><i className="bi bi-heart" />สัตว์เลี้ยงของฉัน ({pets.length})</div>
        <Link to="/pet-owner/my-pets/new" className="btn btn-sky btn-sm"><i className="bi bi-plus-lg me-1" />เพิ่มสัตว์เลี้ยง</Link>
      </div>
      {pets.length ? (
        <div className="row g-3">
          {pets.map((p) => (
            <div className="col-md-6" key={p.id}>
              <Link to={`/pet-owner/my-pets/${p.id}`} className="pet-card flex-row align-items-center gap-3 p-3">
                <PetPhoto pet={p} />
                <div>
                  <div className="mitr fs-5">{p.name}</div>
                  <div className="small text-muted">
                    {speciesOf(p.species).label}
                    {p.breed ? ` · ${p.breed}` : ''} · {ageText(p.birthDate)}
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-box">
          <i className="bi bi-heart" />
          ยังไม่มีสัตว์เลี้ยง เพิ่มน้องตัวแรกได้เลย
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const { currentUser, updateProfile } = useAuth();
  const { pets } = usePets();
  const { show, toast } = useToast();
  const [tab, setTab] = useState('info');
  const [avatarError, setAvatarError] = useState('');

  const reminders = careReminders(pets).filter((r) => r.status !== 'later');

  async function handleAvatar(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAvatarError('');
    try {
      updateProfile({ avatar: await fileToResizedDataUrl(file, 300) });
      show('อัปเดตรูปโปรไฟล์แล้ว');
    } catch (err) {
      setAvatarError(err.message);
    }
  }

  return (
    <div className="page-wrap">
      <div className="container">
        <div className="page-head">
          <div>
            <h1>โปรไฟล์ของฉัน</h1>
            <p>จัดการข้อมูลส่วนตัวและสัตว์เลี้ยงของคุณ</p>
          </div>
        </div>

        <div className="row g-4">
          <div className="col-lg-4">
            <div className="card-soft text-center">
              <div className="position-relative d-inline-block mb-3">
                <UserAvatar user={currentUser} className="profile-avatar" />
                <label className="upload-btn" title="เปลี่ยนรูปโปรไฟล์">
                  <i className="bi bi-camera" />
                  <input type="file" accept="image/*" hidden onChange={handleAvatar} />
                </label>
              </div>
              {avatarError && <div className="small text-danger mb-2">{avatarError}</div>}
              <h4 className="mb-0">
                {currentUser.firstName} {currentUser.lastName}
              </h4>
              <div className="small text-muted">{currentUser.email}</div>
              <span className="tag sky mt-2">
                <i className="bi bi-stars me-1" />
                สมาชิก {memberTier(currentUser.points)} · {currentUser.points ?? 0} แต้ม
              </span>
              <div className="row g-2 mt-3">
                <div className="col-6">
                  <div className="stat py-2">
                    <div className="num fs-4">{pets.length}</div>
                    <div className="small">สัตว์เลี้ยง</div>
                  </div>
                </div>
                <div className="col-6">
                  <div className="stat py-2">
                    <div className="num fs-4">{reminders.length}</div>
                    <div className="small">นัดใน 30 วัน</div>
                  </div>
                </div>
              </div>
              <div className="small text-muted mt-3">สมาชิกตั้งแต่ {formatDate(currentUser.createdAt)}</div>
            </div>

            {reminders.length > 0 && (
              <div className="card-soft mt-4">
                <div className="section-label"><i className="bi bi-bell" />การแจ้งเตือน</div>
                {reminders.slice(0, 4).map((r) => (
                  <Link
                    key={`${r.pet.id}-${r.title}-${r.date}`}
                    to={`/pet-owner/my-pets/${r.pet.id}`}
                    className={`alert-soft ${r.status === 'overdue' ? 'danger' : 'warn'} mb-2 text-decoration-none`}
                  >
                    <i className="bi bi-calendar-event" />
                    <span>
                      {r.title} · {r.pet.name}
                      <br />
                      <small>{formatDate(r.date)}</small>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="col-lg-8">
            <div className="pill-tabs">
              {TABS.map((t) => (
                <button key={t.id} type="button" className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
                  <i className={`bi ${t.icon}`} />
                  {t.label}
                  {t.id === 'pets' && <span className="count">{pets.length}</span>}
                </button>
              ))}
            </div>
            {tab === 'info' && <InfoForm user={currentUser} onSaved={show} />}
            {tab === 'pets' && <PetsSummary pets={pets} />}
            {tab === 'password' && <PasswordForm onSaved={show} />}
          </div>
        </div>
      </div>
      {toast}
    </div>
  );
}
