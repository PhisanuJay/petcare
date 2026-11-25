import { randomUUID } from 'node:crypto';
import { createJsonCollection, httpError } from './jsonCollection.js';

/**
 * Pet transport requests made by pet owners.
 * Shape: { id, ownerId, petId, petName, petSpecies, direction, directionLabel, date, time,
 *          address, phone, note, status, createdAt, updatedAt }
 * direction: 'to_clinic' (home → clinic) | 'to_home' (clinic → home) | 'round_trip'
 * status: 'pending' (just requested) → 'confirmed' (by the transport team) | 'cancelled'
 * No price is stored: the fee is not defined yet.
 */
const requests = createJsonCollection('transport-requests.json');

export function listTransportRequests(ownerId) {
  return requests.read().then((all) =>
    all
      .filter((r) => r.ownerId === ownerId)
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)),
  );
}

export function createTransportRequest(ownerId, data) {
  return requests.update((all) => {
    const clash = all.some(
      (r) =>
        r.ownerId === ownerId &&
        r.petId === data.petId &&
        r.status !== 'cancelled' &&
        r.date === data.date &&
        r.time === data.time,
    );
    if (clash) throw httpError(409, 'สัตว์เลี้ยงตัวนี้มีคำขอรับ-ส่งในวันและเวลานี้แล้ว');
    const now = new Date().toISOString();
    const request = { ...data, id: randomUUID(), ownerId, status: 'pending', createdAt: now, updatedAt: now };
    return { records: [...all, request], result: request };
  });
}

export function cancelTransportRequest(ownerId, id) {
  return requests.update((all) => {
    const index = all.findIndex((r) => r.id === id && r.ownerId === ownerId);
    if (index === -1) throw httpError(404, 'ไม่พบคำขอนี้');
    if (all[index].status === 'cancelled') return { records: all, result: all[index] };
    const request = { ...all[index], status: 'cancelled', updatedAt: new Date().toISOString() };
    const next = all.slice();
    next[index] = request;
    return { records: next, result: request };
  });
}
