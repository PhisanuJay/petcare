import { startTransition, useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import StaffWorkspace from '../../../shared/layouts/StaffWorkspace.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import '../super-admin.css';

const NAV_ITEMS = [
  { to: '/super-admin', label: 'ภาพรวม', icon: 'bi-speedometer2', end: true },
  { to: '/super-admin/users', label: 'ผู้ใช้', icon: 'bi-people' },
  { to: '/super-admin/reports', label: 'รายงาน', icon: 'bi-bar-chart-line' },
  { to: '/super-admin/cctv', label: 'โรงแรม CCTV', icon: 'bi-camera-video' },
];

function todayKicker() {
  const label = new Date().toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return `PetCare · ${label}`;
}

function pageTitle(pathname) {
  if (pathname.startsWith('/super-admin/users')) return 'ผู้ใช้';
  if (pathname.startsWith('/super-admin/reports')) return 'รายงาน';
  if (pathname.startsWith('/super-admin/cctv')) return 'โรงแรม CCTV';
  return 'ภาพรวม';
}

export default function SuperAdminLayout() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isCctv = pathname.startsWith('/super-admin/cctv');

  const name = useMemo(() => {
    const full = [currentUser?.firstName, currentUser?.lastName].filter(Boolean).join(' ').trim();
    if (full && full.toLowerCase() !== 'super admin') return full;
    return currentUser?.email?.split('@')[0] || 'ผู้ดูแล';
  }, [currentUser]);

  const kicker = useMemo(() => (
    isCctv ? 'PetCare · โมดูลโรงแรม CCTV' : todayKicker()
  ), [isCctv]);

  function handleLogout() {
    startTransition(() => {
      // ออกจาก session PetCare — CCTV cookie เคลียร์เมื่อเข้า login ใหม่ / หรือเรียก logout แยกในโมดูล
      fetch('/api/cctv-auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
      logout();
      navigate('/', { replace: true });
    });
  }

  return (
    <div className={`sa-shell${isCctv ? ' sa-shell--cctv' : ''}`}>
      <StaffWorkspace
        brandTitle="PetCare"
        brandSubtitle="ศูนย์ควบคุมระบบ"
        brandTo="/super-admin"
        navItems={NAV_ITEMS}
        navLabel="เมนูควบคุม"
        userName={name}
        userRoleLabel="ผู้ดูแลระบบ"
        onLogout={handleLogout}
        kicker={kicker}
        title={pageTitle(pathname)}
      >
        <div className={`sa-content${isCctv ? ' sa-content--cctv' : ''}`}>
          <Outlet />
        </div>
      </StaffWorkspace>
    </div>
  );
}
