import { startTransition } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import StaffWorkspace from '../../../shared/layouts/StaffWorkspace.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import '../clinic-admin.css';

const NAV_ITEMS = [
  { to: '/clinic-admin', label: 'ภาพรวม', icon: 'bi-speedometer2', end: true },
  { to: '/clinic-admin/appointments', label: 'นัดหมาย', icon: 'bi-calendar2-check' },
  { to: '/clinic-admin/patients', label: 'สัตว์เลี้ยง', icon: 'bi-clipboard2-heart' },
  { to: '/clinic-admin/staff', label: 'เจ้าหน้าที่', icon: 'bi-people' },
  { to: '/clinic-admin/schedule', label: 'ตารางเวร', icon: 'bi-calendar-week' },
  { to: '/clinic-admin/services', label: 'บริการและราคา', icon: 'bi-tag' },
  { to: '/clinic-admin/settings', label: 'ตั้งค่าคลินิก', icon: 'bi-sliders' },
  { to: '/clinic-admin/reports', label: 'รายงาน', icon: 'bi-bar-chart-line' },
];

export default function ClinicAdminLayout() {
  const { currentStaff, staffLogout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    startTransition(() => {
      staffLogout();
      navigate('/', { replace: true });
    });
  }

  return (
    <div className="ca-shell">
      <StaffWorkspace
        brandTitle="PetCare"
        brandSubtitle="แอดมินคลินิก"
        brandTo="/clinic-admin"
        navItems={NAV_ITEMS}
        userName={currentStaff?.name || 'แอดมินคลินิก'}
        userRoleLabel="แอดมินคลินิก"
        onLogout={handleLogout}
        kicker={false}
      >
        <div className="ca-content ca-content--workspace">
          <Outlet />
        </div>
      </StaffWorkspace>
    </div>
  );
}
