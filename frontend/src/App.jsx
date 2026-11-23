import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './shared/layouts/AppShell.jsx';
import CustomerLayout from './shared/layouts/CustomerLayout.jsx';
import HomePage from './shared/pages/HomePage.jsx';
import FindHomePage from './features/adoption/pages/FindHome.jsx';
import LoginPage from './features/auth/pages/Login.jsx';
import RegisterPage from './features/auth/pages/Register.jsx';
import RequireAuth from './features/auth/RequireAuth.jsx';
import ProfilePage from './features/profile/pages/Profile.jsx';
import { adoptionStaffRoutes, petOwnerRoutes, roleRoutes } from './routes/roleRoutes.jsx';

/**
 * App entry — the customer site and adoption staff use CustomerLayout;
 * other staff role modules from Page 17 keep the legacy AppShell.
 */
export default function App() {
  return (
    <Routes>
      <Route element={<CustomerLayout />}>
        <Route index element={<HomePage />} />
        <Route path="find-home" element={<FindHomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        {adoptionStaffRoutes}
        <Route element={<RequireAuth />}>
          <Route path="profile" element={<ProfilePage />} />
          {petOwnerRoutes}
        </Route>
      </Route>
      <Route element={<AppShell />}>{roleRoutes}</Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
