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
<<<<<<< HEAD
import {
  petOwnerRoutes,
  adminTransportRoutes,
  driverTransportRoutes,
  financeRoutes,
} from './routes/roleRoutes.jsx';
import HotelCctvMount from './features/super-admin/HotelCctvMount.jsx';
import AccountingPage from './features/accounting/AccountingPage.jsx';

/**
 * Customer site for owners; Admin/Driver/Finance use StaffShell with role guards.
 * Super Admin Pet Hotel CCTV mounts at /super-admin/* (from Super-Admin branch).
=======
import { petOwnerRoutes, roleRoutes, adminTransportRoutes } from './routes/roleRoutes.jsx';

/**
 * Customer site + Admin Pet Transport booking management.
>>>>>>> origin/Admin-transport
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
<<<<<<< HEAD
          <Route path="admin" element={<StaffShell variant="admin" />}>
=======
          <Route path="admin" element={<StaffShell />}>
>>>>>>> origin/Admin-transport
            {adminTransportRoutes}
          </Route>
        </Route>
      </Route>

<<<<<<< HEAD
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

      <Route element={<RequireAuth />}>
        <Route element={<RequireRole roles={[ROLES.finance]} />}>
          <Route path="finance" element={<StaffShell variant="finance" />}>
            {financeRoutes}
          </Route>
        </Route>
      </Route>

=======
      <Route element={<AppShell />}>{roleRoutes}</Route>
>>>>>>> origin/Admin-transport
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
