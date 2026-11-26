import { useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { ROLES } from '../../auth/roles.js';
import { setAdoptionOpsActorId, setAdoptionOpsBearer } from '../../adoption/api.js';
import '../../adoption/adoptionStaff.css';

const TABS = [
  { to: '/admin/adoption', label: 'ภาพรวม', end: true },
  { to: '/admin/adoption/animals', label: 'ประกาศสัตว์' },
  { to: '/admin/adoption/requests', label: 'คำขอรับเลี้ยง' },
  { to: '/admin/adoption/history', label: 'ประวัติ' },
];

/**
 * โต๊ะหาบ้านใน Hotel Admin — ใช้ Bearer + x-owner-id ของแอดมินโรงแรม
 * (x-owner-id สำคัญเมื่อ backend รีสตาร์ทแล้ว in-memory Bearer หาย)
 */
export default function HotelAdoptionOutlet() {
  const { authToken, currentUser } = useAuth();
  const token = typeof authToken === 'string' ? authToken : '';
  const actorId = currentUser?.role === ROLES.admin && currentUser?.id
    ? String(currentUser.id)
    : '';

  // เซ็ตก่อน child useEffect เพื่อไม่ให้ fetch แรกไม่มี credentials
  setAdoptionOpsBearer(token);
  setAdoptionOpsActorId(actorId);

  useEffect(() => {
    setAdoptionOpsBearer(token);
    setAdoptionOpsActorId(actorId);
    return () => {
      setAdoptionOpsBearer('');
      setAdoptionOpsActorId('');
    };
  }, [token, actorId]);

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
