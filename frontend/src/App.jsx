import { lazy, Suspense } from 'react';
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
import HotelAdminLayout from './features/hotel-admin/layout/HotelAdminLayout.jsx';
import HotelAdoptionOutlet from './features/hotel-admin/pages/HotelAdoptionOutlet.jsx';
import HotelStayDesk from './features/pet-owner/HotelStayDesk.jsx';
import StayAccessPanel from './features/super-admin/hotel-cctv/src/pages/StayAccessPanel.jsx';
import SuperAdminLayout from './features/super-admin/layout/SuperAdminLayout.jsx';
import SuperAdminDashboardPage from './features/super-admin/pages/Dashboard.jsx';
import SuperAdminUsersPage from './features/super-admin/pages/Users.jsx';
import SuperAdminReportsPage from './features/super-admin/pages/Reports.jsx';
import AdoptionDashboardPage from './features/adoption/pages/Dashboard.jsx';
import AnimalsPage from './features/adoption/pages/Animals.jsx';
import AdoptionRequestsPage from './features/adoption/pages/AdoptionRequests.jsx';
import RequestDetailPage from './features/adoption/pages/RequestDetail.jsx';
import AdoptionHistoryPage from './features/adoption/pages/AdoptionHistory.jsx';
import { adminTransportRoutes, driverTransportRoutes, petOwnerRoutes, roleRoutes } from './routes/roleRoutes.jsx';

const HotelCctvMount = lazy(() => import('./features/super-admin/HotelCctvMount.jsx'));

export default function App() {
  return (
    <Routes>
      <Route path="adoption/*" element={<Navigate to="/admin/adoption" replace />} />

      <Route element={<CustomerLayout />}>
        <Route index element={<RoleHomeRedirect />} />
        <Route path="find-home" element={<FindHomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route element={<RequireAuth />}>
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
        <Route element={<RequireRole roles={[ROLES.super_admin]} />}>
          <Route path="super-admin" element={<SuperAdminLayout />}>
            <Route index element={<SuperAdminDashboardPage />} />
            <Route path="users" element={<SuperAdminUsersPage />} />
            <Route path="reports" element={<SuperAdminReportsPage />} />
            <Route
              path="cctv/*"
              element={(
                <Suspense fallback={<main style={{ padding: 24 }}>กำลังโหลด CCTV...</main>}>
                  <HotelCctvMount />
                </Suspense>
              )}
            />
          </Route>
        </Route>
        <Route element={<RequireRole roles={[ROLES.admin]} />}>
          <Route path="admin" element={<HotelAdminLayout />}>
            <Route index element={<Navigate to="stays" replace />} />
            <Route path="stays" element={<HotelStayDesk />} />
            <Route path="cctv" element={<StayAccessPanel embedded />} />
            <Route path="adoption" element={<HotelAdoptionOutlet />}>
              <Route index element={<AdoptionDashboardPage />} />
              <Route path="animals" element={<AnimalsPage />} />
              <Route path="requests" element={<AdoptionRequestsPage />} />
              <Route path="requests/:requestId" element={<RequestDetailPage />} />
              <Route path="history" element={<AdoptionHistoryPage />} />
            </Route>
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
