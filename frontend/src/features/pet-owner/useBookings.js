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

  // The clinic confirms or declines bookings on its own side, so pick up changes whenever the owner
  // comes back to this tab (silent: no loading state, errors are ignored until the next reload).
  useEffect(() => {
    if (!ownerId) return undefined;
    const refresh = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        setBookings(await ownerRequest(ownerId, '/bookings'));
      } catch {
        /* keep showing what we have */
      }
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [ownerId]);

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
