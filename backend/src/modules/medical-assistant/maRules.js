export const DURATIONS = [15, 30, 45, 60, 90];

export const CAUTION_FLAGS = [
  'aggressive',
  'drug_allergy',
  'anxious',
  'contagious',
  'senior',
];

export const NOTE_CATEGORIES = ['ทั่วไป', 'พฤติกรรม', 'อาการ', 'การติดต่อเจ้าของ'];

export const TRIAGE_LEVELS = ['urgent', 'soon', 'normal'];

export const REJECT_REASONS = [
  'คิวเต็ม',
  'สัตวแพทย์ไม่ว่าง',
  'บริการไม่เปิดให้จองออนไลน์',
  'ข้อมูลไม่ครบ/ติดต่อไม่ได้',
  'อื่นๆ',
];

export const VITAL_LIMITS = {
  weight: { min: 0, max: 150, integer: false },
  temp: { min: 30, max: 45, integer: false },
  heartRate: { min: 20, max: 400, integer: false },
  respRate: { min: 5, max: 150, integer: false },
  bcs: { min: 1, max: 9, integer: true },
  pain: { min: 0, max: 4, integer: true },
};

export const MA_STAGES = [
  'pending',
  'confirmed',
  'checked_in',
  'in_treatment',
  'completed',
  'no_show',
  'rejected',
  'cancelled',
];

export function toMinutes(hhmm) {
  if (typeof hhmm !== 'string' || !/^\d{2}:\d{2}$/.test(hhmm)) return NaN;
  const h = Number(hhmm.slice(0, 2));
  const m = Number(hhmm.slice(3, 5));
  if (h < 0 || h > 23 || m < 0 || m > 59) return NaN;
  return h * 60 + m;
}

export function minutesToTime(totalMin) {
  const clamped = Math.max(0, Math.round(totalMin));
  const h = Math.floor(clamped / 60) % 24;
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function overlaps(aStart, aDur, bStart, bDur) {
  if ([aStart, aDur, bStart, bDur].some((n) => Number.isNaN(n))) return false;
  return aStart < bStart + bDur && bStart < aStart + aDur;
}
