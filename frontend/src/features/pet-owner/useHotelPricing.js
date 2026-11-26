import { useEffect, useSyncExternalStore } from 'react';
import {
  HOTEL_ROOM_BY_ID,
  HOTEL_ROOM_MATRIX,
  pricingRoomFromMatrix,
} from '../../shared/data/hotelRoomMatrix.js';
import { transportApi } from '../pet-transport/api.js';
import './hotel-pricing.css';

const DEFAULT_ROOMS = HOTEL_ROOM_MATRIX.map((row) => pricingRoomFromMatrix(row));

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

function roomFromApiRow(item) {
  const row = HOTEL_ROOM_BY_ID[item.id];
  const price = Number(item.price);
  const label = item.label || row?.titleTh || item.id;
  if (!row) {
    if (!Number.isSafeInteger(price) || price < 1) {
      throw new Error(`ไม่พบราคาห้อง ${label} ที่ถูกต้อง`);
    }
    return { value: item.id, label, name: label, price, image: '/rooms/size-m.jpg', features: [] };
  }
  if (!Number.isSafeInteger(price) || price < 1) {
    throw new Error(`ไม่พบราคาห้อง ${label} ที่ถูกต้อง`);
  }
  return pricingRoomFromMatrix(row, price);
}

function normalizeRooms(rows) {
  if (!Array.isArray(rows)) throw new Error('เซิร์ฟเวอร์ส่งข้อมูลราคาห้องพักไม่ถูกต้อง');
  if (!rows.length) return DEFAULT_ROOMS;
  return DEFAULT_ROOMS.map((room) => {
    const saved = rows.find((item) => item.id === room.value);
    if (saved) return roomFromApiRow(saved);
    return { ...room };
  });
}

export function refreshHotelPricing() {
  if (request) return request;
  snapshot = { ...snapshot, loading: true, error: '' };
  notify();

  request = transportApi.getPricing()
    .then((data) => {
      let rooms;
      try {
        rooms = normalizeRooms(data.hotelRoomPrices);
      } catch (normErr) {
        rooms = DEFAULT_ROOMS;
        snapshot = { rooms, loading: false, error: normErr.message };
        loaded = true;
        notify();
        return rooms;
      }
      snapshot = { rooms, loading: false, error: '' };
      loaded = true;
      notify();
      return rooms;
    })
    .catch((error) => {
      snapshot = {
        rooms: DEFAULT_ROOMS,
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