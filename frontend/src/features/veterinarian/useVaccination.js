import { useCallback, useEffect, useState } from 'react';
import { vetRequest } from './vetApi.js';

/** Save a vaccination for a patient (`/api/veterinarian/vaccination`). */
export const createVaccination = (petId, data) =>
  vetRequest('/vaccination', { method: 'POST', body: JSON.stringify({ ...data, petId }) });

/** Change a vaccination that the clinic wrote earlier. */
export const updateVaccination = (petId, recordId, data) =>
  vetRequest(`/vaccination/${petId}/${recordId}`, { method: 'PUT', body: JSON.stringify(data) });

/** Vaccines that are overdue or due within `days` days, for every patient. */
export function useDueVaccines(days = 30) {
  const [due, setDue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setDue(await vetRequest(`/vaccination/due?days=${days}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { due, loading, error, reload };
}
