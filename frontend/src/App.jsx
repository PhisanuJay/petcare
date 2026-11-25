import { Navigate, Route, Routes } from 'react-router-dom';
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
import { petOwnerRoutes, adminTransportRoutes, driverTransportRoutes } from './routes/roleRoutes.jsx';
import HotelCctvMount from './features/super-admin/HotelCctvMount.jsx';
import AccountingPage from './features/accounting/AccountingPage.jsx';

/**
 * Customer site for owners; Admin/Driver use StaffShell with role guards.
 * Super Admin Pet Hotel CCTV mounts at /super-admin/* (from Super-Admin branch).
 */
export default function App() {
  return (
    <Routes>
      {/* Super Admin — Pet Hotel CCTV (ฟ่าง) */}
      <Route path="/super-admin/*" element={<HotelCctvMount />} />

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
          <Route path="admin" element={<StaffShell variant="admin" />}>
            {adminTransportRoutes}
          </Route>
        </Route>
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<RequireRole roles={[ROLES.accountant]} />}>
          <Route path="accounting" element={<AccountingPage />} />
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
