import { Navigate, Route, Routes } from 'react-router-dom';
import CustomerLayout from './shared/layouts/CustomerLayout.jsx';
import StaffShell from './shared/layouts/StaffShell.jsx';
import HomePage from './shared/pages/HomePage.jsx';
import FindHomePage from './features/adoption/pages/FindHome.jsx';
import LoginPage from './features/auth/pages/Login.jsx';
import RegisterPage from './features/auth/pages/Register.jsx';
import RequireAuth from './features/auth/RequireAuth.jsx';
import RequireRole from './features/auth/RequireRole.jsx';
import RoleHomeRedirect from './features/auth/RoleHomeRedirect.jsx';
import { ROLES } from './features/auth/roles.js';
import ProfilePage from './features/profile/pages/Profile.jsx';
import AccountingPage from './features/accounting/AccountingPage.jsx';
import HotelCctvMount from './features/super-admin/HotelCctvMount.jsx';
import { adoptionStaffRoutes, adminTransportRoutes, driverTransportRoutes, petOwnerRoutes, roleRoutes } from './routes/roleRoutes.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/super-admin/*" element={<HotelCctvMount />} />

      <Route element={<CustomerLayout />}>
        <Route index element={<RoleHomeRedirect />} />
        <Route path="find-home" element={<FindHomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        {adoptionStaffRoutes}
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
        <Route element={<RequireRole roles={[ROLES.accountant]} />}>
          <Route path="accounting" element={<AccountingPage />} />
        </Route>
        <Route element={<RequireRole roles={[ROLES.driver]} />}>
          <Route path="pet-transport" element={<StaffShell variant="driver" />}>
            {driverTransportRoutes}
          </Route>
        </Route>
      </Route>

      {roleRoutes}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
