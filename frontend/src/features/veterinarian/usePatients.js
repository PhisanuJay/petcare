import { useCallback, useEffect, useState } from 'react';
import { vetRequest } from './vetApi.js';

/** All patients (every registered pet) with visit statistics, from `/api/veterinarian/patients`. */
export function usePatients() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setPatients(await vetRequest('/patients'));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { patients, loading, error, reload };
}

/** The full record of one patient (`id` may be empty: then nothing is loaded). */
export function usePatient(id) {
  const [state, setState] = useState({ id: '', patient: null, error: '' });

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const patient = await vetRequest(`/patients/${id}`);
      setState({ id, patient, error: '' });
    } catch (err) {
      setState({ id, patient: null, error: err.message });
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Until the request for the current id finishes, report "loading" (stale data of another id is hidden).
  const ready = state.id === id;
  return {
    patient: ready ? state.patient : null,
    loading: Boolean(id) && !ready,
    error: ready ? state.error : '',
    reload: load,
  };
}
