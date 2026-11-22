import { Navigate, Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from './api';
import Login from './pages/Login';
import AdminCameras from './pages/AdminCameras';
import CustomerLive from './pages/CustomerLive';

function Gate() {
  const [target, setTarget] = useState('');

  useEffect(() => {
    api('/api/auth/me')
      .then((data) => setTarget(data.user.role === 'customer' ? '/watch' : '/admin'))
      .catch(() => setTarget('/login'));
  }, []);

  if (!target) return <main className="center-page">กำลังโหลด</main>;
  return <Navigate to={target} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/admin" element={<AdminCameras />} />
      <Route path="/watch" element={<CustomerLive />} />
      <Route path="*" element={<Gate />} />
    </Routes>
  );
}
