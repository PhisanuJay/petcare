import { useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { setAdoptionOpsBearer } from '../../adoption/api.js';
import '../../adoption/adoptionStaff.css';

const TABS = [
  { to: '/admin/adoption', label: 'ภาพรวม', end: true },
  { to: '/admin/adoption/animals', label: 'ประกาศสัตว์' },
  { to: '/admin/adoption/requests', label: 'คำขอรับเลี้ยง' },
  { to: '/admin/adoption/history', label: 'ประวัติ' },
];

/**
 * โต๊ะหาบ้านใน Hotel Admin — ใช้ Bearer ของแอดมินโรงแรมเรียก /api/adoption/staff/*
 */
export default function HotelAdoptionOutlet() {
  const { authToken } = useAuth();

  useEffect(() => {
    setAdoptionOpsBearer(authToken);
    return () => setAdoptionOpsBearer('');
  }, [authToken]);

  return (
    <div className="hotel-adoption-ops">
      <nav className="hotel-adoption-tabs" aria-label="เมนูหาบ้าน">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) => `hotel-adoption-tab${isActive ? ' is-active' : ''}`}
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <div className="hotel-adoption-ops__body adoption-staff-content-inner">
        <Outlet />
      </div>
    </div>
  );
}
