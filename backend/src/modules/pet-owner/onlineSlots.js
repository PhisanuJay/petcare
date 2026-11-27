import { listStaff } from '../auth/staffAccounts.js';
import { getClosure, getHoursForDay, slotTimesForDate } from '../clinic-admin/clinicSettings.js';
import { ensureRosterForActiveVets, isVetOnDuty, vetsOnDuty } from '../clinic-admin/rosterStore.js';
import { findVetConflict } from '../medical-assistant/vetScheduling.js';
import { listVisits } from '../medical-assistant/visitStore.js';
import { getSettings } from '../clinic-admin/clinicSettings.js';
import { isSlotBlockingStatus, listAllBookings } from './bookingStore.js';
import { isDateString, nowTimeString, todayString } from './clinicSchedule.js';

function dayOfWeek(dateString) {
  const [y, m, d] = dateString.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

function baseSlotsForDate(date) {
  if (!isDateString(date)) return { base: [], reason: 'วันที่ไม่ถูกต้อง' };
  const closure = getClosure(date);
  if (closure) return { base: [], reason: `คลินิกปิดทำการ: ${closure.reason}` };
  if (getHoursForDay(dayOfWeek(date)) === null) {
    return { base: [], reason: 'คลินิกปิดทำการวันนี้' };
  }
  ensureRosterForActiveVets();
  if (!vetsOnDuty(date).length) {
    return { base: [], reason: 'วันนี้ไม่มีสัตวแพทย์เข้าเวร' };
  }
  let base = slotTimesForDate(date);
  if (date === todayString()) {
    const now = nowTimeString();
    const upcoming = base.filter((t) => t > now);
    base = upcoming.length ? upcoming : base;
  }
  return { base, reason: null };
}

function takenTimesForDate(bookings, date) {
  const taken = new Set();
  for (const b of bookings) {
    if (!isSlotBlockingStatus(b.status)) continue;
    if (b.date !== date || typeof b.time !== 'string' || !b.time) continue;
    taken.add(b.time);
  }
  return taken;
}

/**
 * ช่องเวลาจองออนไลน์ — ไม่โชว์ช่วงที่มีการจองแล้ว (ตรงกับกฎ createBooking)
 */
export async function availableOnlineSlots(date, preferredVetId = '') {
  const vetId = typeof preferredVetId === 'string' ? preferredVetId.trim() : '';
  if (!isDateString(date)) {
    return { date, bookable: false, reason: 'วันที่ไม่ถูกต้อง', slots: [] };
  }

  const { base, reason: baseReason } = baseSlotsForDate(date);
  if (baseReason) {
    return { date, bookable: false, reason: baseReason, slots: [] };
  }

  const durationMin = Number(getSettings().slotMinutes) || 60;
  const [bookings, visits] = await Promise.all([listAllBookings(), listVisits()]);
  const taken = takenTimesForDate(bookings, date);
  const visitsMap = new Map(visits.map((v) => [v.bookingId, v]));
  const freeClock = base.filter((time) => !taken.has(time));

  if (vetId) {
    const vet = listStaff('veterinarian').find((v) => v.id === vetId);
    if (!vet) {
      return { date, bookable: false, reason: 'ไม่พบสัตวแพทย์ที่เลือก', slots: [] };
    }
    if (!isVetOnDuty(vetId, date)) {
      return { date, bookable: false, reason: 'สัตวแพทย์ที่เลือกไม่ได้เข้าเวรวันนี้', slots: [] };
    }
    const slots = freeClock.filter(
      (time) =>
        !findVetConflict(bookings, visitsMap, {
          vetId: vet.id,
          vet: vet.name,
          date,
          time,
          durationMin,
        }),
    );
    return {
      date,
      bookable: slots.length > 0,
      reason: slots.length ? null : 'ไม่มีช่วงเวลาว่างในวันนี้ กรุณาเลือกวันอื่น',
      slots,
    };
  }

  const onDuty = vetsOnDuty(date);
  const slots = freeClock.filter((time) =>
    onDuty.some(
      (vet) =>
        !findVetConflict(bookings, visitsMap, {
          vetId: vet.id,
          vet: vet.name,
          date,
          time,
          durationMin,
        }),
    ),
  );

  return {
    date,
    bookable: slots.length > 0,
    reason: slots.length ? null : 'ไม่มีช่วงเวลาว่างในวันนี้ กรุณาเลือกวันอื่น',
    slots,
  };
}
