import { randomUUID } from 'node:crypto';
import { createJsonCollection, httpError } from './jsonCollection.js';

const bookings = createJsonCollection('bookings.json');

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
    const booking = { ...all[index], status: 'cancelled', updatedAt: new Date().toISOString() };
    const next = all.slice();
    next[index] = booking;
    return { records: next, result: booking };
  });
}
