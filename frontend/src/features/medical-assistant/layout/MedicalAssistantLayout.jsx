import { NavLink, Outlet } from 'react-router-dom';
import { offsetDateKey } from '../data/constants.js';
import { awaitingTriage, pendingBookings } from '../data/selectors.js';
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
    badgeKey: 'pending',
  },
  {
    to: '/medical-assistant/medical-support',
    label: 'สนับสนุนการรักษา',
    icon: 'bi-bandaid',
    badgeKey: 'triage',
  },
];

export default function MedicalAssistantLayout() {
  const { appointments } = useAppointments();
  const { getVisit } = useVisits();

  const todayKey = offsetDateKey(0);
  const pendingCount = pendingBookings(appointments).length;
  const waitingTriageCount = awaitingTriage(appointments, getVisit, todayKey).length;

  const badgeCounts = {
    pending: pendingCount,
    triage: waitingTriageCount,
  };

  return (
    <div className="pc-site ma-shell">
      <div className="container">
        <div className="d-lg-none mb-3 ma-no-print">
          <div className="ma-mobile-header">
            <span className="ma-brand-icon">
              <i className="bi bi-heart-pulse-fill" />
            </span>
            <div>
              <div className="mitr fs-5 lh-sm">ผู้ช่วยสัตวแพทย์</div>
              <div className="small text-muted">คลินิก PetCare</div>
            </div>
          </div>
          <nav className="pill-tabs ma-mobile-nav" aria-label="เมนูผู้ช่วยสัตวแพทย์">
            {NAV_ITEMS.map((item) => {
              const count = item.badgeKey ? badgeCounts[item.badgeKey] : 0;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `ma-mobile-link${isActive ? ' active' : ''}`}
                >
                  <i className={`bi ${item.icon}`} />
                  <span>{item.label}</span>
                  {count > 0 && <span className="ma-nav-badge">{count}</span>}
                </NavLink>
              );
            })}
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
              {NAV_ITEMS.map((item) => {
                const count = item.badgeKey ? badgeCounts[item.badgeKey] : 0;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => `ma-nav-link${isActive ? ' active' : ''}`}
                  >
                    <i className={`bi ${item.icon}`} />
                    <span>{item.label}</span>
                    {count > 0 && <span className="ma-nav-badge ms-auto">{count}</span>}
                  </NavLink>
                );
              })}
            </nav>
          </aside>

          <div className="ma-content">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
