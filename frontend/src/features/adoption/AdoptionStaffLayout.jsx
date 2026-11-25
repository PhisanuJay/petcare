import { NavLink, Outlet } from 'react-router-dom';
import './adoptionStaff.css';

export default function AdoptionStaffLayout() {
  return (
    <div className="adoption-staff">
      <aside className="adoption-staff-sidebar">
        <nav className="adoption-staff-nav" aria-label="เมนูพนักงานหาบ้าน">
          <NavLink to="/adoption" end>ภาพรวม</NavLink>
          <NavLink to="/adoption/requests">คำร้องขอรับเลี้ยง</NavLink>
        </nav>
      </aside>
      <div className="adoption-staff-content">
        <Outlet />
      </div>
    </div>
  );
}
