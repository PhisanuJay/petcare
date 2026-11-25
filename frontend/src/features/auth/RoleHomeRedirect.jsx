import { Navigate } from 'react-router-dom';
import HomePage from '../../shared/pages/HomePage.jsx';
import { useAuth } from './AuthContext.jsx';
import { ROLES, homePathForRole } from './roles.js';

/** `/` — staff go to their dashboard; guests/owners see the marketing home. */
export default function RoleHomeRedirect() {
  const { currentUser } = useAuth();

  if (
    currentUser?.role === ROLES.admin
    || currentUser?.role === ROLES.driver
    || currentUser?.role === ROLES.accountant
    || currentUser?.role === ROLES.finance
  ) {
    return <Navigate to={homePathForRole(currentUser.role)} replace />;
  }

  return <HomePage />;
}
