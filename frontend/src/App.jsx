import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './shared/layouts/AppShell.jsx';
import CustomerLayout from './shared/layouts/CustomerLayout.jsx';
import HomePage from './shared/pages/HomePage.jsx';
import LoginPage from './features/auth/pages/Login.jsx';
import RegisterPage from './features/auth/pages/Register.jsx';
import RequireAuth from './features/auth/RequireAuth.jsx';
import ProfilePage from './features/profile/pages/Profile.jsx';
<<<<<<< Updated upstream
import { petOwnerRoutes, roleRoutes } from './routes/roleRoutes.jsx';

/**
 * App entry — customer site (home, auth, profile, pet owner) uses CustomerLayout;
 * staff role modules from Page 17 keep the legacy AppShell.
 */
export default function App() {
  return (
    <Routes>
=======
import AccountingPage from './features/accounting/AccountingPage.jsx';
import { adoptionStaffRoutes, adminTransportRoutes, driverTransportRoutes, petOwnerRoutes, roleRoutes } from './routes/roleRoutes.jsx';

const HotelCctvMount = lazy(() => import('./features/super-admin/HotelCctvMount.jsx'));

export default function App() {
  return (
    <Routes>
      <Route
        path="/super-admin/*"
        element={(
          <Suspense fallback={<main style={{ padding: 24 }}>กำลังโหลด Super Admin...</main>}>
            <HotelCctvMount />
          </Suspense>
        )}
      />

>>>>>>> Stashed changes
      <Route element={<CustomerLayout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route element={<RequireAuth />}>
<<<<<<< Updated upstream
          <Route path="profile" element={<ProfilePage />} />
          {petOwnerRoutes}
=======
          <Route element={<RequireRole roles={[ROLES.owner, ROLES.find_home]} />}>
            <Route path="profile" element={<ProfilePage />} />
          </Route>
          <Route element={<RequireRole roles={[ROLES.owner]} />}>
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
>>>>>>> Stashed changes
        </Route>
      </Route>
      <Route element={<AppShell />}>{roleRoutes}</Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
