import { vetsOnDuty } from '../clinic-admin/rosterStore.js';
import { httpError } from '../pet-owner/jsonCollection.js';
import { minutesToTime, overlaps, toMinutes } from './maRules.js';

export function sameVet(visit, { vetId, vet }) {
  if (vetId && visit.vetId) return visit.vetId === vetId;
  if (vetId && !visit.vetId) return visit.vet === vet;
  return Boolean(vet && visit.vet === vet);
}

export function findVetConflict(
  bookings,
  visitsMap,
  { vetId = null, vet, date, time, durationMin },
  excludeId = null,
) {
  const targetStart = toMinutes(time);
  const targetDur = Number(durationMin) || 30;
  if (Number.isNaN(targetStart)) return null;

  for (const b of bookings) {
    if (b.id === excludeId) continue;
    if (b.status !== 'confirmed' && b.status !== 'completed') continue;
    if (b.date !== date) continue;
    const v = visitsMap.get(b.id);
    if (!v || !sameVet(v, { vetId, vet })) continue;

    const bStart = toMinutes(b.time);
    const bDur = Number(v.durationMin) || 30;
    if (overlaps(targetStart, targetDur, bStart, bDur)) {
      return {
        booking: b,
        rangeText: `${b.time}–${minutesToTime(bStart + bDur)} น.`,
      };
    }
  }
  return null;
}

/**
 * Pick a vet for an online booking.
 * @returns {{ id, name }}
 */
export function pickVetForOnlineBooking({
  date,
  time,
  durationMin,
  preferredVetId = '',
  bookings,
  visitsMap,
  excludeBookingId = null,
}) {
  const onDuty = [...vetsOnDuty(date)].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const preferred = typeof preferredVetId === 'string' ? preferredVetId.trim() : '';

  let candidates;
  if (preferred) {
    const match = onDuty.find((v) => v.id === preferred);
    if (!match) {
      throw httpError(400, 'สัตวแพทย์ที่เลือกไม่ได้เข้าเวรวันนี้');
    }
    candidates = [match];
  } else {
    candidates = onDuty;
  }

  if (candidates.length === 0) {
    throw httpError(409, 'ไม่มีสัตวแพทย์ว่างในช่วงเวลานี้ กรุณาเลือกเวลาอื่น');
  }

  for (const vet of candidates) {
    const conflict = findVetConflict(
      bookings,
      visitsMap,
      { vetId: vet.id, vet: vet.name, date, time, durationMin },
      excludeBookingId,
    );
    if (!conflict) {
      return { id: vet.id, name: vet.name ?? '' };
    }
  }

  if (preferred) {
    throw httpError(
      409,
      'สัตวแพทย์ที่เลือกมีนัดในช่วงเวลานี้แล้ว กรุณาเลือกเวลาอื่นหรือเลือกให้คลินิกจัดสรร',
    );
  }
  throw httpError(409, 'ไม่มีสัตวแพทย์ว่างในช่วงเวลานี้ กรุณาเลือกเวลาอื่น');
}