import { randomUUID } from 'node:crypto';
import { createJsonCollection, httpError } from './jsonCollection.js';

/**
 * Pet owners' vet bookings.
 * Shape: { id, ownerId, petId, petName, petSpecies, service, serviceLabel, date, time, note,
 *          status, clinicNote?, createdAt, updatedAt }
 * status: 'pending' → 'confirmed' | 'rejected' (by the clinic);  'confirmed' → 'completed' | 'no_show';
 *         'pending' / 'confirmed' → 'cancelled' (by the owner).
 */
const bookings = createJsonCollection('bookings.json');

/** Statuses the veterinarian side may move a booking to, by current status. */
const CLINIC_TRANSITIONS = {
  pending: ['confirmed', 'rejected'],
  confirmed: ['completed', 'no_show'],
};
const OWNER_CANCELLABLE = ['pending', 'confirmed'];
export const BOOKING_STATUSES = ['pending', 'confirmed', 'completed', 'no_show', 'rejected', 'cancelled'];

export function listBookings(ownerId) {
  return bookings.read().then((all) =>
    all
      .filter((b) => b.ownerId === ownerId)
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)),
  );
}

export function createBooking(ownerId, data) {
  return bookings.update((all) => {
    const clash = all.some(
      (b) =>
        b.ownerId === ownerId &&
        b.petId === data.petId &&
        b.status !== 'cancelled' &&
        b.date === data.date &&
        b.time === data.time,
    );
    if (clash) throw httpError(409, 'สัตว์เลี้ยงตัวนี้มีนัดในวันและเวลานี้แล้ว');
    const now = new Date().toISOString();
    const booking = { ...data, id: randomUUID(), ownerId, status: 'pending', createdAt: now, updatedAt: now };
    return { records: [...all, booking], result: booking };
  });
}

export function cancelBooking(ownerId, id) {
  return bookings.update((all) => {
    const index = all.findIndex((b) => b.id === id && b.ownerId === ownerId);
    if (index === -1) throw httpError(404, 'ไม่พบนัดหมายนี้');
    if (all[index].status === 'cancelled') return { records: all, result: all[index] };
    if (!OWNER_CANCELLABLE.includes(all[index].status)) {
      throw httpError(409, 'นัดนี้ดำเนินการไปแล้ว ไม่สามารถยกเลิกได้');
    }
    const booking = { ...all[index], status: 'cancelled', updatedAt: new Date().toISOString() };
    const next = all.slice();
    next[index] = booking;
    return { records: next, result: booking };
  });
}

/** Every owner's bookings (for the veterinarian side). */
export function listAllBookings() {
  return bookings.read().then((all) => all.slice().sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)));
}

/** Clinic-side status change, limited to CLINIC_TRANSITIONS. `clinicNote` is optional. */
export function updateBookingStatus(id, status, clinicNote = '') {
  return bookings.update((all) => {
    const index = all.findIndex((b) => b.id === id);
    if (index === -1) throw httpError(404, 'ไม่พบนัดหมายนี้');
    const allowed = CLINIC_TRANSITIONS[all[index].status] ?? [];
    if (!allowed.includes(status)) throw httpError(409, 'ไม่สามารถเปลี่ยนสถานะนัดนี้ได้');
    const booking = {
      ...all[index],
      status,
      ...(clinicNote ? { clinicNote } : {}),
      updatedAt: new Date().toISOString(),
    };
    const next = all.slice();
    next[index] = booking;
    return { records: next, result: booking };
  });
}
