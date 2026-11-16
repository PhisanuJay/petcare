import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { ownerRequest } from './api.js';

/** The logged-in user's cat hotel stays that can be watched on CCTV (`/api/pet-owner/cctv`). */
export function useCctv() {
  const { currentUser } = useAuth();
  const ownerId = currentUser?.id ?? null;
  const [stays, setStays] = useState([]);
  const [loading, setLoading] = useState(Boolean(ownerId));
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!ownerId) return;
    setLoading(true);
    setError('');
    try {
      setStays(await ownerRequest(ownerId, '/cctv'));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { stays, loading, error, reload };
}
