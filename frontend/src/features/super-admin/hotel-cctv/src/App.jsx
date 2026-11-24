import { Navigate, Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from './api';
import { cctvPath } from './paths';
import Login from './pages/Login';
import AdminCameras from './pages/AdminCameras';
import CustomerLive from './pages/CustomerLive';

function Gate() {
  const [target, setTarget] = useState('');

  useEffect(() => {
    api('/api/auth/me')
      .then((data) => setTarget(cctvPath(data.user.role === 'customer' ? '/watch' : '/admin')))
      .catch(() => setTarget(cctvPath('/login')));
  }, []);

  if (!target) return <main className="center-page">กำลังโหลด</main>;
  return <Navigate to={target} replace />;
}

/** Pet Hotel CCTV — Super Admin (ฟ่าง / Xsup404) */
export default function App() {
  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route path="admin" element={<AdminCameras />} />
      <Route path="watch" element={<CustomerLive />} />
      <Route index element={<Gate />} />
      <Route path="*" element={<Gate />} />
    </Routes>
  );
}
