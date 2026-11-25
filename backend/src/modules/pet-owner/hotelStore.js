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

export function requestReservationCancellation(ownerId, id, cancellationId, reason) {
  return reservations.update((all) => {
    const index = all.findIndex((r) => r.id === id && r.ownerId === ownerId);
    if (index === -1) throw httpError(404, 'ไม่พบการจองนี้');
    const current = all[index];
    if (!['pending', 'confirmed'].includes(current.status)) {
      throw httpError(409, 'การเข้าพักเริ่มแล้วหรือรายการนี้ยกเลิกไม่ได้');
    }
    if (!cancellationId) throw httpError(400, 'ข้อมูลคำขอยกเลิกไม่ถูกต้อง');
    const text = String(reason || '').trim();
    if (text.length < 3 || text.length > 500) throw httpError(400, 'กรุณาระบุเหตุผล 3 ถึง 500 ตัวอักษร');
    const now = new Date().toISOString();
    const reservation = {
      ...current,
      status: 'cancel_requested',
      cancelRequest: {
        id: cancellationId,
        reason: text,
        status: 'pending',
        previousStatus: current.status,
        requestedAt: now,
      },
      updatedAt: now,
    };
    const next = all.slice();
    next[index] = reservation;
    return { records: next, result: reservation };
  });
}

export function resolveReservationCancellation(id, cancellationId, approve, adminNote = '') {
  return reservations.update((all) => {
    const index = all.findIndex((r) => r.id === id);
    if (index === -1) throw httpError(404, 'ไม่พบการจองนี้');
    const current = all[index];
    if (
      current.status !== 'cancel_requested'
      || current.cancelRequest?.status !== 'pending'
      || current.cancelRequest?.id !== cancellationId
    ) {
      throw httpError(409, 'คำขอนี้ไม่อยู่ในสถานะรอพิจารณา');
    }
    const now = new Date().toISOString();
    const reservation = {
      ...current,
      status: approve ? 'cancelled' : current.cancelRequest.previousStatus,
      cancelRequest: {
        ...current.cancelRequest,
        status: approve ? 'approved' : 'rejected',
        adminNote: String(adminNote || '').trim().slice(0, 500),
        resolvedAt: now,
      },
      updatedAt: now,
    };
    const next = all.slice();
    next[index] = reservation;
    return { records: next, result: reservation };
  });
}
