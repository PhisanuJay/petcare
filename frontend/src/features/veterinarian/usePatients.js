import { useCallback, useEffect, useState } from 'react';
import { vetRequest } from './vetApi.js';

/** Load a list from the Veterinarian API; `reload` fetches it again. */
function useVetList(url) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await vetRequest(url));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { items, loading, error, reload };
}

/** All pets (patients of the clinic) with visit statistics and the owner's name, from `/api/veterinarian/patients`. */
export function usePatients() {
  const { items, loading, error, reload } = useVetList('/patients');
  return { patients: items, loading, error, reload };
}

/**
 * All customers (owners who registered pets) with how to reach them, visit totals and their pets,
 * from `/api/veterinarian/owners`.
 */
export function useOwners() {
  const { items, loading, error, reload } = useVetList('/owners');
  return { owners: items, loading, error, reload };
}

/** The full record of one pet, with its owner's contact details (`id` may be empty: then nothing is loaded). */
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
