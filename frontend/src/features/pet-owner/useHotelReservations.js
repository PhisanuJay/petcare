import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { ownerRequest } from './api.js';

/** Cat hotel reservations of the logged-in user (`/api/pet-owner/cat-hotel/reservations`). */
export function useHotelReservations() {
  const { currentUser } = useAuth();
  const ownerId = currentUser?.id ?? null;
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(Boolean(ownerId));
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!ownerId) return;
    setLoading(true);
    setError('');
    try {
      setReservations(await ownerRequest(ownerId, '/cat-hotel/reservations'));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const addReservation = useCallback(
    async (data) => {
      const reservation = await ownerRequest(ownerId, '/cat-hotel/reservations', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      setReservations((list) => [...list, reservation]);
      return reservation;
    },
    [ownerId],
  );

  const cancelReservation = useCallback(
    async (id) => {
      const reservation = await ownerRequest(ownerId, `/cat-hotel/reservations/${id}/cancel`, { method: 'POST' });
      setReservations((list) => list.map((r) => (r.id === id ? reservation : r)));
      return reservation;
    },
    [ownerId],
  );

  return { reservations, loading, error, reload, addReservation, cancelReservation };
}
