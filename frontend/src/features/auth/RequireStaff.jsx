import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';

/** Only a logged-in staff member with `role` (string or list) may open nested pages. */
export default function RequireStaff({ role, roles }) {
  const { currentStaff } = useAuth();
  const location = useLocation();
  const allowed = roles || (Array.isArray(role) ? role : [role]);

  if (!currentStaff || !allowed.includes(currentStaff.role)) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <Outlet />;
}
