import { startTransition } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import StaffWorkspace from '../../../shared/layouts/StaffWorkspace.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { offsetDateKey } from '../data/constants.js';
import { resetMaStore } from '../data/maStore.js';
import { awaitingTriage, needsContact, pendingBookings } from '../data/selectors.js';
import { useAppointments } from '../data/useAppointments.js';
import { useVisits } from '../data/useVisits.js';
import '../ma.css';

const NAV_BASE = [
  { to: '/clinic-admin', label: 'แดชบอร์ด', icon: 'bi-speedometer2', end: true },
  { to: '/clinic-admin/appointments', label: 'นัดหมาย', icon: 'bi-calendar2-check' },
  { to: '/clinic-admin/patients', label: 'สัตว์เลี้ยง', icon: 'bi-clipboard2-heart' },
];

export default function MedicalAssistantLayout() {
  const { appointments } = useAppointments();
  const { getVisit } = useVisits();
  const { currentStaff, staffLogout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    startTransition(() => {
      staffLogout();
      resetMaStore();
      navigate('/', { replace: true });
    });
  }

  const todayKey = offsetDateKey(0);
  const pending = pendingBookings(appointments).length;
  const contact = needsContact(appointments).length;
  const triage = awaitingTriage(appointments, getVisit, todayKey).length;

  const navItems = NAV_BASE.map((item) => {
    if (item.badgeType === 'booking') {
      return { ...item, badge: pending, badgeWarn: contact };
    }
    if (item.badgeType === 'triage') {
      return { ...item, badge: triage };
    }
    return item;
  });

  return (
    <div className="ma-shell">
      <StaffWorkspace
        brandTitle="PetCare"
        brandSubtitle="ผู้ช่วยสัตวแพทย์"
        brandTo="/clinic-admin"
        navItems={navItems}
        userName={currentStaff?.name || 'ผู้ช่วยสัตวแพทย์'}
        userRoleLabel="Medical Assistant"
        onLogout={handleLogout}
        kicker="Medical Assistant"
      >
        <div className="ma-content ma-content--workspace">
          <Outlet />
        </div>
      </StaffWorkspace>
    </div>
  );
}
