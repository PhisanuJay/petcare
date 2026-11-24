import { startTransition, useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import '../vet.css';

/** Menu in the order of the Page 17 flow: Dashboard → Appointments → Patients → Medical Records → Vaccination → Reports. */
const MENU = [
  { to: '/veterinarian', label: 'ภาพรวม', icon: 'bi-speedometer2', end: true },
  { to: '/veterinarian/appointments', label: 'นัดหมาย', icon: 'bi-calendar2-check' },
  { to: '/veterinarian/patients', label: 'ลูกค้า', icon: 'bi-people' },
  { to: '/veterinarian/medical-records', label: 'ประวัติการรักษา', icon: 'bi-journal-medical' },
  { to: '/veterinarian/vaccination', label: 'วัคซีน', icon: 'bi-capsule' },
  { to: '/veterinarian/reports', label: 'รายงาน', icon: 'bi-bar-chart-line' },
];

function VetNavbar() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { currentStaff, staffLogout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  function handleLogout() {
    // Batched with the navigation so the login guard does not redirect back with a stale `next`.
    startTransition(() => {
      staffLogout();
      navigate('/login', { replace: true });
    });
  }

  return (
    <div className="nav-shell">
      <div className="container">
        <nav className="navbar navbar-expand-xl pc-navbar" aria-label="เมนูสัตวแพทย์">
          <Link className="navbar-brand d-flex align-items-center gap-2 ms-1" to="/veterinarian">
            <span className="brand-logo"><i className="bi bi-heart-pulse-fill" /></span>
            <span className="brand-text">Pet<span>Care</span></span>
            <span className="vet-badge">สัตวแพทย์</span>
          </Link>
          <button
            className="navbar-toggler border-0 shadow-none"
            type="button"
            aria-label="เปิดเมนู"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <span className="navbar-toggler-icon" />
          </button>

          <div className={`collapse navbar-collapse ${open ? 'show' : ''}`}>
            <ul className="navbar-nav mx-auto member-nav">
              {MENU.map((item) => (
                <li className="nav-item" key={item.to}>
                  <NavLink className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} to={item.to} end={item.end}>
                    <i className={`bi ${item.icon}`} />
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
            <div className="d-flex align-items-center gap-2 ms-xl-auto pb-2 pb-xl-0">
              {currentStaff && <span className="small fw-medium"><i className="bi bi-person-circle me-1" />{currentStaff.name}</span>}
              <button type="button" className="btn btn-soft btn-sm" onClick={handleLogout}>
                <i className="bi bi-box-arrow-right me-1" />
                ออกจากระบบ
              </button>
            </div>
          </div>
        </nav>
      </div>
    </div>
  );
}

/** Page frame for every veterinarian page: navbar on top, page content below. */
export default function VetLayout({ children }) {
  return (
    <div className="pc-site vet-site">
      <VetNavbar />
      <main>{children}</main>
    </div>
  );
}
