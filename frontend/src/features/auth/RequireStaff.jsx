import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';

/** Only a logged-in staff member with `role` may open the pages inside; others go to the login page. */
export default function RequireStaff({ role }) {
  const { currentStaff } = useAuth();
  const location = useLocation();

  if (!currentStaff || currentStaff.role !== role) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <Outlet />;
}
