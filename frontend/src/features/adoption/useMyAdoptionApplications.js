import { useCallback, useEffect, useState } from 'react';
import { ADOPTION_API_URL } from './api.js';

export function useMyAdoptionApplications(authToken) {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!authToken) {
      setApplications([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${ADOPTION_API_URL}/applications/mine`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'โหลดคำขอไม่สำเร็จ');
      setApplications(Array.isArray(result.applications) ? result.applications : []);
    } catch (err) {
      setError(err.message || 'เชื่อมต่อระบบไม่สำเร็จ');
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    reload();
  }, [reload]);

  const cancelApplication = useCallback(async (applicationId) => {
    if (!authToken) throw new Error('กรุณาเข้าสู่ระบบ');
    const response = await fetch(
      `${ADOPTION_API_URL}/applications/${encodeURIComponent(applicationId)}/cancel`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'ยกเลิกไม่สำเร็จ');
    setApplications((current) =>
      current.map((item) => (item.id === applicationId
        ? { ...item, status: 'cancelled' }
        : item)),
    );
    return result.application;
  }, [authToken]);

  return { applications, loading, error, reload, cancelApplication };
}