import { useEffect, useState, useCallback } from 'react';
import { catalogItemFromMatrix, HOTEL_ROOM_MATRIX } from '../../shared/data/hotelRoomMatrix.js';
import { ownerRequest } from './api.js';
import { useAuth } from '../auth/AuthContext.jsx';

function fallbackCatalog() {
  return HOTEL_ROOM_MATRIX.map(catalogItemFromMatrix);
}

export function useHotelCatalog() {
  const { currentUser } = useAuth();
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await ownerRequest(currentUser?.id || 'guest', '/cat-hotel/catalog');
      setCatalog(data.items || []);
    } catch (err) {
      setCatalog(fallbackCatalog());
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    load();
  }, [load]);

  return { catalog, loading, error, reload: load };
}

export async function fetchHotelAvailability(ownerId, checkIn, checkOut) {
  const q = new URLSearchParams({ checkIn, checkOut });
  const data = await ownerRequest(ownerId, `/cat-hotel/availability?${q}`);
  return new Map((data.items || []).map((item) => [item.roomTypeId, item.minAvailable]));
}