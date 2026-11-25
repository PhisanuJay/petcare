import { useEffect, useSyncExternalStore } from 'react';
import { HOTEL_ROOMS as HOME_HOTEL_ROOMS } from '../../shared/data/homeContent.js';
import { transportApi } from '../pet-transport/api.js';
import './hotel-pricing.css';

const ROOM_IDS = ['standard', 'deluxe', 'suite'];

const DEFAULT_ROOMS = HOME_HOTEL_ROOMS.map((room, index) => ({
  ...room,
  value: ROOM_IDS[index],
  label: room.name,
}));

const listeners = new Set();
let snapshot = { rooms: DEFAULT_ROOMS, loading: true, error: '' };
let request = null;
let loaded = false;

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return snapshot;
}

function normalizeRooms(rows) {
  if (!Array.isArray(rows)) throw new Error('เซิร์ฟเวอร์ส่งข้อมูลราคาห้องพักไม่ถูกต้อง');
  return DEFAULT_ROOMS.map((room) => {
    const saved = rows.find((item) => item.id === room.value);
    const price = Number(saved?.price);
    if (!saved || !Number.isSafeInteger(price) || price < 1) {
      throw new Error(`ไม่พบราคาห้อง ${room.label} ที่ถูกต้อง`);
    }
    return { ...room, price };
  });
}

export function refreshHotelPricing() {
  if (request) return request;
  snapshot = { ...snapshot, loading: true, error: '' };
  notify();

  request = transportApi.getPricing()
    .then((data) => {
      const rooms = normalizeRooms(data.hotelRoomPrices);
      snapshot = { rooms, loading: false, error: '' };
      loaded = true;
      notify();
      return rooms;
    })
    .catch((error) => {
      snapshot = {
        ...snapshot,
        loading: false,
        error: error.message || 'โหลดราคาห้องพักไม่สำเร็จ',
      };
      notify();
      throw error;
    })
    .finally(() => {
      request = null;
    });

  return request;
}

export function useHotelPricing() {
  const current = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    if (!loaded) refreshHotelPricing().catch(() => {});
  }, []);

  return { ...current, refresh: refreshHotelPricing };
}
