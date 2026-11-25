<<<<<<< HEAD
import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext.jsx';
import { ROLE_LABELS, ROLES, homePathForRole } from '../../features/auth/roles.js';
import { useTransport } from '../../features/pet-transport/useTransport.js';
import '../../features/pet-transport/transport.css';
import '../../features/pet-transport/driver-refresh.css';

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

/**
 * Minimal shell for Admin / Driver / Finance after login (not the customer site).
 */
export default function StaffShell({ variant }) {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const path = useLocation().pathname;
  const isAdmin = variant === 'admin' || currentUser?.role === ROLES.admin;
  const isFinance = variant === 'finance' || currentUser?.role === ROLES.finance;

  const adminLinks = [
    { to: '/admin/transport', label: 'Transport Dashboard' },
    { to: '/admin/transport/bookings', label: 'Bookings' },
    { to: '/admin/transport/drivers', label: 'จัดการคนขับ' },
    { to: '/admin/transport/pricing', label: 'Pricing' },
  ];

  const financeLinks = [
    { to: '/finance', label: 'ตรวจชำระเงิน' },
  ];

  if (!isAdmin && !isFinance) {
    return <DriverShell currentUser={currentUser} path={path} logout={logout} navigate={navigate} />;
  }

  const links = isFinance ? financeLinks : adminLinks;

=======
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext.jsx';
import { ROLE_LABELS, ROLES, homePathForRole } from '../../features/auth/roles.js';
import '../../features/pet-transport/transport.css';

/**
 * Admin shell for Pet Transport booking ops.
 */
export default function StaffShell() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const links = [
    { to: '/admin/transport', label: 'Transport Dashboard' },
    { to: '/admin/transport/bookings', label: 'Bookings' },
    { to: '/admin/transport/drivers', label: 'จัดการคนขับ' },
    { to: '/admin/transport/payments', label: 'Payment' },
    { to: '/admin/transport/pricing', label: 'Pricing' },
  ];

>>>>>>> origin/Admin-transport
  return (
    <div className="app-shell">
      <header style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem 1.25rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem 1rem', alignItems: 'center' }}>
            <strong>
              PetCare · {ROLE_LABELS[currentUser?.role] || 'Staff'}
            </strong>
            <nav aria-label="Staff">
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: '0.65rem 1rem' }}>
                {links.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <span className="small text-muted">
              {currentUser?.firstName} {currentUser?.lastName}
            </span>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => {
                logout();
                navigate('/login', { replace: true });
              }}
            >
              ออกจากระบบ
            </button>
<<<<<<< HEAD
            <Link className="small" to={homePathForRole(currentUser?.role)}>
=======
            <Link className="small" to={homePathForRole(currentUser?.role || ROLES.admin)}>
>>>>>>> origin/Admin-transport
              หน้าหลัก
            </Link>
          </div>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
<<<<<<< HEAD

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
=======
>>>>>>> origin/Admin-transport
