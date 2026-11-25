import { randomUUID } from 'node:crypto';
import { validateSlot } from './clinicSchedule.js';
import { createJsonCollection, httpError } from './jsonCollection.js';

/**
 * Pet owners' vet bookings.
 * Shape: { id, ownerId, petId, petName, petSpecies, ownerName, ownerPhone, service, serviceLabel,
 *          date, time, note, status, clinicNote?, createdAt, updatedAt }
 *   ownerName / ownerPhone are copied from the owner's account when booking (may be '' on older bookings).
 * status: 'pending' → 'confirmed' | 'rejected' (Medical Assistant);
 *         'confirmed' → 'no_show' (Medical Assistant) | 'completed' (Veterinarian);
 *         'pending' / 'confirmed' → 'cancel_requested' → 'cancelled' (by Admin).
 * The Medical Assistant can also move a pending / confirmed booking to another date and time
 * (rescheduleBookingAsClinic).
 */
const bookings = createJsonCollection('bookings.json');

/**
 * Statuses the clinic side may move a booking to, by current status. Which role does which step is
 * decided by each module's routes (the Veterinarian API only allows 'completed').
 */
const CLINIC_TRANSITIONS = {
  pending: ['confirmed', 'rejected'],
  confirmed: ['completed', 'no_show'],
};
const OWNER_CANCELLABLE = ['pending', 'confirmed'];
const CLINIC_RESCHEDULABLE = ['pending', 'confirmed'];
/** Bookings that no longer hold their time slot. */
const INACTIVE = ['cancelled', 'rejected'];
export const BOOKING_STATUSES = [
  'pending',
  'confirmed',
  'completed',
  'no_show',
  'rejected',
  'cancel_requested',
  'cancelled',
];
/**
 * Hand-over rule between the Medical Assistant and the Veterinarian: a booking reaches the vet only
 * after the Medical Assistant has confirmed it ('pending' → 'confirmed'). The vet never sees
 * 'pending', 'rejected' or 'cancelled' bookings; after confirmation it continues as
 * 'confirmed' → 'completed' (vet) or 'no_show' (Medical Assistant).
 */
export const VET_VISIBLE_STATUSES = ['confirmed', 'completed', 'no_show'];

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

export function requestBookingCancellation(ownerId, id, cancellationId, reason) {
  return bookings.update((all) => {
    const index = all.findIndex((b) => b.id === id && b.ownerId === ownerId);
    if (index === -1) throw httpError(404, 'ไม่พบนัดหมายนี้');
    if (all[index].status === 'cancel_requested') throw httpError(409, 'มีคำขอยกเลิกที่กำลังรอพิจารณา');
    if (!OWNER_CANCELLABLE.includes(all[index].status)) {
      throw httpError(409, 'นัดนี้ดำเนินการไปแล้ว ไม่สามารถยกเลิกได้');
    }
    const text = String(reason || '').trim();
    if (text.length < 3 || text.length > 500) throw httpError(400, 'กรุณาระบุเหตุผล 3 ถึง 500 ตัวอักษร');
    if (!cancellationId) throw httpError(400, 'ข้อมูลคำขอยกเลิกไม่ถูกต้อง');
    const booking = {
      ...all[index],
      status: 'cancel_requested',
      cancelRequest: {
        id: cancellationId,
        reason: text,
        status: 'pending',
        previousStatus: all[index].status,
        requestedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    };
    const next = all.slice();
    next[index] = booking;
    return { records: next, result: booking };
  });
}

export function resolveBookingCancellation(id, cancellationId, approve, adminNote = '') {
  return bookings.update((all) => {
    const index = all.findIndex((b) => b.id === id);
    if (index === -1) throw httpError(404, 'ไม่พบนัดหมายนี้');
    const current = all[index];
    if (
      current.status !== 'cancel_requested'
      || current.cancelRequest?.status !== 'pending'
      || current.cancelRequest?.id !== cancellationId
    ) {
      throw httpError(409, 'คำขอนี้ไม่อยู่ในสถานะรอพิจารณา');
    }
    const now = new Date().toISOString();
    const booking = {
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

/**
 * Clinic-side change of date and time (e.g. the Medical Assistant moves a booking when approving it).
 * Only pending / confirmed bookings; the status is kept. The new slot must be a future slot within
 * opening hours, and the same pet must not already have another active booking at that time.
 */
export function rescheduleBookingAsClinic(id, { date, time } = {}) {
  try {
    validateSlot(date, time);
  } catch (err) {
    return Promise.reject(err);
  }
  return bookings.update((all) => {
    const index = all.findIndex((b) => b.id === id);
    if (index === -1) throw httpError(404, 'ไม่พบนัดหมายนี้');
    const current = all[index];
    if (!CLINIC_RESCHEDULABLE.includes(current.status)) throw httpError(409, 'นัดนี้ดำเนินการไปแล้ว ไม่สามารถเลื่อนได้');
    const clash = all.some(
      (b) =>
        b.id !== id &&
        b.petId === current.petId &&
        !INACTIVE.includes(b.status) &&
        b.date === date &&
        b.time === time,
    );
    if (clash) throw httpError(409, 'สัตว์เลี้ยงตัวนี้มีนัดในวันและเวลานี้แล้ว');
    const booking = { ...current, date, time, updatedAt: new Date().toISOString() };
    const next = all.slice();
    next[index] = booking;
    return { records: next, result: booking };
  });
}
