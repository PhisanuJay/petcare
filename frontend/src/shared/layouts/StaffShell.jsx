import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext.jsx';
import { ROLES } from '../../features/auth/roles.js';
import { useTransport } from '../../features/pet-transport/useTransport.js';
import '../../features/pet-transport/transport.css';
import '../../features/pet-transport/driver-refresh.css';
import StaffWorkspace from './StaffWorkspace.jsx';

/** Fallback admin links — primary hotel shell is HotelAdminLayout. */
const ADMIN_LINKS = [
  { to: '/admin/stays', label: 'ใบจอง / เข้าพัก', icon: 'bi-journal-check' },
  { to: '/admin/cctv', label: 'CCTV / มอบสิทธิ์', icon: 'bi-camera-video' },
  { to: '/admin/transport', label: 'รับส่ง', icon: 'bi-truck', end: true },
  { to: '/admin/transport/drivers', label: 'คนขับ', icon: 'bi-person-badge' },
];

const DRIVER_LINKS = [
  { to: '/pet-transport', label: 'ตารางงาน', icon: 'bi-calendar2-week', end: true },
  { to: '/pet-transport/history', label: 'ส่งแล้ว', icon: 'bi-check2-circle' },
  { to: '/pet-transport/notifications', label: 'แจ้งเตือน', icon: 'bi-bell' },
  { to: '/pet-transport/profile', label: 'โปรไฟล์', icon: 'bi-person' },
];

function driverPageTitle(path) {
  if (path.includes('/history')) return 'ส่งแล้ว';
  if (path.includes('/notifications')) return 'แจ้งเตือน';
  if (path.includes('/profile')) return 'โปรไฟล์';
  if (path.includes('/jobs/')) return 'รายละเอียดงาน';
  return 'ตารางงาน';
}

export default function StaffShell({ variant }) {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const path = useLocation().pathname;
  const isAdmin = variant === 'admin' || currentUser?.role === ROLES.admin;

  if (!isAdmin) {
    return <DriverShell currentUser={currentUser} path={path} logout={logout} navigate={navigate} />;
  }

  const name = `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || 'แอดมิน';

  function doLogout() {
    logout();
    navigate('/', { replace: true });
  }

  return (
    <StaffWorkspace
      brandTitle="PetCare"
      brandSubtitle="แอดมินโรงแรม"
      brandTo="/admin/stays"
      navItems={ADMIN_LINKS}
      navLabel="งานโรงแรม"
      userName={name}
      userRoleLabel="Hotel Admin"
      onLogout={doLogout}
      kicker="Hotel Admin"
    >
      <Outlet />
    </StaffWorkspace>
  );
}

function DriverShell({ currentUser, path, logout, navigate }) {
  const { driverUnreadCount, ensureUpcomingReminders } = useTransport();
  const name = `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || 'คนขับ';
  const unread = driverUnreadCount(currentUser?.id);
  const vehicle = [currentUser?.vehicle, currentUser?.plateNumber].filter(Boolean).join(' · ') || 'คนขับ';

  useEffect(() => {
    if (currentUser?.id) ensureUpcomingReminders(currentUser.id);
    const timer = window.setInterval(() => {
      if (currentUser?.id) ensureUpcomingReminders(currentUser.id);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [currentUser?.id, ensureUpcomingReminders]);

  function doLogout() {
    logout();
    navigate('/', { replace: true });
  }

  const onJobs = path === '/pet-transport' || path.includes('/jobs/');
  const navItems = DRIVER_LINKS.map((item) => {
    if (item.to === '/pet-transport') return { ...item, end: false, active: onJobs };
    if (item.to === '/pet-transport/notifications') {
      return { ...item, badge: unread > 0 ? (unread > 9 ? '9+' : unread) : null };
    }
    return item;
  });

  return (
    <StaffWorkspace
      brandTitle="PetCare"
      brandSubtitle="โรงแรม · คนขับ"
      brandTo="/pet-transport"
      navItems={navItems}
      navLabel="งานรับส่ง"
      userName={name}
      userRoleLabel={vehicle}
      userAvatar={currentUser?.avatar}
      onLogout={doLogout}
      kicker="Hotel · Driver"
      title={driverPageTitle(path)}
      whoTo="/pet-transport/profile"
    >
      <Outlet />
    </StaffWorkspace>
  );
}
