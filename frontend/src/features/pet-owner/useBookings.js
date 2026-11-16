import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { ownerRequest } from './api.js';

/** Bookings of the logged-in user, stored by the backend (`/api/pet-owner/bookings`). */
export function useBookings() {
  const { currentUser } = useAuth();
  const ownerId = currentUser?.id ?? null;
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(Boolean(ownerId));
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!ownerId) return;
    setLoading(true);
    setError('');
    try {
      setBookings(await ownerRequest(ownerId, '/bookings'));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const addBooking = useCallback(
    async (data) => {
      const booking = await ownerRequest(ownerId, '/bookings', { method: 'POST', body: JSON.stringify(data) });
      setBookings((list) => [...list, booking]);
      return booking;
    },
    [ownerId],
  );

  const cancelBooking = useCallback(
    async (id) => {
      const booking = await ownerRequest(ownerId, `/bookings/${id}/cancel`, { method: 'POST' });
      setBookings((list) => list.map((b) => (b.id === id ? booking : b)));
      return booking;
    },
    [ownerId],
  );

  return { bookings, loading, error, reload, addBooking, cancelBooking };
}
