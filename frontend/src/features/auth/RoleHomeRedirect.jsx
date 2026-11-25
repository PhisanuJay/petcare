import { Navigate } from 'react-router-dom';
import HomePage from '../../shared/pages/HomePage.jsx';
import { useAuth } from './AuthContext.jsx';
import { ROLES, homePathForRole } from './roles.js';

/** `/` — staff go to their dashboard; guests/owners see the marketing home. */
export default function RoleHomeRedirect() {
  const { currentUser } = useAuth();
<<<<<<< HEAD
  if (
    currentUser?.role === ROLES.admin
    || currentUser?.role === ROLES.driver
    || currentUser?.role === ROLES.finance
  ) {
=======
  if (currentUser?.role === ROLES.admin || currentUser?.role === ROLES.driver) {
>>>>>>> origin/Admin-transport
    return <Navigate to={homePathForRole(currentUser.role)} replace />;
  }
  return <HomePage />;
}
