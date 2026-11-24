import { startTransition } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import '../clinic-admin.css';

const NAV_ITEMS = [
  { to: '/clinic-admin', label: 'ภาพรวม', icon: 'bi-speedometer2', end: true },
  { to: '/clinic-admin/staff', label: 'เจ้าหน้าที่', icon: 'bi-people' },
  { to: '/clinic-admin/schedule', label: 'ตารางเวรและวันหยุด', icon: 'bi-calendar-week' },
  { to: '/clinic-admin/settings', label: 'ตั้งค่าคลินิก', icon: 'bi-sliders' },
  { to: '/clinic-admin/reports', label: 'รายงาน', icon: 'bi-bar-chart-line' },
];

export default function ClinicAdminLayout() {
  const { currentStaff, staffLogout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    startTransition(() => {
      staffLogout();
      navigate('/login', { replace: true });
    });
  }

  return (
    <div className="pc-site ca-shell">
      <div className="container">
        <div className="d-lg-none mb-3 ca-no-print">
          <div className="ca-mobile-header justify-content-between flex-wrap">
            <div className="d-flex align-items-center gap-3">
              <span className="ca-brand-icon">
                <i className="bi bi-hospital" aria-hidden="true" />
              </span>
              <div>
                <div className="mitr fs-5 lh-sm">แอดมินโรงพยาบาล</div>
                <div className="small text-muted">คลินิก PetCare</div>
              </div>
            </div>
            <div className="d-flex align-items-center gap-2 ms-auto">
              {currentStaff && (
                <span className="small fw-medium">
                  <i className="bi bi-person-circle me-1 text-sky" aria-hidden="true" />
                  {currentStaff.name}
                </span>
              )}
              <button type="button" className="btn btn-soft btn-sm" onClick={handleLogout}>
                <i className="bi bi-box-arrow-right me-1" aria-hidden="true" />
                ออกจากระบบ
              </button>
            </div>
          </div>

          <nav className="pill-tabs ca-mobile-nav" aria-label="เมนูแอดมินโรงพยาบาล">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `ca-mobile-link${isActive ? ' active' : ''}`}
              >
                <i className={`bi ${item.icon}`} aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="ca-layout">
          <aside className="ca-sidebar d-none d-lg-block ca-no-print">
            <div className="ca-brand">
              <span className="ca-brand-icon">
                <i className="bi bi-hospital" aria-hidden="true" />
              </span>
              <div>
                <div className="mitr fs-5 lh-sm">แอดมินโรงพยาบาล</div>
                <div className="small text-muted">คลินิก PetCare</div>
              </div>
            </div>

            <nav className="ca-nav" aria-label="เมนูแอดมินโรงพยาบาล">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `ca-nav-link${isActive ? ' active' : ''}`}
                >
                  <i className={`bi ${item.icon}`} aria-hidden="true" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>

            <div className="ca-sidebar-footer">
              {currentStaff && (
                <div
                  className="small fw-medium px-2 d-flex align-items-center gap-2 text-truncate"
                  title={currentStaff.name}
                >
                  <i className="bi bi-person-circle text-sky flex-shrink-0" aria-hidden="true" />
                  <span className="text-truncate">{currentStaff.name}</span>
                </div>
              )}
              <button type="button" className="btn btn-soft btn-sm w-100" onClick={handleLogout}>
                <i className="bi bi-box-arrow-right me-1" aria-hidden="true" />
                ออกจากระบบ
              </button>
            </div>
          </aside>

          <div className="ca-content">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
