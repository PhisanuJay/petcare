import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { HOTEL_ROOMS, HOTEL_STAY_PROMO } from '../../shared/data/homeContent.js';

/** Stay status only. Camera access is a separate grant in the hotel CCTV app. */
export const HOTEL_STATUS = {
  waiting: 'waiting',
  checkedIn: 'checked_in',
  checkedOut: 'checked_out',
  cancelled: 'cancelled',
};

export const HOTEL_STATUS_LABEL = {
  waiting: 'รอนำน้องมาฝาก',
  checked_in: 'กำลังเข้าพัก',
  checked_out: 'รับกลับแล้ว',
  cancelled: 'ยกเลิกการจอง',
};

export function stayNights(checkIn, checkOut) {
  const start = new Date(`${checkIn}T00:00:00`);
  const end = new Date(`${checkOut}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const nights = Math.round((end - start) / 86400000);
  return nights > 0 ? nights : null;
}

/** Dogs take a cage each. Cats share, three to a cage. Other species take a cage each. */
export function cagePlan(pets) {
  const list = Array.isArray(pets) ? pets : [];
  const dogs = list.filter((pet) => pet.species === 'dog').length;
  const cats = list.filter((pet) => pet.species === 'cat').length;
  const others = list.length - dogs - cats;
  const catCages = cats ? Math.ceil(cats / 3) : 0;
  const cages = dogs + catCages + others;
  const parts = [];
  if (dogs) parts.push(`สุนัข ${dogs} ตัวใช้ ${dogs} กรง`);
  if (cats) parts.push(`แมว ${cats} ตัวใช้ ${catCages} กรง`);
  if (others) parts.push(`สัตว์อื่น ${others} ตัวใช้ ${others} กรง`);
  return { dogs, cats, others, catCages, cages, note: parts.join(' · ') };
}

/** Price for a room, dates, and cage count. Discount matches the hotel coupon on the home page. */
export function quoteStay({ roomName, checkIn, checkOut, cages = 1, pricePerNight }) {
  const room = HOTEL_ROOMS.find((item) => item.name === roomName);
  const nights = stayNights(checkIn, checkOut);
  const units = Number(cages);
  const rate = pricePerNight == null ? room?.price : Number(pricePerNight);
  if (!room || !nights || !Number.isSafeInteger(rate) || rate < 1 || !Number.isInteger(units) || units < 1) return null;
  const subtotal = rate * nights * units;
  const promoApplied = nights >= HOTEL_STAY_PROMO.minNights && checkIn <= HOTEL_STAY_PROMO.until;
  const discount = promoApplied ? Math.round((subtotal * HOTEL_STAY_PROMO.percent) / 100) : 0;
  return {
    roomName: room.name,
    pricePerNight: rate,
    nights,
    cages: units,
    subtotal,
    discount,
    total: subtotal - discount,
    promoApplied,
  };
}

/** Legacy localStorage hotel bookings — retired; stays use useHotelStays + MSSQL. */
const EMPTY_HOTEL_BOOKINGS = [];
const noopSubscribe = (listener) => {
  listener();
  return () => {};
};

function assertStay(checkIn, checkOut) {
  if (!checkIn || !checkOut) throw new Error('กรุณาระบุวันเข้าพักและวันรับกลับ');
  if (checkOut <= checkIn) throw new Error('วันรับกลับต้องอยู่หลังวันเข้าพัก');
}

function normalizeLinkedBookings(items) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item
      && ['clinic', 'transport'].includes(item.kind)
      && typeof item.id === 'string'
      && item.id.trim())
    .map((item) => ({
      kind: item.kind,
      id: item.id.trim(),
      label: String(item.label || '').trim(),
    }));
}

/**
 * Hotel stays for the logged-in owner.
 * A booking stores the owner email so staff can grant a camera to that same address.
 * It never stores a camera id or a stream address.
 */
export function useHotelBookings() {
  const { currentUser } = useAuth();
  useSyncExternalStore(noopSubscribe, () => EMPTY_HOTEL_BOOKINGS);
  const ownerId = currentUser?.id;

  const bookings = useMemo(() => EMPTY_HOTEL_BOOKINGS, [ownerId]);

  const createBooking = useCallback(() => {
    throw new Error('จองโรงแรมผ่านหน้าจองบริการ (Stay) แทน — ไม่รองรับการบันทึกในเครื่องแล้ว');
  }, []);

  const linkRelatedBooking = useCallback((_id, _linkedBooking) => {
    /* stays are linked via payment hub refId — legacy localStorage removed */
    return null;
  }, []);

  const setStatus = useCallback(() => {
    throw new Error('อัปเดตสถานะโรงแรมผ่านระบบ stays เท่านั้น');
  }, []);

  return { bookings, createBooking, linkRelatedBooking, setStatus };
}

/** Every stay, for the hotel desk. Status changes here, not on the customer page. */
export function useAllHotelBookings() {
  useSyncExternalStore(noopSubscribe, () => EMPTY_HOTEL_BOOKINGS);
  const bookings = useMemo(() => EMPTY_HOTEL_BOOKINGS, []);
  const setStatus = useCallback(() => {
    throw new Error('จัดการสถานะโรงแรมผ่านระบบ stays ในหลังบ้าน');
  }, []);
  return { bookings, setStatus };
}
