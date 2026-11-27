import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { ownerRequest } from './api.js';

/**
 * Legacy hook name — loads MSSQL stays (`/cat-hotel/stays`) after reservation API was retired.
 */
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
      const stays = await ownerRequest(ownerId, '/cat-hotel/stays');
      const list = Array.isArray(stays) ? stays : stays?.items ?? [];
      setReservations(list);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const addReservation = useCallback(async () => {
    throw new Error('ใช้เมนูฝากโรงแรม (/pet-owner/cat-hotel/book) แทนการจองแบบเก่า');
  }, []);

  const requestCancel = useCallback(async () => {
    throw new Error('ยกเลิกการฝากผ่านรายละเอียดการจองและระบบชำระเงิน');
  }, []);

  return { reservations, loading, error, reload, addReservation, requestCancel };
}