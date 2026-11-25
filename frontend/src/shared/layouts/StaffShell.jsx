import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext.jsx';
import { ROLES } from '../../features/auth/roles.js';
import { useTransport } from '../../features/pet-transport/useTransport.js';
import '../../features/pet-transport/transport.css';
import '../../features/pet-transport/driver-refresh.css';
import './admin-shell.css';

function ScheduleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 3.5v3M16 3.5v3M4 9.5h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function DoneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8.5 12.2l2.3 2.3 4.7-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5.5 19c1.6-3 4-4.5 6.5-4.5S16.9 16 18.5 19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.2 1.8H4.8L6 16.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M10 19a2 2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const ADMIN_LINKS = [
  { to: '/admin/transport', label: 'ภาพรวม', icon: 'bi-speedometer2', end: true },
  { to: '/admin/transport/bookings', label: 'รายการจอง', icon: 'bi-journal-text' },
  { to: '/admin/transport/drivers', label: 'จัดการคนขับ', icon: 'bi-person-badge' },
  { to: '/admin/transport/cancellations', label: 'คำขอยกเลิก', icon: 'bi-x-circle' },
  { to: '/admin/transport/pricing', label: 'ตั้งราคา', icon: 'bi-tag' },
];

export default function StaffShell({ variant }) {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const path = useLocation().pathname;
  const isAdmin = variant === 'admin' || currentUser?.role === ROLES.admin;

  if (!isAdmin) {
    return <DriverShell currentUser={currentUser} path={path} logout={logout} navigate={navigate} />;
  }

  const name = `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || 'แอดมิน';

  function doLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="admin-shell">
      <aside className="admin-shell__sidebar">
        <Link className="admin-shell__brand" to="/admin/transport">
          <span className="admin-shell__brand-mark"><i className="bi bi-balloon-heart-fill" aria-hidden="true" /></span>
          <span>
            <strong>PetCare</strong>
            <small>จัดการบริการรับส่ง</small>
          </span>
        </Link>

        <nav className="admin-shell__nav" aria-label="เมนูผู้ดูแลระบบ">
          <p>การรับส่งสัตว์</p>
          {ADMIN_LINKS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `admin-shell__link${isActive ? ' is-active' : ''}`}
            >
              <i className={`bi ${item.icon}`} aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="admin-shell__account">
          <div className="admin-shell__user">
            <span className="admin-shell__avatar" aria-hidden="true">{name.slice(0, 1)}</span>
            <span className="admin-shell__user-copy">
              <strong>{name}</strong>
              <small>ผู้ดูแลระบบ</small>
            </span>
          </div>
          <button type="button" className="admin-shell__logout" onClick={doLogout}>
            <i className="bi bi-box-arrow-right" aria-hidden="true" />
            ออกจากระบบ
          </button>
        </div>
      </aside>

      <main className="admin-shell__main">
        <div className="admin-shell__content"><Outlet /></div>
      </main>
    </div>
  );
}

function driverPageTitle(path) {
  if (path.includes('/history')) return 'ส่งแล้ว';
  if (path.includes('/notifications')) return 'แจ้งเตือน';
  if (path.includes('/profile')) return 'โปรไฟล์';
  if (path.includes('/jobs/')) return 'รายละเอียดงาน';
  return 'ตารางงาน';
}

function DriverShell({ currentUser, path, logout, navigate }) {
  const { driverUnreadCount, ensureUpcomingReminders } = useTransport();
  const name = `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || 'คนขับ';
  const unread = driverUnreadCount(currentUser?.id);
  const vehicle = [currentUser?.vehicle, currentUser?.plateNumber].filter(Boolean).join(' · ') || 'คนขับ';
  const pageTitle = driverPageTitle(path);

  useEffect(() => {
    if (currentUser?.id) ensureUpcomingReminders(currentUser.id);
    const timer = window.setInterval(() => {
      if (currentUser?.id) ensureUpcomingReminders(currentUser.id);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [currentUser?.id, ensureUpcomingReminders]);

  const onJobs = path === '/pet-transport' || path.includes('/jobs/');

  function doLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-shell driver-shell driver-shell--side">
      <aside className="driver-side">
        <div className="driver-side__top">
          <div className="driver-side__brand">
            <span className="driver-brand__mark">
              <img src="/brand-mark.jpg" alt="" />
            </span>
            <div>
              <strong>PetCare</strong>
              <small>Driver Panel</small>
            </div>
          </div>

          <nav className="driver-side__nav" aria-label="เมนูคนขับ">
            <NavLink to="/pet-transport" className={() => (onJobs ? 'active' : undefined)}>
              <ScheduleIcon />
              <span>ตารางงาน</span>
            </NavLink>
            <NavLink to="/pet-transport/history">
              <DoneIcon />
              <span>ส่งแล้ว</span>
            </NavLink>
            <NavLink to="/pet-transport/notifications">
              <BellIcon />
              <span>แจ้งเตือน</span>
              {unread > 0 ? <b className="driver-nav-badge">{unread > 9 ? '9+' : unread}</b> : null}
            </NavLink>
            <NavLink to="/pet-transport/profile">
              <ProfileIcon />
              <span>โปรไฟล์</span>
            </NavLink>
          </nav>
        </div>

        <div className="driver-side__foot">
          <div className="driver-side__user">
            {currentUser?.avatar ? (
              <img className="driver-avatar driver-avatar--img driver-side__avatar" src={currentUser.avatar} alt="" />
            ) : (
              <span className="driver-avatar driver-side__avatar" aria-hidden="true">{name.slice(0, 1)}</span>
            )}
            <div>
              <strong>{name}</strong>
              <small>{vehicle}</small>
            </div>
            <button type="button" className="driver-side__logout" onClick={doLogout}>
              ออก
            </button>
          </div>
        </div>
      </aside>

      <div className="driver-side__main">
        <header className="driver-topbar">
          <div>
            <p className="driver-topbar__kicker">PetCare Driver</p>
            <strong className="driver-topbar__title">{pageTitle}</strong>
          </div>
          <Link className="driver-topbar__who" to="/pet-transport/profile" aria-label="ไปหน้าโปรไฟล์">
            {currentUser?.avatar ? (
              <img className="driver-avatar driver-avatar--img driver-side__avatar" src={currentUser.avatar} alt="" />
            ) : (
              <span className="driver-avatar driver-side__avatar" aria-hidden="true">{name.slice(0, 1)}</span>
            )}
            <div>
              <strong>{name}</strong>
              <small>{vehicle}</small>
            </div>
          </Link>
        </header>
        <main className="driver-side__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
