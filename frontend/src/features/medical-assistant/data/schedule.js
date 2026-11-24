import {
  OPENING_HOURS,
  availableSlots,
  minutesToTime,
  timeToMinutes,
} from './constants.js';

function hoursForDate(dateString) {
  if (!dateString) return OPENING_HOURS.weekday;
  const [y, m, d] = dateString.split('-').map(Number);
  const day = new Date(y, m - 1, d).getDay();
  return day === 0 || day === 6 ? OPENING_HOURS.weekend : OPENING_HOURS.weekday;
}

/** Check whether `[startA, startA+durA)` overlaps `[startB, startB+durB)`. */
export function timeRangesOverlap(startA, durA, startB, durB) {
  return startA < startB + durB && startB < startA + durA;
}

/**
 * Find an active confirmed/completed appointment for the same vet & date whose time overlaps.
 * Frontend warning only — backend is the source of truth (returns 409).
 */
export function findConflict(appointments = [], { vet, date, time, durationMin }, excludeId = null) {
  if (!vet || !date || !time) return null;
  const targetStart = timeToMinutes(time);
  const targetDur = Number(durationMin) || 30;
  if (Number.isNaN(targetStart)) return null;

  for (const appt of appointments) {
    if (excludeId && appt.id === excludeId) continue;
    if (appt.status !== 'confirmed' && appt.status !== 'completed') continue;
    if (appt.visit?.vet !== vet || appt.date !== date) continue;

    const existingStart = timeToMinutes(appt.time);
    if (Number.isNaN(existingStart)) continue;
    const existingDur = Number(appt.visit?.durationMin) || 30;

    if (timeRangesOverlap(targetStart, targetDur, existingStart, existingDur)) {
      return {
        ...appt,
        rangeText: `${appt.time}–${minutesToTime(existingStart + existingDur)} น.`,
      };
    }
  }
  return null;
}

/**
 * Suggest available time slots for a vet on a date using clinic opening hours (slotsForDate/availableSlots).
 */
export function suggestSlots(appointments = [], { vet, date, durationMin = 30, excludeId = null }, limit = 6) {
  if (!date) return [];
  const dur = Number(durationMin) || 30;
  const { close } = hoursForDate(date);
  const closeMin = timeToMinutes(close);
  const candidates = availableSlots(date);
  const slots = [];

  for (const slot of candidates) {
    const startMin = timeToMinutes(slot);
    if (Number.isNaN(startMin) || startMin + dur > closeMin) continue;
    if (!vet || !findConflict(appointments, { vet, date, time: slot, durationMin: dur }, excludeId)) {
      slots.push(slot);
      if (slots.length >= limit) break;
    }
  }
  return slots;
}

/** Active confirmed/completed appointments of a vet on a specific date sorted by start time. */
export function getVetDaySchedule(appointments = [], vet, date, excludeId = null) {
  if (!vet || !date) return [];
  return appointments
    .filter(
      (a) =>
        a.id !== excludeId &&
        a.visit?.vet === vet &&
        a.date === date &&
        (a.status === 'confirmed' || a.status === 'completed'),
    )
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
    .map((a) => {
      const start = timeToMinutes(a.time);
      const dur = Number(a.visit?.durationMin) || 30;
      const end = Number.isNaN(start) ? a.time : minutesToTime(start + dur);
      return {
        id: a.id,
        time: a.time,
        rangeText: `${a.time}–${end}`,
        petName: a.petName,
        stage: a.stage,
      };
    });
}
