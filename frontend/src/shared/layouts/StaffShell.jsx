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
            <Link className="small" to={homePathForRole(currentUser?.role || ROLES.admin)}>
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
