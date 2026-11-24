import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './shared/layouts/AppShell.jsx';
import CustomerLayout from './shared/layouts/CustomerLayout.jsx';
import StaffShell from './shared/layouts/StaffShell.jsx';
import HomePage from './shared/pages/HomePage.jsx';
import LoginPage from './features/auth/pages/Login.jsx';
import RegisterPage from './features/auth/pages/Register.jsx';
import RequireAuth from './features/auth/RequireAuth.jsx';
import RequireRole from './features/auth/RequireRole.jsx';
import RoleHomeRedirect from './features/auth/RoleHomeRedirect.jsx';
import ProfilePage from './features/profile/pages/Profile.jsx';
import { ROLES } from './features/auth/roles.js';
import { petOwnerRoutes, roleRoutes, adminTransportRoutes } from './routes/roleRoutes.jsx';

/**
 * Customer site + Admin Pet Transport booking management.
 */
export default function App() {
  return (
    <Routes>
      <Route element={<CustomerLayout />}>
        <Route index element={<RoleHomeRedirect />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<RequireRole roles={[ROLES.owner]} />}>
            <Route path="profile" element={<ProfilePage />} />
            {petOwnerRoutes}
          </Route>
        </Route>
        <Route path="home" element={<HomePage />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<RequireRole roles={[ROLES.admin]} />}>
          <Route path="admin" element={<StaffShell />}>
            {adminTransportRoutes}
          </Route>
        </Route>
      </Route>

      <Route element={<AppShell />}>{roleRoutes}</Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
