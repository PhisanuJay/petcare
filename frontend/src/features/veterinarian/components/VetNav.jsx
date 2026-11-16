import { Link, NavLink } from 'react-router-dom';

const LINKS = [
  { to: '/veterinarian', label: 'ภาพรวม', end: true },
  { to: '/veterinarian/appointments', label: 'นัดหมาย' },
  { to: '/veterinarian/patients', label: 'คนไข้' },
  { to: '/veterinarian/medical-records', label: 'ประวัติการรักษา' },
  { to: '/veterinarian/vaccination', label: 'วัคซีน' },
  { to: '/veterinarian/reports', label: 'รายงาน' },
];

/** Flow navigation for the veterinarian pages (Page 17 sitemap order). */
export default function VetNav() {
  return (
    <nav className="d-flex flex-wrap gap-2 mb-4" aria-label="เมนูสัตวแพทย์">
      {LINKS.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.end}
          className={({ isActive }) => `btn btn-sm ${isActive ? 'btn-sky' : 'btn-soft'}`}
        >
          {l.label}
        </NavLink>
      ))}
      {import.meta.env.DEV && (
        <Link to="/pet-owner" className="btn btn-sm btn-outline-secondary ms-auto">
          <i className="bi bi-arrow-left me-1" />
          กลับหน้าเจ้าของ (เฉพาะตอน dev)
        </Link>
      )}
    </nav>
  );
}
