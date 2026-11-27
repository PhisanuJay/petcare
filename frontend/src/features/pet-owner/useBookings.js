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
      // The backend has no user accounts, so send the owner's name and phone with the booking:
      // the Medical Assistant uses them to contact the owner.
      const owner = {
        ownerName: `${currentUser?.firstName ?? ''} ${currentUser?.lastName ?? ''}`.trim(),
        ownerPhone: currentUser?.phone ?? '',
      };
      const booking = await ownerRequest(ownerId, '/bookings', {
        method: 'POST',
        body: JSON.stringify({ ...data, ...owner }),
      });
      setBookings((list) => [...list, booking]);
      return booking;
    },
    [ownerId, currentUser],
  );

  const requestCancel = useCallback(
    async (id, cancellationId, reason) => {
      const booking = await ownerRequest(ownerId, `/bookings/${id}/request-cancel`, {
        method: 'POST',
        body: JSON.stringify({ cancellationId, reason }),
      });
      setBookings((list) => list.map((b) => (b.id === id ? booking : b)));
      return booking;
    },
    [ownerId],
  );

  return { bookings, loading, error, reload, addBooking, requestCancel };
}
