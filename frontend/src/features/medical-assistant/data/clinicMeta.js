import {
  OPENING_HOURS,
  availableSlots,
  minutesToTime,
  slotsForDate,
  timeToMinutes,
  todayString,
} from './constants.js';

/**
 * Active vet list `{ id, name }[]` from backend `/meta`.
 * Falls back cleanly to legacy `VET_NAMES` if `meta.VETS` is unavailable.
 */
export function vetList(meta) {
  if (Array.isArray(meta?.VETS) && meta.VETS.length > 0) {
    return meta.VETS.map((v) => ({ id: v.id ?? null, name: v.name ?? '' }));
  }
  return (meta?.VET_NAMES ?? []).map((name) => ({ id: null, name }));
}

/**
 * Vets on duty on `date` using `meta.onDutyByDate` (14-day window).
 * Beyond 14 days (no key in `onDutyByDate`), falls back to full `vetList(meta)` —
 * backend enforces duty checks upon confirm/reschedule.
 */
export function vetsOnDutyFor(meta, date) {
  const all = vetList(meta);
  if (!date || !meta?.onDutyByDate || !Object.hasOwn(meta.onDutyByDate, date)) {
    return all;
  }
  const allowedIds = new Set(meta.onDutyByDate[date] ?? []);
  return all.filter((v) => (v.id ? allowedIds.has(v.id) : true));
}

export function apptVetId(appt) {
  return appt?.vetId ?? appt?.visit?.vetId ?? null;
}

export function apptVetName(appt) {
  return appt?.vetName || appt?.visit?.vetName || appt?.visit?.vet || appt?.vet || '';
}

/**
 * Compare an appointment's assigned vet against a vet ref (`{ id, name }` or id/name string).
 * Compares by `id` whenever both sides have ids, otherwise compares by name.
 */
export function isSameVet(appt, vet) {
  if (!appt || !vet) return false;
  const aId = apptVetId(appt);
  const aName = apptVetName(appt);

  if (typeof vet === 'string') {
    return (aId && vet === aId) || (aName && vet === aName);
  }
  const vId = vet.id ?? null;
  const vName = vet.name ?? '';
  if (aId && vId) return aId === vId;
  return Boolean(aName && vName && aName === vName);
}

export function closureFor(meta, date) {
  if (!date || !Array.isArray(meta?.closures)) return null;
  const hit = meta.closures.find((c) => c?.date === date);
  return hit ? { date: hit.date, reason: hit.reason } : null;
}

export function hoursForMeta(meta, date) {
  if (!date) return null;
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return null;
  const day = new Date(y, m - 1, d).getDay();
  if (meta?.HOURS && Object.hasOwn(meta.HOURS, String(day))) {
    return meta.HOURS[String(day)] ?? null;
  }
  return day === 0 || day === 6 ? OPENING_HOURS.weekend : OPENING_HOURS.weekday;
}

/**
 * Generate 30-minute slots for `date` from `meta.HOURS` and `meta.closures`.
 * Falls back to `slotsForDate`/`availableSlots` when `meta.HOURS` is absent.
 */
export function clinicSlots(meta, date, { futureOnly = false } = {}) {
  if (!date || closureFor(meta, date)) return [];
  if (!meta?.HOURS) {
    return futureOnly ? availableSlots(date) : slotsForDate(date);
  }
  const hours = hoursForMeta(meta, date);
  if (!hours) return [];

  const openMin = timeToMinutes(hours.open);
  const closeMin = timeToMinutes(hours.close);
  if (Number.isNaN(openMin) || Number.isNaN(closeMin)) return [];

  const slots = [];
  for (let t = openMin; t + 30 <= closeMin; t += 30) {
    slots.push(minutesToTime(t));
  }

  if (!futureOnly) return slots;
  const today = todayString();
  if (date < today) return [];
  if (date > today) return slots;
  const now = new Date();
  const current = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return slots.filter((s) => s > current);
}
