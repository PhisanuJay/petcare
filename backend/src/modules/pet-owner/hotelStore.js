import { randomUUID } from 'node:crypto';
import { createJsonCollection, httpError } from './jsonCollection.js';

/**
 * Cat hotel reservation requests made by pet owners.
 * Shape: { id, ownerId, petId, petName, petSpecies, roomType, roomLabel, pricePerNight,
 *          checkIn, checkOut, nights, totalPrice, note, status, createdAt, updatedAt }
 * status: 'pending' (just requested) → 'confirmed' (by the hotel staff) | 'cancelled'
 */
const reservations = createJsonCollection('hotel-reservations.json');

export function listReservations(ownerId) {
  return reservations.read().then((all) =>
    all.filter((r) => r.ownerId === ownerId).sort((a, b) => a.checkIn.localeCompare(b.checkIn)),
  );
}

export function createReservation(ownerId, data) {
  return reservations.update((all) => {
    // Same pet cannot stay in two places at once: [checkIn, checkOut) must not overlap.
    const overlap = all.some(
      (r) =>
        r.ownerId === ownerId &&
        r.petId === data.petId &&
        r.status !== 'cancelled' &&
        r.checkIn < data.checkOut &&
        data.checkIn < r.checkOut,
    );
    if (overlap) throw httpError(409, 'สัตว์เลี้ยงตัวนี้มีการจองที่พักซ้อนทับกับช่วงวันนี้แล้ว');
    const now = new Date().toISOString();
    const reservation = { ...data, id: randomUUID(), ownerId, status: 'pending', createdAt: now, updatedAt: now };
    return { records: [...all, reservation], result: reservation };
  });
}

export function cancelReservation(ownerId, id) {
  return reservations.update((all) => {
    const index = all.findIndex((r) => r.id === id && r.ownerId === ownerId);
    if (index === -1) throw httpError(404, 'ไม่พบการจองนี้');
    if (all[index].status === 'cancelled') return { records: all, result: all[index] };
    const reservation = { ...all[index], status: 'cancelled', updatedAt: new Date().toISOString() };
    const next = all.slice();
    next[index] = reservation;
    return { records: next, result: reservation };
  });
}
