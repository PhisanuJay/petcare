import { Outlet, useNavigate, useOutletContext } from 'react-router-dom';
import StaffWorkspace from '../../shared/layouts/StaffWorkspace.jsx';
import { ADOPTION_STAFF_TOKEN_KEY } from './api.js';
import './adoptionStaff.css';

const NAV_ITEMS = [
  { to: '/adoption', label: 'ภาพรวม', icon: 'bi-speedometer2', end: true },
  { to: '/adoption/animals', label: 'ประกาศหาบ้าน', icon: 'bi-house-heart' },
  { to: '/adoption/requests', label: 'คำร้องขอรับเลี้ยง', icon: 'bi-journal-text' },
  { to: '/adoption/history', label: 'ประวัติรับเลี้ยง', icon: 'bi-clock-history' },
];

export default function AdoptionStaffLayout() {
  const { staff } = useOutletContext() || {};
  const navigate = useNavigate();
  const name = staff?.name || staff?.email || 'พนักงานหาบ้าน';

  function handleLogout() {
    sessionStorage.removeItem(ADOPTION_STAFF_TOKEN_KEY);
    navigate('/', { replace: true });
  }

  return (
    <StaffWorkspace
      brandTitle="หาบ้าน"
      brandSubtitle="Adoption Staff"
      brandTo="/adoption"
      navItems={NAV_ITEMS}
      userName={name}
      userRoleLabel={staff?.email || 'พนักงานหาบ้านสัตว์'}
      onLogout={handleLogout}
      kicker="PetCare Adoption"
    >
      <div className="adoption-staff-content-inner">
        <Outlet />
      </div>
    </StaffWorkspace>
  );
}
