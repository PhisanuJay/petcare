import { startTransition, useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { memberTier, useAuth } from '../../features/auth/AuthContext.jsx';
import UserAvatar from '../components/UserAvatar.jsx';

const GUEST_MENU = [
  { to: '/', label: 'หน้าแรก', icon: 'bi-house-heart', end: true },
  { to: '/#services', label: 'บริการ', icon: 'bi-grid' },
  { to: '/#hotel', label: 'โรงแรมสัตว์', icon: 'bi-building' },
  { to: '/#adopt', label: 'หาบ้าน', icon: 'bi-house-add' },
  { to: '/#vets', label: 'สัตวแพทย์ของเรา', icon: 'bi-person-hearts' },
  { to: '/#promo', label: 'โปรโมชั่น', icon: 'bi-tag' },
  { to: '/#contact', label: 'ติดต่อเรา', icon: 'bi-telephone' },
];

const MEMBER_MENU = [
  { to: '/', label: 'หน้าแรก', icon: 'bi-house-heart', end: true },
  { to: '/#services', label: 'บริการ', icon: 'bi-grid' },
  { to: '/pet-owner/booking', label: 'จองนัดหมาย', icon: 'bi-calendar2-plus' },
  { to: '/pet-owner', label: 'นัดหมายของฉัน', icon: 'bi-calendar2-check', end: true },
  { to: '/pet-owner/my-pets', label: 'สัตว์เลี้ยงของฉัน', icon: 'bi-heart' },
  { to: '/pet-owner/medical', label: 'ประวัติ', icon: 'bi-journal-medical' },
  { to: '/pet-owner/cat-hotel', label: 'โรงแรมสัตว์', icon: 'bi-building' },
  { to: '/pet-owner/adoption', label: 'หาบ้าน', icon: 'bi-house-add' },
  { to: '/#promo', label: 'โปรโมชั่น', icon: 'bi-tag' },
];

function MenuLink({ item, onNavigate }) {
  const location = useLocation();
  const content = (
    <>
      <i className={`bi ${item.icon}`} />
      {item.label}
    </>
  );

  if (item.to.includes('#')) {
    const hash = item.to.slice(item.to.indexOf('#'));
    const active = location.pathname === '/' && location.hash === hash;
    return (
      <Link className={`nav-link ${active ? 'active' : ''}`} to={item.to} onClick={onNavigate}>
        {content}
      </Link>
    );
  }

  return (
    <NavLink
      className={({ isActive }) =>
        `nav-link ${isActive && !(item.to === '/' && location.hash) ? 'active' : ''}`
      }
      to={item.to}
      end={item.end}
      onClick={onNavigate}
    >
      {content}
    </NavLink>
  );
}

export default function CustomerNavbar() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.hash]);

  const menu = currentUser ? MEMBER_MENU : GUEST_MENU;
  const close = () => setOpen(false);

  function handleLogout() {
    navigate('/');
    // Router navigations run as transitions; batch logout with it so RequireAuth
    // does not redirect the protected page to /login first.
    startTransition(logout);
  }

  return (
    <div className="nav-shell">
      <div className="container">
        <nav className="navbar navbar-expand-xl pc-navbar">
          <Link className="navbar-brand d-flex align-items-center gap-2 ms-1" to="/">
            <span className="brand-logo"><i className="bi bi-balloon-heart-fill" /></span>
            <span className="brand-text">Pet<span>Care</span></span>
          </Link>
          <button
            className="navbar-toggler border-0 shadow-none"
            type="button"
            aria-label="เปิดเมนู"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <span className="navbar-toggler-icon" />
          </button>

          <div className={`collapse navbar-collapse ${open ? 'show' : ''}`}>
            <ul className={`navbar-nav mx-auto ${currentUser ? 'member-nav' : 'guest-nav'}`}>
              {menu.map((item) => (
                <li className="nav-item" key={item.to}>
                  <MenuLink item={item} onNavigate={close} />
                </li>
              ))}
            </ul>

            {currentUser ? (
              <div className="d-flex align-items-center gap-2 pb-2 pb-xl-0">
                <button className="bell" type="button" title="การแจ้งเตือน">
                  <i className="bi bi-bell-fill" />
                  <span className="dot" />
                </button>
                <div className="dropdown">
                  <button className="profile-btn dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                    <UserAvatar user={currentUser} />
                    <span className="small fw-medium">คุณ{currentUser.firstName}</span>
                  </button>
                  <ul className="dropdown-menu dropdown-menu-end">
                    <li className="px-3 py-2">
                      <div className="fw-medium">
                        {currentUser.firstName} {currentUser.lastName}
                      </div>
                      <div className="small text-muted">
                        สมาชิก {memberTier(currentUser.points)} · {currentUser.points ?? 0} แต้ม
                      </div>
                    </li>
                    <li>
                      <Link className="dropdown-item" to="/profile">
                        <i className="bi bi-person me-2" />โปรไฟล์
                      </Link>
                    </li>
                    <li>
                      <Link className="dropdown-item" to="/pet-owner/my-pets">
                        <i className="bi bi-heart me-2" />สัตว์เลี้ยงของฉัน
                      </Link>
                    </li>
                    <li><hr className="dropdown-divider" /></li>
                    <li>
                      <button type="button" className="dropdown-item text-danger" onClick={handleLogout}>
                        <i className="bi bi-box-arrow-right me-2" />ออกจากระบบ
                      </button>
                    </li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="d-flex gap-2 pb-2 pb-xl-0">
                <Link to="/login" className="btn btn-soft">เข้าสู่ระบบ</Link>
                <Link to="/register" className="btn btn-sky">สมัครสมาชิก</Link>
              </div>
            )}
          </div>
        </nav>
      </div>
    </div>
  );
}
