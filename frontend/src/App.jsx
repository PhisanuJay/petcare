import { Navigate, Route, Routes } from 'react-router-dom';
import CustomerLayout from './shared/layouts/CustomerLayout.jsx';
import StaffShell from './shared/layouts/StaffShell.jsx';
import HomePage from './shared/pages/HomePage.jsx';
import LoginPage from './features/auth/pages/Login.jsx';
import RegisterPage from './features/auth/pages/Register.jsx';
import RequireAuth from './features/auth/RequireAuth.jsx';
import RequireRole from './features/auth/RequireRole.jsx';
import ProfilePage from './features/profile/pages/Profile.jsx';
import { ROLES } from './features/auth/roles.js';
import { petOwnerRoutes, adminTransportRoutes, driverTransportRoutes } from './routes/roleRoutes.jsx';
import RoleHomeRedirect from './features/auth/RoleHomeRedirect.jsx';

/**
 * Customer site for owners; Admin/Driver use StaffShell with role guards.
 * Other Page-17 skeleton modules are omitted from public entry until their teams wire auth.
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
        {/* Keep HomePage available at /home for owners/guests if redirected */}
        <Route path="home" element={<HomePage />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<RequireRole roles={[ROLES.admin]} />}>
          <Route path="admin" element={<StaffShell variant="admin" />}>
            {adminTransportRoutes}
          </Route>
        </Route>
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<RequireRole roles={[ROLES.driver]} />}>
          <Route path="pet-transport" element={<StaffShell variant="driver" />}>
            {driverTransportRoutes}
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
