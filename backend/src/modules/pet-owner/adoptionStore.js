import { randomUUID } from 'node:crypto';
import { createJsonCollection, httpError } from './jsonCollection.js';

/**
 * Adoption requests made by pet owners.
 * Shape: { id, ownerId, animalId, animalName, fullName, phone, address, housing, hasOtherPets,
 *          experience, reason, status, createdAt, updatedAt }
 * status: 'pending' (just requested) → later set by the Adoption team (e.g. interview, approved,
 *         rejected); the owner can cancel while it is still 'pending'.
 */
const requests = createJsonCollection('adoption-requests.json');

export function listAdoptionRequests(ownerId) {
  return requests.read().then((all) =>
    all.filter((r) => r.ownerId === ownerId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
}

export function createAdoptionRequest(ownerId, data) {
  return requests.update((all) => {
    const duplicate = all.some(
      (r) => r.ownerId === ownerId && r.animalId === data.animalId && r.status !== 'cancelled',
    );
    if (duplicate) throw httpError(409, 'คุณยื่นคำขอรับเลี้ยงน้องตัวนี้ไว้แล้ว');
    const now = new Date().toISOString();
    const request = { ...data, id: randomUUID(), ownerId, status: 'pending', createdAt: now, updatedAt: now };
    return { records: [...all, request], result: request };
  });
}

export function cancelAdoptionRequest(ownerId, id) {
  return requests.update((all) => {
    const index = all.findIndex((r) => r.id === id && r.ownerId === ownerId);
    if (index === -1) throw httpError(404, 'ไม่พบคำขอนี้');
    if (all[index].status === 'cancelled') return { records: all, result: all[index] };
    if (all[index].status !== 'pending') throw httpError(409, 'คำขอนี้ดำเนินการไปแล้ว ไม่สามารถยกเลิกได้');
    const request = { ...all[index], status: 'cancelled', updatedAt: new Date().toISOString() };
    const next = all.slice();
    next[index] = request;
    return { records: next, result: request };
  });
}
