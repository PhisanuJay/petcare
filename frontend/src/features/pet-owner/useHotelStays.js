import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { ownerRequest } from './api.js';
import { roomTypeTitleTh } from './hotelRooms.js';

export function useHotelStays() {
  const { currentUser } = useAuth();
  const [stays, setStays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!currentUser?.id) {
      setStays([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await ownerRequest(currentUser.id, '/cat-hotel/stays');
      setStays(data.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    reload();
  }, [reload]);

  const createStay = useCallback(async (payload) => {
    if (!currentUser?.id) throw new Error('กรุณาเข้าสู่ระบบ');
    const stay = await ownerRequest(currentUser.id, '/cat-hotel/stays', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'x-owner-email': currentUser.email || '' },
    });
    setStays((current) => [stay, ...current]);
    return stay;
  }, [currentUser]);

  return { stays, loading, error, reload, createStay };
}

export function formatStayHubDetail(stay) {
  const parts = (stay.lines || []).map((line) => {
    const petCount = (line.petIds || []).length;
    return `${roomTypeTitleTh(line.roomTypeId)} ×${line.units} (${petCount} ตัว)`;
  });
  return `${stay.nights} คืน · ${parts.join(' · ')}`;
}