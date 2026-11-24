import { NavLink } from 'react-router-dom';

export default function TransportSubnav({ items, title }) {
  return (
    <div className="tp-subnav">
      {title && <h2 className="tp-subnav__title">{title}</h2>}
      <nav className="tp-subnav__links" aria-label={title || 'เมนู'}>
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `tp-subnav__link ${isActive ? 'is-active' : ''}`}
          >
            {item.icon && <i className={`bi ${item.icon}`} />}
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
