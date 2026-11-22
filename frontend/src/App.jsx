import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './shared/layouts/AppShell.jsx';
import HomePage from './shared/pages/HomePage.jsx';
import { roleRoutes } from './routes/roleRoutes.jsx';
import HotelCctvMount from './features/super-admin/HotelCctvMount.jsx';

/**
 * App entry — role routes from Page 17 sitemap.
 * Super Admin is Pet Hotel CCTV (mounted outside the skeleton shell).
 */
export default function App() {
  return (
    <Routes>
      <Route path="/super-admin/*" element={<HotelCctvMount />} />
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        {roleRoutes}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
