import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './shared/layouts/AppShell.jsx';
import HomePage from './shared/pages/HomePage.jsx';
import { roleRoutes } from './routes/roleRoutes.jsx';

/**
 * App entry — wires role-based routes from Page 17 sitemap.
 * Each role lives under /src/features/<role>/ so work stays separated.
 */
export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        {roleRoutes}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
