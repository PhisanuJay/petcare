import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { ownerRequest } from './api.js';

/**
 * Animals waiting for a home (`/api/pet-owner/adoption/animals`) and the logged-in user's
 * adoption requests (`/api/pet-owner/adoption/requests`).
 */
export function useAdoption() {
  const { currentUser } = useAuth();
  const ownerId = currentUser?.id ?? null;
  const [animals, setAnimals] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(Boolean(ownerId));
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!ownerId) return;
    setLoading(true);
    setError('');
    try {
      const [a, r] = await Promise.all([
        ownerRequest(ownerId, '/adoption/animals'),
        ownerRequest(ownerId, '/adoption/requests'),
      ]);
      setAnimals(a);
      setRequests(r);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const addRequest = useCallback(
    async (data) => {
      const request = await ownerRequest(ownerId, '/adoption/requests', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      setRequests((list) => [request, ...list]);
      return request;
    },
    [ownerId],
  );

  const cancelRequest = useCallback(
    async (id) => {
      const request = await ownerRequest(ownerId, `/adoption/requests/${id}/cancel`, { method: 'POST' });
      setRequests((list) => list.map((r) => (r.id === id ? request : r)));
      return request;
    },
    [ownerId],
  );

  return { animals, requests, loading, error, reload, addRequest, cancelRequest };
}
