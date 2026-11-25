import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { HOTEL_ROOMS, HOTEL_STAY_PROMO } from '../../shared/data/homeContent.js';
import { STORAGE_KEYS, newId, readJSON, writeJSON } from '../../shared/utils/storage.js';

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

const listeners = new Set();
let cache = null;

function getAll() {
  if (cache === null) cache = readJSON(STORAGE_KEYS.hotelBookings, []);
  return cache;
}

function setAll(next) {
  writeJSON(STORAGE_KEYS.hotelBookings, next);
  cache = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  const onStorage = (event) => {
    if (event.key === STORAGE_KEYS.hotelBookings) {
      cache = null;
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

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
  const all = useSyncExternalStore(subscribe, getAll);
  const ownerId = currentUser?.id;

  const bookings = useMemo(
    () => (ownerId ? all.filter((row) => row.ownerId === ownerId) : [])
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [all, ownerId],
  );

  const createBooking = useCallback((data) => {
    if (!currentUser) throw new Error('กรุณาเข้าสู่ระบบ');
    const pets = (Array.isArray(data.pets) ? data.pets : [])
      .map((pet) => ({
        id: pet.id || '',
        name: String(pet.name || '').trim(),
        species: pet.species || 'other',
      }))
      .filter((pet) => pet.name);
    if (!pets.length) throw new Error('เลือกสัตว์เลี้ยงอย่างน้อย 1 ตัว');
    const checkIn = String(data.checkIn || '');
    const checkOut = String(data.checkOut || '');
    assertStay(checkIn, checkOut);
    const plan = cagePlan(pets);
    const quote = quoteStay({
      roomName: data.roomName,
      checkIn,
      checkOut,
      cages: plan.cages,
      pricePerNight: data.pricePerNight,
    });
    if (!quote) throw new Error('กรุณาเลือกวันเข้าพักและวันรับกลับ');
    const booking = {
      id: newId(),
      ownerId: currentUser.id,
      email: currentUser.email,
      petName: pets.map((pet) => pet.name).join(', '),
      petId: pets[0].id,
      petIds: pets.map((pet) => pet.id),
      pets,
      cageNote: plan.note,
      checkIn,
      checkOut,
      status: HOTEL_STATUS.waiting,
      linkedBookings: normalizeLinkedBookings(data.linkedBookings),
      createdAt: new Date().toISOString(),
      ...quote,
    };
    setAll([booking, ...getAll()]);
    return booking;
  }, [currentUser]);

  const linkRelatedBooking = useCallback((id, linkedBooking) => {
    if (!ownerId) throw new Error('กรุณาเข้าสู่ระบบ');
    const [related] = normalizeLinkedBookings([linkedBooking]);
    if (!related) throw new Error('ข้อมูลบริการที่เชื่อมไม่ถูกต้อง');
    const rows = getAll();
    const current = rows.find((row) => row.id === id && row.ownerId === ownerId);
    if (!current) throw new Error('ไม่พบการจองโรงแรมนี้');
    const linkedBookings = normalizeLinkedBookings(current.linkedBookings);
    if (linkedBookings.some((item) => item.kind === related.kind && item.id === related.id)) {
      return current;
    }
    const updated = { ...current, linkedBookings: [...linkedBookings, related] };
    setAll(rows.map((row) => (row.id === id ? updated : row)));
    return updated;
  }, [ownerId]);

  const setStatus = useCallback((id, status) => {
    if (!Object.values(HOTEL_STATUS).includes(status)) throw new Error('สถานะไม่ถูกต้อง');
    const rows = getAll();
    const current = rows.find((row) => row.id === id && row.ownerId === ownerId);
    if (!current) throw new Error('ไม่พบการจองนี้');
    setAll(rows.map((row) => (row.id === id ? { ...row, status } : row)));
  }, [ownerId]);

  return { bookings, createBooking, linkRelatedBooking, setStatus };
}

/** Every stay, for the hotel desk. Status changes here, not on the customer page. */
export function useAllHotelBookings() {
  const all = useSyncExternalStore(subscribe, getAll);
  const bookings = useMemo(
    () => all.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
    [all],
  );
  const setStatus = useCallback((id, status) => {
    if (!Object.values(HOTEL_STATUS).includes(status)) throw new Error('สถานะไม่ถูกต้อง');
    const rows = getAll();
    if (!rows.some((row) => row.id === id)) throw new Error('ไม่พบการจองนี้');
    setAll(rows.map((row) => (
      row.id === id
        ? { ...row, status, updatedAt: new Date().toISOString() }
        : row
    )));
  }, []);
  return { bookings, setStatus };
}
