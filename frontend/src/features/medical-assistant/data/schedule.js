import { clinicSlots, closureFor, hoursForMeta, isSameVet } from './clinicMeta.js';
import { minutesToTime, timeToMinutes } from './constants.js';

/** Check whether `[startA, startA+durA)` overlaps `[startB, startB+durB)`. */
export function timeRangesOverlap(startA, durA, startB, durB) {
  return startA < startB + durB && startB < startA + durA;
}

/**
 * Find an active confirmed/completed appointment for the same vet & date whose time overlaps.
 * `vet` may be `{ id, name }` or an id/name string.
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
    if (appt.date !== date || !isSameVet(appt, vet)) continue;

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
 * Suggest available time slots for a vet on a date using live `meta` hours/closures.
 */
export function suggestSlots(
  appointments = [],
  { vet, date, durationMin = 30, excludeId = null, meta = null },
  limit = 6,
) {
  if (!date || closureFor(meta, date)) return [];
  const hours = hoursForMeta(meta, date);
  if (!hours) return [];

  const dur = Number(durationMin) || 30;
  const closeMin = timeToMinutes(hours.close);
  const candidates = clinicSlots(meta, date, { futureOnly: true });
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
        isSameVet(a, vet) &&
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
