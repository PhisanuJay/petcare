import { listStaff } from '../auth/staffAccounts.js';
import { getSettings, getClosure, getHoursForDay, slotTimesForDate } from '../clinic-admin/clinicSettings.js';
import { isVetOnDuty, vetsOnDuty } from '../clinic-admin/rosterStore.js';
import { findVetConflict } from '../medical-assistant/vetScheduling.js';
import { listVisits } from '../medical-assistant/visitStore.js';
import { isSlotBlockingStatus, listAllBookings } from './bookingStore.js';
import { isDateString, nowTimeString, todayString } from './clinicSchedule.js';

function dayOfWeek(dateString) {
  const [y, m, d] = dateString.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

function baseSlotsForDate(date) {
  if (!isDateString(date)) return [];
  const closure = getClosure(date);
  if (closure) return { base: [], reason: `คลินิกปิดทำการ: ${closure.reason}` };
  if (getHoursForDay(dayOfWeek(date)) === null) {
    return { base: [], reason: 'คลินิกปิดทำการวันนี้' };
  }
  if (!vetsOnDuty(date).length) {
    return { base: [], reason: 'วันนี้ไม่มีสัตวแพทย์เข้าเวร' };
  }
  let base = slotTimesForDate(date);
  if (date === todayString()) {
    const now = nowTimeString();
    base = base.filter((t) => t > now);
  }
  return { base, reason: null };
}

function isTimeSlotTaken(bookings, date, time, excludeBookingId = null) {
  return bookings.some(
    (b) => b.id !== excludeBookingId
      && isSlotBlockingStatus(b.status)
      && b.date === date
      && b.time === time,
  );
}

/** Public online booking slots, optionally filtered by preferred vet (empty = any vet on duty free). */
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
  const visitsMap = new Map(visits.map((v) => [v.bookingId, v]));

  if (vetId) {
    if (!isVetOnDuty(vetId, date)) {
      return { date, bookable: false, reason: 'สัตวแพทย์ที่เลือกไม่ได้เข้าเวรวันนี้', slots: [] };
    }
    const vet = listStaff('veterinarian').find((v) => v.id === vetId);
    if (!vet) {
      return { date, bookable: false, reason: 'ไม่พบสัตวแพทย์ที่เลือก', slots: [] };
    }
    const slots = base.filter(
      (time) =>
        !isTimeSlotTaken(bookings, date, time)
        && !findVetConflict(bookings, visitsMap, {
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
      reason: slots.length ? null : 'สัตวแพทย์ที่เลือกไม่มีช่วงเวลาว่างในวันนี้',
      slots,
    };
  }

  const onDuty = vetsOnDuty(date);
  const slots = base.filter(
    (time) => !isTimeSlotTaken(bookings, date, time)
      && onDuty.some(
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
    reason: slots.length ? null : 'ไม่มีช่วงเวลาว่างในวันนี้',
    slots,
  };
}