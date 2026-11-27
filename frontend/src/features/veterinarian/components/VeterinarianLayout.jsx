import { startTransition } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import StaffWorkspace from '../../../shared/layouts/StaffWorkspace.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';

const NAV_ITEMS = [
  { to: '/veterinarian', label: 'ภาพรวม', icon: 'bi-speedometer2', end: true },
  { to: '/veterinarian/appointments', label: 'นัดหมาย', icon: 'bi-calendar2-check' },
  { to: '/veterinarian/patients', label: 'ลูกค้า', icon: 'bi-people' },
  { to: '/veterinarian/medical-records', label: 'ประวัติการรักษา', icon: 'bi-journal-medical' },
  { to: '/veterinarian/vaccination', label: 'วัคซีน', icon: 'bi-capsule' },
  { to: '/veterinarian/reports', label: 'รายงาน', icon: 'bi-bar-chart-line' },
];

export default function VeterinarianLayout() {
  const { currentStaff, staffLogout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    startTransition(() => {
      staffLogout();
      navigate('/', { replace: true });
    });
  }

  return (
    <StaffWorkspace
      brandTitle="PetCare"
      brandSubtitle="สัตวแพทย์"
      brandTo="/veterinarian"
      navItems={NAV_ITEMS}
      userName={currentStaff?.name || 'สัตวแพทย์'}
      userRoleLabel="สัตวแพทย์"
      onLogout={handleLogout}
      kicker="PetCare Veterinarian"
    >
      <Outlet />
    </StaffWorkspace>
  );
}
