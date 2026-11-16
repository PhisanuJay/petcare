import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
const BOOKINGS_URL = `${API_BASE}/api/pet-owner/bookings`;

async function request(ownerId, path = '', options = {}) {
  let res;
  try {
    res = await fetch(`${BOOKINGS_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', 'x-owner-id': ownerId },
    });
  } catch {
    throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบว่า backend ทำงานอยู่');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
  return body;
}

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
      setBookings(await request(ownerId));
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
      const booking = await request(ownerId, '', { method: 'POST', body: JSON.stringify(data) });
      setBookings((list) => [...list, booking]);
      return booking;
    },
    [ownerId],
  );

  const cancelBooking = useCallback(
    async (id) => {
      const booking = await request(ownerId, `/${id}/cancel`, { method: 'POST' });
      setBookings((list) => list.map((b) => (b.id === id ? booking : b)));
      return booking;
    },
    [ownerId],
  );

  return { bookings, loading, error, reload, addBooking, cancelBooking };
}
