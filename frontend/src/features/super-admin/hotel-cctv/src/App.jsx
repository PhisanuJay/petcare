import { Navigate, Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from './api';
import { cctvPath } from './paths';
import AdminCameras from './pages/AdminCameras';
import CustomerLive from './pages/CustomerLive';

const MAIN_LOGIN = '/login?next=/super-admin';

function Gate() {
  const [target, setTarget] = useState('');

  useEffect(() => {
    api('/api/auth/me')
      .then((data) => setTarget(cctvPath(data.user.role === 'customer' ? '/watch' : '/admin')))
      .catch(() => setTarget(MAIN_LOGIN));
  }, []);

  if (!target) return <main className="center-page">กำลังโหลด</main>;
  return <Navigate to={target} replace />;
}

/** Pet Hotel CCTV — Super Admin (ฟ่าง / Xsup404) — login ใช้หน้า Login หลักของ PetCare */
export default function App() {
  return (
    <Routes>
      <Route path="login" element={<Navigate to={MAIN_LOGIN} replace />} />
      <Route path="admin" element={<AdminCameras />} />
      <Route path="watch" element={<CustomerLive />} />
      <Route index element={<Gate />} />
      <Route path="*" element={<Gate />} />
    </Routes>
  );
}
