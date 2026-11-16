import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { ownerRequest } from './api.js';

/** Pet transport requests of the logged-in user (`/api/pet-owner/transport/requests`). */
export function useTransportRequests() {
  const { currentUser } = useAuth();
  const ownerId = currentUser?.id ?? null;
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(Boolean(ownerId));
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!ownerId) return;
    setLoading(true);
    setError('');
    try {
      setRequests(await ownerRequest(ownerId, '/transport/requests'));
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
      const request = await ownerRequest(ownerId, '/transport/requests', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      setRequests((list) => [...list, request]);
      return request;
    },
    [ownerId],
  );

  const cancelRequest = useCallback(
    async (id) => {
      const request = await ownerRequest(ownerId, `/transport/requests/${id}/cancel`, { method: 'POST' });
      setRequests((list) => list.map((r) => (r.id === id ? request : r)));
      return request;
    },
    [ownerId],
  );

  return { requests, loading, error, reload, addRequest, cancelRequest };
}
