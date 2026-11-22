import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import {
  CatMark,
  IconCamera,
  IconDoor,
  IconGear,
  IconHome,
  IconList,
  IconLive,
  IconMonitor,
  IconShield,
  IconUser,
} from './Marks';

function initial(name) {
  const text = String(name || '').trim();
  return text ? text.slice(0, 1) : '?';
}

const ADMIN_NAV = [
  { id: 'dashboard', label: 'ภาพรวม', Icon: IconHome, permission: 'view_cameras' },
  { id: 'cameras', label: 'จัดการกล้อง', Icon: IconCamera, permission: 'manage_cameras' },
  { id: 'live', label: 'ดูภาพสด', Icon: IconMonitor, permission: 'view_cameras' },
  { id: 'rooms', label: 'จัดการห้อง', Icon: IconDoor, permission: 'manage_rooms' },
  { id: 'users', label: 'จัดการผู้ใช้', Icon: IconUser, permission: 'manage_customers' },
  { id: 'roles', label: 'สิทธิ์การเข้าถึง', Icon: IconShield, permission: 'manage_grants' },
  { id: 'logs', label: 'บันทึกกิจกรรม', Icon: IconList, permission: 'view_logs' },
  { id: 'settings', label: 'ตั้งค่า', Icon: IconGear, permission: 'view_settings' },
];

const CUSTOMER_NAV = [
  { id: 'live', label: 'กล้องสด', Icon: IconLive },
  { id: 'rooms', label: 'ห้องของฉัน', Icon: IconDoor },
  { id: 'history', label: 'ประวัติการเข้าพัก', Icon: IconList },
  { id: 'profile', label: 'ข้อมูลส่วนตัว', Icon: IconUser },
  { id: 'contact', label: 'ติดต่อเรา', Icon: IconGear },
];

function canAccess(user, permission) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role !== 'staff') return false;
  if (!permission) return true;
  return Boolean(user.permissions && user.permissions[permission]);
}

function roleHome(userRole) {
  return userRole === 'customer' ? '/watch' : '/admin';
}

function roleLabelOf(userRole) {
  if (userRole === 'admin') return 'ผู้ดูแลระบบ';
  if (userRole === 'staff') return 'พนักงาน';
  return 'ลูกค้า';
}

export default function Shell({ role, children }) {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [section, setSection] = useState(role === 'admin' ? 'dashboard' : 'live');
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    api('/api/auth/me')
      .then((data) => {
        const ok = role === 'admin'
          ? data.user.role === 'admin' || data.user.role === 'staff'
          : data.user.role === role;
        if (!ok) {
          navigate(roleHome(data.user.role), { replace: true });
          return;
        }
        setSession(data);
      })
      .catch(() => navigate('/login', { replace: true }));
  }, [navigate, role]);

  useEffect(() => {
    if (!session || role !== 'admin') return;
    const allowed = ADMIN_NAV.filter((item) => {
      if (item.id === 'users' && session.user.role === 'admin') return true;
      return canAccess(session.user, item.permission);
    });
    if (!allowed.some((item) => item.id === section) && allowed[0]) {
      setSection(allowed[0].id);
    }
  }, [session, section, role]);

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    navigate('/login', { replace: true });
  }

  if (!session) return <main className="center-page">กำลังโหลด</main>;

  const nav = role === 'admin'
    ? ADMIN_NAV.filter((item) => {
      if (item.id === 'users' && session.user.role === 'admin') return true;
      return canAccess(session.user, item.permission);
    })
    : CUSTOMER_NAV;
  const active = nav.find((item) => item.id === section) || nav[0];
  const roleLabel = roleLabelOf(session.user.role);

  return (
    <div className={`workspace ${role === 'admin' ? 'theme-admin' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand">
            <span className="brand-mark"><CatMark /></span>
            <div>
              <strong>Pet Hotel</strong>
              <small>{role === 'admin' ? (session.user.role === 'staff' ? 'Staff Panel' : 'Admin Panel') : session.hotelName}</small>
            </div>
          </div>
          <nav>
            {nav.map((item) => {
              const Icon = item.Icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`nav-item ${section === item.id ? 'active' : ''}`}
                  onClick={() => setSection(item.id)}
                >
                  <Icon />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="sidebar-foot">
          <div className="sidebar-mascot">
            <p>Happy Pets,<br />Happy Stay</p>
            <img
              className="peek-pets-photo"
              src="/sidebar-pets.jpg?v=3"
              alt="หมาซามอยด์และแมวขาวเกาะขอบ"
              draggable="false"
            />
          </div>
          <div className="sidebar-user">
            <button className="avatar avatar-btn" type="button" onClick={() => setProfileOpen(true)} aria-label="ข้อมูลบัญชี">
              {initial(session.user.displayName)}
            </button>
            <div>
              <strong>{session.user.displayName}</strong>
              <small>{roleLabel}</small>
            </div>
            <button className="button ghost tiny" type="button" onClick={logout}>ออก</button>
          </div>
        </div>
      </aside>

      <div className="workspace-main">
        <header className="topbar">
          <div>
            <p className="kicker">{session.hotelName}</p>
            <strong className="top-title">{active.label}</strong>
          </div>
          <button className="who who-btn" type="button" onClick={() => setProfileOpen(true)} aria-label="ข้อมูลบัญชี">
            <span className="avatar">{initial(session.user.displayName)}</span>
            <div>
              <strong>{session.user.displayName}</strong>
              <small>{roleLabel}</small>
            </div>
          </button>
        </header>
        <main>{children(session, { section, setSection })}</main>
      </div>

      {profileOpen ? (
        <ProfileModal
          session={session}
          roleLabel={roleLabel}
          onClose={() => setProfileOpen(false)}
          onSaved={(next) => setSession(next)}
        />
      ) : null}
    </div>
  );
}

function ProfileModal({ session, roleLabel, onClose, onSaved }) {
  const [form, setForm] = useState({
    displayName: session.user.displayName || '',
    currentPassword: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (form.password && form.password !== form.confirmPassword) {
        throw new Error('รหัสผ่านใหม่ไม่ตรงกัน');
      }
      const body = { displayName: form.displayName.trim() };
      if (form.password) {
        body.password = form.password;
        body.currentPassword = form.currentPassword;
      }
      const result = await api('/api/auth/me', { method: 'PATCH', body });
      onSaved({ ...session, user: result.user });
      setForm({
        displayName: result.user.displayName,
        currentPassword: '',
        password: '',
        confirmPassword: '',
      });
      setMessage(form.password ? 'บันทึกชื่อและรหัสผ่านแล้ว' : 'บันทึกชื่อแล้ว');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal profile-modal" onClick={(event) => event.stopPropagation()}>
        <div className="card-top">
          <div className="profile-head">
            <span className="avatar lg">{initial(session.user.displayName)}</span>
            <div>
              <h2>ข้อมูลบัญชี</h2>
              <p className="muted">{roleLabel}</p>
            </div>
          </div>
          <button className="button ghost" type="button" onClick={onClose}>ปิด</button>
        </div>

        {error ? <p className="banner error">{error}</p> : null}
        {message ? <p className="banner ok">{message}</p> : null}

        <form onSubmit={save}>
          <label>
            อีเมล / ชื่อเข้าสู่ระบบ
            <input value={session.user.email} disabled />
          </label>
          <label>
            ชื่อที่แสดง
            <input
              value={form.displayName}
              onChange={(event) => setForm({ ...form, displayName: event.target.value })}
              required
              maxLength={120}
            />
          </label>
          <div className="profile-divider">เปลี่ยนรหัสผ่าน</div>
          <label>
            รหัสผ่านปัจจุบัน
            <input
              type="password"
              value={form.currentPassword}
              onChange={(event) => setForm({ ...form, currentPassword: event.target.value })}
              placeholder="ใส่เมื่อต้องการเปลี่ยนรหัส"
              autoComplete="current-password"
            />
          </label>
          <label>
            รหัสผ่านใหม่
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              minLength={4}
              placeholder="เว้นว่างถ้าไม่เปลี่ยน"
              autoComplete="new-password"
            />
          </label>
          <label>
            ยืนยันรหัสผ่านใหม่
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })}
              minLength={4}
              placeholder="เว้นว่างถ้าไม่เปลี่ยน"
              autoComplete="new-password"
            />
          </label>
          <div className="card-actions">
            <button className="button ghost" type="button" onClick={onClose}>ยกเลิก</button>
            <button className="button" type="submit" disabled={busy}>{busy ? 'กำลังบันทึก' : 'บันทึก'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
