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
  const targetDur = Math.min(Math.max(Number(durationMin) || 30, 15), 120);
  if (Number.isNaN(targetStart)) return null;

  for (const b of bookings) {
    if (b.id === excludeId) continue;
    if (b.status !== 'confirmed' && b.status !== 'completed') continue;
    if (b.date !== date) continue;
    const v = visitsMap.get(b.id);
    if (!v || !sameVet(v, { vetId, vet })) continue;

    const bStart = toMinutes(b.time);
    // กัน duration ผิดปกติ (เคยคูณจำนวนบริการจนบล็อกทั้งวัน)
    const bDur = Math.min(Math.max(Number(v.durationMin) || 30, 15), 120);
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

  if (preferred) {
    const match = onDuty.find((v) => v.id === preferred);
    if (!match) {
      throw httpError(400, 'สัตวแพทย์ที่เลือกไม่ได้เข้าเวรวันนี้');
    }
    // จองออนไลน์ยึดหมอที่ลูกค้าเลือกได้เลย (ตารางเวรครบทุกคน)
    return { id: match.id, name: match.name ?? '' };
  }

  if (onDuty.length === 0) {
    throw httpError(409, 'ไม่มีสัตวแพทย์ว่างในช่วงเวลานี้ กรุณาเลือกเวลาอื่น');
  }

  for (const vet of onDuty) {
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

  // ถ้าทุกคนชนนัดเก่า ให้จัดสรรคนแรกที่เข้าเวร — ไม่บล็อกการจองออนไลน์
  const fallback = onDuty[0];
  return { id: fallback.id, name: fallback.name ?? '' };
}