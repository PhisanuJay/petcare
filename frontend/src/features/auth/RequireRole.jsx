import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import { canAccessPath, homePathForRole, normalizeRole } from './roles.js';

/**
 * Must be nested under RequireAuth.
 * Redirects users to their role home when they open a forbidden path.
 */
export default function RequireRole({ roles }) {
  const { currentUser } = useAuth();
  const location = useLocation();
  const allowed = Array.isArray(roles) ? roles : [roles];
  const role = normalizeRole(currentUser?.role);

  if (!allowed.includes(role)) {
    return <Navigate to={homePathForRole(role)} replace />;
  }

  if (!canAccessPath(role, location.pathname)) {
    return <Navigate to={homePathForRole(role)} replace />;
  }

  return <Outlet />;
}
