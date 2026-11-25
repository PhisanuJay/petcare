import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ADOPTION_API_URL, ADOPTION_STAFF_TOKEN_KEY } from './api.js';

export default function AdoptionStaffGate() {
  const [access, setAccess] = useState('checking');
  const [error, setError] = useState('');
  const location = useLocation();

  useEffect(() => {
    const token = sessionStorage.getItem(ADOPTION_STAFF_TOKEN_KEY);
    if (!token) {
      setAccess('anonymous');
      return undefined;
    }

    const controller = new AbortController();
    async function checkSession() {
      try {
        const response = await fetch(`${ADOPTION_API_URL}/staff/session`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const result = await response.json();
        if (response.status === 401) {
          sessionStorage.removeItem(ADOPTION_STAFF_TOKEN_KEY);
          setAccess('anonymous');
          return;
        }
        if (!response.ok) throw new Error(result.error || 'ตรวจสอบสิทธิ์ไม่สำเร็จ');
        setAccess('allowed');
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          setError(requestError.message || 'เชื่อมต่อ Backend ไม่สำเร็จ');
          setAccess('error');
        }
      }
    }

    checkSession();
    return () => controller.abort();
  }, []);

  if (access === 'checking') {
    return <p className="adoption-staff-state" role="status">กำลังตรวจสอบสิทธิ์พนักงาน...</p>;
  }
  if (access === 'anonymous') {
    return <Navigate to="/adoption/login" state={{ from: location }} replace />;
  }
  if (access === 'error') {
    return (
      <div className="adoption-staff-state" role="alert">
        <p>{error}</p>
        <button className="btn btn-soft" type="button" onClick={() => window.location.reload()}>
          ลองอีกครั้ง
        </button>
      </div>
    );
  }
  return <Outlet />;
}
