// Keep in sync with BOOKING_SERVICES / TIME_SLOT_RE in backend/src/modules/pet-owner/routes.js
export const BOOKING_SERVICES = [
  { value: 'checkup', label: 'ตรวจสุขภาพทั่วไป', icon: 'bi-heart-pulse' },
  { value: 'vaccine', label: 'ฉีดวัคซีน', icon: 'bi-capsule' },
  { value: 'parasite', label: 'ถ่ายพยาธิ / เห็บหมัด', icon: 'bi-bug' },
  { value: 'followup', label: 'ติดตามอาการ', icon: 'bi-journal-medical' },
  { value: 'other', label: 'อื่นๆ', icon: 'bi-three-dots' },
];

/**
 * Clinic opening hours, copied from the home page (shared/pages/home/InfoSections.jsx).
 * Keep in sync with the backend (routes.js). Emergency care (24h) is not booked online.
 */
export const OPENING_HOURS = {
  weekday: { label: 'จันทร์ - ศุกร์', open: '08:00', close: '22:00' },
  weekend: { label: 'เสาร์ - อาทิตย์', open: '09:00', close: '21:00' },
};
export const CLINIC_PHONE = '02-123-4567';

const toMinutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
const pad = (n) => String(n).padStart(2, '0');

/** 30-minute slots for a 'YYYY-MM-DD' date; the last slot starts 30 minutes before closing. */
export function slotsForDate(dateString) {
  if (!dateString) return [];
  const [y, m, d] = dateString.split('-').map(Number);
  const day = new Date(y, m - 1, d).getDay();
  const { open, close } = day === 0 || day === 6 ? OPENING_HOURS.weekend : OPENING_HOURS.weekday;
  const slots = [];
  for (let t = toMinutes(open); t + 30 <= toMinutes(close); t += 30) {
    slots.push(`${pad(Math.floor(t / 60))}:${pad(t % 60)}`);
  }
  return slots;
}

/** Slots on `dateString` that are still in the future (all of them unless it is today). */
export function availableSlots(dateString) {
  const slots = slotsForDate(dateString);
  if (dateString !== todayString()) return slots;
  const now = new Date();
  const current = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return slots.filter((t) => t > current);
}

export const BOOKING_STATUS = {
  pending: { label: 'รอยืนยัน', tone: 'warn' },
  confirmed: { label: 'ยืนยันแล้ว', tone: 'ok' },
  cancelled: { label: 'ยกเลิกแล้ว', tone: '' },
};

export function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
