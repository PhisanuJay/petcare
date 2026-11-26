import { NavLink, useLocation } from 'react-router-dom';
import './staff-workspace.css';

function initialOf(name) {
  const text = String(name || '').trim();
  return text ? text.slice(0, 1).toUpperCase() : '?';
}

function itemIsActive(item, pathname) {
  if (typeof item.active === 'boolean') return item.active;
  if (!item.to) return false;
  if (item.end) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function resolveTitle(navItems, pathname, title) {
  if (title) return title;
  const match = navItems.find((item) => itemIsActive(item, pathname));
  return match?.label || '';
}

function NavBadges({ item }) {
  if (!item.badge && !item.badgeWarn) return null;
  return (
    <>
      {item.badge ? <span className="staff-workspace__badge">{item.badge}</span> : null}
      {item.badgeWarn ? <span className="staff-workspace__badge is-warn">{item.badgeWarn}</span> : null}
    </>
  );
}

function NavItem({ item, pathname, className }) {
  const active = itemIsActive(item, pathname);
  const classes = `staff-workspace__link${active ? ' is-active' : ''}${className ? ` ${className}` : ''}`;
  const body = (
    <>
      {item.icon ? <i className={`bi ${item.icon}`} aria-hidden="true" /> : null}
      {item.Icon ? <item.Icon /> : null}
      <span>{item.label}</span>
      <NavBadges item={item} />
    </>
  );

  if (item.to) {
    return (
      <NavLink to={item.to} end={item.end} className={() => classes}>
        {body}
      </NavLink>
    );
  }

  return (
    <button type="button" className={classes} onClick={item.onClick}>
      {body}
    </button>
  );
}

/**
 * Shared staff shell (Super Admin visual language).
 * Pass route nav via `to`, or tab nav via `active` + `onClick`.
 */
export default function StaffWorkspace({
  brandTitle = 'PetCare',
  brandSubtitle = '',
  brandTo,
  brandImage = '/brand-mark.jpg',
  navItems = [],
  navLabel,
  userName = '',
  userRoleLabel = '',
  userAvatar,
  onLogout,
  kicker,
  title,
  whoTo,
  showMascot = true,
  mascotSrc = '/sidebar-mascot.jpg',
  children,
}) {
  const { pathname } = useLocation();
  const pageTitle = resolveTitle(navItems, pathname, title);
  const brandMark = (
    <span className="staff-workspace__brand-mark" aria-hidden="true">
      <img className="staff-workspace__brand-mark-art" src={brandImage} alt="" draggable="false" />
    </span>
  );

  const brandInner = (
    <>
      {brandMark}
      <div>
        <strong>{brandTitle}</strong>
        {brandSubtitle ? <small>{brandSubtitle}</small> : null}
      </div>
    </>
  );

  return (
    <div className="staff-workspace">
      <aside className="staff-workspace__sidebar">
        <div className="staff-workspace__sidebar-top">
          {brandTo ? (
            <NavLink className="staff-workspace__brand" to={brandTo}>
              {brandInner}
            </NavLink>
          ) : (
            <div className="staff-workspace__brand">{brandInner}</div>
          )}

          <nav className="staff-workspace__nav" aria-label="เมนูพนักงาน">
            {navLabel ? <p className="staff-workspace__nav-label">{navLabel}</p> : null}
            {navItems.map((item) => (
              item.type === 'label' || item.section ? (
                <p
                  key={`sec-${item.label || item.section}`}
                  className="staff-workspace__nav-label staff-workspace__nav-label--section"
                >
                  {item.label || item.section}
                </p>
              ) : (
                <NavItem key={item.to || item.id || item.label} item={item} pathname={pathname} />
              )
            ))}
          </nav>
        </div>

        <div className="staff-workspace__foot">
          {showMascot ? (
            <div className="staff-workspace__mascot" aria-hidden="true">
              <img src={mascotSrc} alt="" draggable="false" />
            </div>
          ) : null}
          <div className="staff-workspace__user">
            <span className="staff-workspace__avatar" aria-hidden="true">
              {userAvatar ? <img src={userAvatar} alt="" /> : initialOf(userName)}
            </span>
            <span className="staff-workspace__user-copy">
              <strong>{userName || 'พนักงาน'}</strong>
              <small>{userRoleLabel || brandSubtitle || 'Staff'}</small>
            </span>
            {onLogout ? (
              <button type="button" className="staff-workspace__logout" onClick={onLogout}>
                ออก
              </button>
            ) : null}
          </div>
        </div>
      </aside>

      <div className="staff-workspace__main">
        <div className="staff-workspace__mobile">
          <div className="staff-workspace__mobile-header">
            <div className="staff-workspace__mobile-brand">
              {brandMark}
              <div>
                <strong>{brandTitle}</strong>
                {brandSubtitle ? <small className="d-block text-muted">{brandSubtitle}</small> : null}
              </div>
            </div>
            {onLogout ? (
              <button type="button" className="staff-workspace__logout" onClick={onLogout} style={{ marginLeft: 0, background: '#1b253b', color: '#fff' }}>
                ออก
              </button>
            ) : null}
          </div>
          <nav className="staff-workspace__mobile-nav" aria-label="เมนูพนักงานมือถือ">
            {navItems.filter((item) => item.type !== 'label' && !item.section).map((item) => (
              <NavItem key={`m-${item.to || item.id || item.label}`} item={item} pathname={pathname} />
            ))}
          </nav>
        </div>

        <header className="staff-workspace__topbar">
          <div>
            {kicker === false ? null : (
              <p className="staff-workspace__kicker">{kicker || brandSubtitle || brandTitle}</p>
            )}
            <strong className="staff-workspace__title">{pageTitle}</strong>
          </div>
          {whoTo ? (
            <NavLink className="staff-workspace__who" to={whoTo}>
              <span className="staff-workspace__avatar" aria-hidden="true">
                {userAvatar ? <img src={userAvatar} alt="" /> : initialOf(userName)}
              </span>
              <div>
                <strong>{userName || 'พนักงาน'}</strong>
                <small>{userRoleLabel || brandSubtitle}</small>
              </div>
            </NavLink>
          ) : (
            <div className="staff-workspace__who">
              <span className="staff-workspace__avatar" aria-hidden="true">
                {userAvatar ? <img src={userAvatar} alt="" /> : initialOf(userName)}
              </span>
              <div>
                <strong>{userName || 'พนักงาน'}</strong>
                <small>{userRoleLabel || brandSubtitle}</small>
              </div>
            </div>
          )}
        </header>

        <div className="staff-workspace__content">{children}</div>
      </div>
    </div>
  );
}
