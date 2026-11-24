import { httpError } from './jsonCollection.js';

/**
 * Clinic services and opening hours, shared by the Pet Owner, Veterinarian and Medical Assistant modules.
 * Keep in sync with BOOKING_SERVICES / OPENING_HOURS in frontend/src/features/pet-owner/bookingOptions.js
 */
export const BOOKING_SERVICES = {
  checkup: 'ตรวจสุขภาพทั่วไป',
  vaccine: 'ฉีดวัคซีน',
  parasite: 'ถ่ายพยาธิ / เห็บหมัด',
  followup: 'ติดตามอาการ',
  other: 'อื่นๆ',
};

/**
 * Clinic opening hours, taken from the home page (frontend/src/shared/pages/home/InfoSections.jsx):
 * Mon–Fri 08:00–22:00, Sat–Sun 09:00–21:00. Slots are 30 minutes and the last one starts
 * 30 minutes before closing. Emergency care (24h) is not booked online. Public holidays are not handled.
 */
export const WEEKDAY_HOURS = { open: '08:00', close: '22:00' };
export const WEEKEND_HOURS = { open: '09:00', close: '21:00' };

const pad = (n) => String(n).padStart(2, '0');
const toMinutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

export const isDateString = (v) =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(v).getTime());

/** 30-minute slots ('HH:MM') for a 'YYYY-MM-DD' date. */
export function bookableSlots(dateString) {
  const [y, m, d] = dateString.split('-').map(Number);
  const day = new Date(y, m - 1, d).getDay(); // 0 = Sunday, 6 = Saturday
  const { open, close } = day === 0 || day === 6 ? WEEKEND_HOURS : WEEKDAY_HOURS;
  const slots = [];
  for (let t = toMinutes(open); t + 30 <= toMinutes(close); t += 30) {
    slots.push(`${pad(Math.floor(t / 60))}:${pad(t % 60)}`);
  }
  return slots;
}

/** Local date 'YYYY-MM-DD'. */
export function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local time 'HH:MM'. */
export function nowTimeString() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Throws a 400 error unless `date` + `time` is a future slot within opening hours. */
export function validateSlot(date, time) {
  if (!isDateString(date)) throw httpError(400, 'กรุณาเลือกวันที่');
  if (date < todayString()) throw httpError(400, 'ไม่สามารถเลือกวันที่ผ่านมาแล้ว');
  if (typeof time !== 'string' || !time) throw httpError(400, 'กรุณาเลือกเวลา');
  if (!bookableSlots(date).includes(time)) throw httpError(400, 'เวลานี้อยู่นอกเวลาทำการของคลินิก');
  if (date === todayString() && time <= nowTimeString()) throw httpError(400, 'เวลานี้ผ่านไปแล้ว');
}
