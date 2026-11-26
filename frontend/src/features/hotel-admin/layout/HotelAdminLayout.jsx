import { startTransition, useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import StaffWorkspace from '../../../shared/layouts/StaffWorkspace.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { ADMIN_SIDES } from '../../auth/roles.js';
import '../hotel-admin.css';

/** เมนูฝั่งโรงแรม — เข้าพัก / รับส่ง / หาบ้าน (ไม่แตกแอดมินยิบย่อย) */
const NAV_ITEMS = [
  { type: 'label', label: 'เข้าพัก' },
  { to: '/admin/stays', label: 'ใบจอง / เข้าพัก', icon: 'bi-journal-check' },
  { to: '/admin/cctv', label: 'CCTV / มอบสิทธิ์', icon: 'bi-camera-video' },
  { type: 'label', label: 'รับส่ง' },
  { to: '/admin/transport', label: 'แดชบอร์ด', icon: 'bi-truck', end: true },
  { to: '/admin/transport/bookings', label: 'รายการจอง', icon: 'bi-list-ul' },
  { to: '/admin/transport/drivers', label: 'คนขับ', icon: 'bi-person-badge' },
  { to: '/admin/transport/pricing', label: 'ราคา', icon: 'bi-tag' },
  { type: 'label', label: 'หาบ้าน' },
  { to: '/admin/adoption', label: 'ภาพรวมหาบ้าน', icon: 'bi-house-heart', end: true },
  { to: '/admin/adoption/animals', label: 'ประกาศสัตว์', icon: 'bi-card-image' },
  { to: '/admin/adoption/requests', label: 'คำขอรับเลี้ยง', icon: 'bi-inbox' },
];

function pageTitle(pathname) {
  if (pathname.startsWith('/admin/cctv')) return 'CCTV / มอบสิทธิ์กล้อง';
  if (pathname.startsWith('/admin/stays')) return 'ใบจอง / เข้าพัก';
  if (pathname.startsWith('/admin/adoption/animals')) return 'ประกาศหาบ้าน';
  if (pathname.startsWith('/admin/adoption/requests')) return 'คำขอรับเลี้ยง';
  if (pathname.startsWith('/admin/adoption/history')) return 'ประวัติรับเลี้ยง';
  if (pathname.startsWith('/admin/adoption')) return 'หาบ้าน';
  if (pathname.startsWith('/admin/transport/drivers')) return 'คนขับ';
  if (pathname.startsWith('/admin/transport/pricing')) return 'ราคารับส่ง';
  if (pathname.startsWith('/admin/transport/bookings')) return 'รายการจองรับส่ง';
  if (pathname.startsWith('/admin/transport/cancellations')) return 'คำขอยกเลิกรับส่ง';
  if (pathname.startsWith('/admin/transport')) return 'รับส่งสัตว์';
  return ADMIN_SIDES.hotel.label;
}

export default function HotelAdminLayout() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const name = useMemo(() => {
    const full = [currentUser?.firstName, currentUser?.lastName].filter(Boolean).join(' ').trim();
    return full || currentUser?.email?.split('@')[0] || ADMIN_SIDES.hotel.label;
  }, [currentUser]);

  const navItems = useMemo(() => NAV_ITEMS.map((item) => {
    if (item.to === '/admin/transport') {
      return {
        ...item,
        active: pathname === '/admin/transport' || pathname === '/admin/transport/',
      };
    }
    if (item.to === '/admin/adoption') {
      return {
        ...item,
        active: pathname === '/admin/adoption' || pathname === '/admin/adoption/',
      };
    }
    return item;
  }), [pathname]);

  function handleLogout() {
    startTransition(() => {
      fetch('/api/cctv-auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
      logout();
      navigate('/', { replace: true });
    });
  }

  return (
    <div className="hotel-admin-shell">
      <StaffWorkspace
        brandTitle="PetCare"
        brandSubtitle={ADMIN_SIDES.hotel.label}
        brandTo={ADMIN_SIDES.hotel.home}
        navItems={navItems}
        userName={name}
        userRoleLabel={ADMIN_SIDES.hotel.label}
        onLogout={handleLogout}
        kicker={false}
        title={pageTitle(pathname)}
      >
        <div className="hotel-admin-content">
          <Outlet />
        </div>
      </StaffWorkspace>
    </div>
  );
}
