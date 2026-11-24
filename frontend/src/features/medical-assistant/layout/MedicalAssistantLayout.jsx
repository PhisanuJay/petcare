import { startTransition } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { offsetDateKey } from '../data/constants.js';
import { resetMaStore } from '../data/maStore.js';
import { awaitingTriage, needsContact, pendingBookings } from '../data/selectors.js';
import { useAppointments } from '../data/useAppointments.js';
import { useVisits } from '../data/useVisits.js';
import '../ma.css';

const NAV_ITEMS = [
  { to: '/medical-assistant', label: 'แดชบอร์ด', icon: 'bi-speedometer2', end: true },
  { to: '/medical-assistant/appointments', label: 'นัดหมาย', icon: 'bi-calendar2-check' },
  { to: '/medical-assistant/patients', label: 'ผู้ป่วย', icon: 'bi-clipboard2-heart' },
  {
    to: '/medical-assistant/booking-management',
    label: 'จัดการการจอง',
    icon: 'bi-journal-bookmark',
    badgeType: 'booking',
  },
  {
    to: '/medical-assistant/medical-support',
    label: 'สนับสนุนการรักษา',
    icon: 'bi-bandaid',
    badgeType: 'triage',
  },
];

function NavBadges({ badgeType, counts, alignEnd = false }) {
  if (badgeType === 'booking') {
    const { pending, contact } = counts;
    if (pending <= 0 && contact <= 0) return null;
    return (
      <span
        className={`d-inline-flex align-items-center gap-1${alignEnd ? ' ms-auto' : ''}`}
        title={`รอยืนยัน ${pending} รายการ · ติดต่อให้จองใหม่ ${contact} รายการ`}
      >
        {pending > 0 && <span className="ma-nav-badge">{pending}</span>}
        {contact > 0 && <span className="ma-nav-badge ma-nav-badge-warn">{contact}</span>}
      </span>
    );
  }
  if (badgeType === 'triage' && counts.triage > 0) {
    return (
      <span
        className={`ma-nav-badge${alignEnd ? ' ms-auto' : ''}`}
        title={`รอคัดกรอง ${counts.triage} รายการ`}
      >
        {counts.triage}
      </span>
    );
  }
  return null;
}

export default function MedicalAssistantLayout() {
  const { appointments } = useAppointments();
  const { getVisit } = useVisits();
  const { currentStaff, staffLogout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    startTransition(() => {
      staffLogout();
      resetMaStore();
      navigate('/login', { replace: true });
    });
  }

  const todayKey = offsetDateKey(0);
  const badgeCounts = {
    pending: pendingBookings(appointments).length,
    contact: needsContact(appointments).length,
    triage: awaitingTriage(appointments, getVisit, todayKey).length,
  };

  return (
    <div className="pc-site ma-shell">
      <div className="container">
        <div className="d-lg-none mb-3 ma-no-print">
          <div className="ma-mobile-header justify-content-between flex-wrap">
            <div className="d-flex align-items-center gap-3">
              <span className="ma-brand-icon">
                <i className="bi bi-heart-pulse-fill" />
              </span>
              <div>
                <div className="mitr fs-5 lh-sm">ผู้ช่วยสัตวแพทย์</div>
                <div className="small text-muted">คลินิก PetCare</div>
              </div>
            </div>
            <div className="d-flex align-items-center gap-2 ms-auto">
              {currentStaff && (
                <span className="small fw-medium">
                  <i className="bi bi-person-circle me-1 text-sky" />
                  {currentStaff.name}
                </span>
              )}
              <button type="button" className="btn btn-soft btn-sm" onClick={handleLogout}>
                <i className="bi bi-box-arrow-right me-1" />
                ออกจากระบบ
              </button>
            </div>
          </div>
          <nav className="pill-tabs ma-mobile-nav" aria-label="เมนูผู้ช่วยสัตวแพทย์">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `ma-mobile-link${isActive ? ' active' : ''}`}
              >
                <i className={`bi ${item.icon}`} />
                <span>{item.label}</span>
                <NavBadges badgeType={item.badgeType} counts={badgeCounts} />
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="ma-layout">
          <aside className="ma-sidebar d-none d-lg-block ma-no-print">
            <div className="ma-brand">
              <span className="ma-brand-icon">
                <i className="bi bi-heart-pulse-fill" />
              </span>
              <div>
                <div className="mitr fs-5 lh-sm">ผู้ช่วยสัตวแพทย์</div>
                <div className="small text-muted">คลินิก PetCare</div>
              </div>
            </div>
            <nav className="ma-nav" aria-label="เมนูผู้ช่วยสัตวแพทย์">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `ma-nav-link${isActive ? ' active' : ''}`}
                >
                  <i className={`bi ${item.icon}`} />
                  <span>{item.label}</span>
                  <NavBadges badgeType={item.badgeType} counts={badgeCounts} alignEnd />
                </NavLink>
              ))}
            </nav>

            <div className="ma-sidebar-footer">
              {currentStaff && (
                <div className="small fw-medium px-2 d-flex align-items-center gap-2 text-truncate" title={currentStaff.name}>
                  <i className="bi bi-person-circle text-sky flex-shrink-0" />
                  <span className="text-truncate">{currentStaff.name}</span>
                </div>
              )}
              <button type="button" className="btn btn-soft btn-sm w-100" onClick={handleLogout}>
                <i className="bi bi-box-arrow-right me-1" />
                ออกจากระบบ
              </button>
            </div>
          </aside>

          <div className="ma-content">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
