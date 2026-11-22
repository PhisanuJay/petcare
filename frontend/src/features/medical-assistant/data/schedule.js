import {
  CLINIC_HOURS,
  FINAL_STATUSES,
  minutesToTime,
  offsetDateKey,
  timeToMinutes,
} from './constants.js';

/**
 * Find the first overlapping active appointment for the same vet and date.
 * Excludes appointments in FINAL_STATUSES and the optional `excludeId`.
 */
export function findConflict(appointments, { vet, date, time, durationMin = 30 }, excludeId = null) {
  if (!vet || !date || !time) return null;
  const start = timeToMinutes(time);
  if (Number.isNaN(start)) return null;
  const end = start + (Number(durationMin) || 30);

  for (const a of appointments) {
    if (a.id === excludeId) continue;
    if (FINAL_STATUSES.includes(a.status)) continue;
    if (a.vet !== vet || a.date !== date) continue;

    const aStart = timeToMinutes(a.time);
    if (Number.isNaN(aStart)) continue;
    const aEnd = aStart + (Number(a.durationMin) || 30);

    if (start < aEnd && aStart < end) {
      return { ...a, rangeText: `${a.time}–${minutesToTime(aEnd)} น.` };
    }
  }
  return null;
}

/**
 * Suggest available clinic time slots for a vet on a given date.
 * Skips past slots when `date` is today, and returns [] for past dates.
 */
export function suggestSlots(
  appointments,
  { vet, date, durationMin = 30, excludeId = null },
  limit = 6,
) {
  if (!vet || !date) return [];
  const todayKey = offsetDateKey(0);
  if (date < todayKey) return [];

  const dur = Number(durationMin) || 30;
  const openMin = timeToMinutes(CLINIC_HOURS.open);
  const closeMin = timeToMinutes(CLINIC_HOURS.close);

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const slots = [];
  for (let m = openMin; m + dur <= closeMin; m += CLINIC_HOURS.slotMin) {
    if (date === todayKey && m <= nowMin) continue;
    const slotTime = minutesToTime(m);
    if (!findConflict(appointments, { vet, date, time: slotTime, durationMin: dur }, excludeId)) {
      slots.push(slotTime);
      if (slots.length >= limit) break;
    }
  }
  return slots;
}

/**
 * Return active appointments for a vet on a specific date sorted by start time.
 */
export function getVetDaySchedule(appointments, vet, date, excludeId = null) {
  if (!vet || !date) return [];
  return appointments
    .filter(
      (a) =>
        a.id !== excludeId &&
        !FINAL_STATUSES.includes(a.status) &&
        a.vet === vet &&
        a.date === date,
    )
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
    .map((a) => {
      const start = timeToMinutes(a.time);
      const end = Number.isNaN(start) ? NaN : start + (Number(a.durationMin) || 30);
      return {
        ...a,
        rangeText: Number.isNaN(end) ? `${a.time} น.` : `${a.time}–${minutesToTime(end)} น.`,
      };
    });
}
