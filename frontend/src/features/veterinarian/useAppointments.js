import { useCallback, useEffect, useState } from 'react';
import { vetRequest } from './vetApi.js';

/**
 * Appointments for the veterinarian: one day (`date` = 'YYYY-MM-DD') or every day (`date` = '').
 * Each appointment is a pet owner's booking plus a `pet` summary.
 */
export function useAppointments(date) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setAppointments(await vetRequest(date ? `/appointments?date=${date}` : '/appointments'));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    reload();
  }, [reload]);

  const setStatus = useCallback(async (id, status, note = '') => {
    const updated = await vetRequest(`/appointments/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, note }),
    });
    setAppointments((list) => list.map((a) => (a.id === id ? updated : a)));
    return updated;
  }, []);

  return { appointments, loading, error, reload, setStatus };
}
