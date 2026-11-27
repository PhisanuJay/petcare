import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { STORAGE_KEYS, newId, readJSON, writeJSON } from '../../shared/utils/storage.js';

export const CLINIC_SERVICES = [
  { id: 'consult', name: 'ตรวจทั่วไป', price: 500 },
  { id: 'vaccine', name: 'วัคซีน', price: 800 },
  { id: 'groom', name: 'อาบน้ำตัดขน', price: 600 },
];

const listeners = new Set();
let cache = null;

function read() {
  if (cache === null) cache = readJSON(STORAGE_KEYS.clinicBookings, []);
  return cache;
}

function write(next) {
  cache = next;
  writeJSON(STORAGE_KEYS.clinicBookings, next);
  emit();
}

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  const onStorage = (event) => {
    if (event.key === STORAGE_KEYS.clinicBookings) {
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

export function useClinicBookings() {
  const { currentUser } = useAuth();
  const all = useSyncExternalStore(subscribe, read);
  const bookings = useMemo(
    () => all.filter((row) => row.ownerId === currentUser?.id),
    [all, currentUser?.id],
  );

  const createBooking = useCallback((data) => {
    if (!currentUser) throw new Error('กรุณาเข้าสู่ระบบ');
    const service = CLINIC_SERVICES.find((item) => item.id === data.serviceId);
    if (!service) throw new Error('เลือกบริการ');
    if (!data.petName) throw new Error('เลือกสัตว์เลี้ยง');
    if (!data.when) throw new Error('เลือกวันนัด');
    const booking = {
      id: newId(),
      ownerId: currentUser.id,
      email: currentUser.email,
      ownerName: `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim(),
      petName: data.petName,
      serviceId: service.id,
      serviceName: service.name,
      price: service.price,
      when: data.when,
      note: data.note || '',
      createdAt: new Date().toISOString(),
    };
    write([booking, ...read()]);
    return booking;
  }, [currentUser]);

  return { bookings, createBooking };
}
