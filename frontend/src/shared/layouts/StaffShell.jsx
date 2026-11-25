import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext.jsx';
import { ROLE_LABELS, ROLES, homePathForRole } from '../../features/auth/roles.js';
import '../../features/pet-transport/transport.css';

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

/**
 * Minimal shell for Admin / Driver after login (not the customer site).
 */
export default function StaffShell({ variant }) {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const path = useLocation().pathname;
  const isAdmin = variant === 'admin' || currentUser?.role === ROLES.admin;

  const links = [
    { to: '/admin/transport', label: 'Transport Dashboard' },
    { to: '/admin/transport/bookings', label: 'Bookings' },
    { to: '/admin/transport/drivers', label: 'จัดการคนขับ' },
    { to: '/admin/transport/payments', label: 'Payment' },
    { to: '/admin/transport/pricing', label: 'Pricing' },
  ];

  if (!isAdmin) {
    const name = `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || 'คนขับ';
    return (
      <div className="app-shell driver-shell">
        <header className="driver-bar">
          <div className="driver-brand">
            <span className="driver-brand__mark">
              <img src="/brand-mark.jpg" alt="" />
            </span>
            <strong>PetCare</strong>
          </div>
          <span className="driver-bar__rule" aria-hidden="true" />
          <nav aria-label="เมนูคนขับ">
            <NavLink
              to="/pet-transport"
              className={() => (path === '/pet-transport' || path.includes('/jobs/') ? 'active' : undefined)}
            >
              <ScheduleIcon />
              <span>ตารางงาน</span>
            </NavLink>
            <NavLink to="/pet-transport/history">
              <DoneIcon />
              <span>ส่งแล้ว</span>
            </NavLink>
          </nav>
          <div className="driver-who">
            <div className="driver-who__card">
              <span className="driver-avatar" aria-hidden="true">{name.slice(0, 1)}</span>
              <div>
                <strong>{name}</strong>
                <small>{currentUser?.vehicle || 'ยังไม่ระบุรถ'}</small>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                logout();
                navigate('/login', { replace: true });
              }}
            >
              ออก
            </button>
          </div>
        </header>
        <main>
          <Outlet />
        </main>
      </div>
    );
  }

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
            <Link className="small" to={homePathForRole(currentUser?.role)}>
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
