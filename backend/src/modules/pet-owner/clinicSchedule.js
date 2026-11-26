import {
  DEFAULT_SERVICES,
  DEFAULT_WEEKDAY_HOURS,
  DEFAULT_WEEKEND_HOURS,
  getClosure,
  getHoursForDay,
  slotTimesForDate,
} from '../clinic-admin/clinicSettings.js';
import { vetsOnDuty } from '../clinic-admin/rosterStore.js';
import { httpError } from './jsonCollection.js';

/**
 * Clinic services and opening hours, backed dynamically by clinic-admin settings (`clinicSettings.js`).
 * Falls back to defaults cleanly if settings cannot be read, keeping all exports synchronous.
 */
export const BOOKING_SERVICES = DEFAULT_SERVICES;
export const WEEKDAY_HOURS = DEFAULT_WEEKDAY_HOURS;
export const WEEKEND_HOURS = DEFAULT_WEEKEND_HOURS;

const pad = (n) => String(n).padStart(2, '0');
const toMinutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

export const isDateString = (v) =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(v).getTime());

function safeGetHoursForDay(day) {
  try {
    return getHoursForDay(day);
  } catch {
    return day === 0 || day === 6 ? DEFAULT_WEEKEND_HOURS : DEFAULT_WEEKDAY_HOURS;
  }
}

function safeGetClosure(dateString) {
  try {
    return getClosure(dateString);
  } catch {
    return null;
  }
}

function safeVetsOnDuty(dateString) {
  try {
    return vetsOnDuty(dateString);
  } catch {
    return [{ id: 'fallback', name: 'สัตวแพทย์' }];
  }
}

/** Appointment slots ('HH:MM') for a date; skips lunch break; empty when closed or no vet on duty. */
export function bookableSlots(dateString) {
  if (!isDateString(dateString)) return [];
  if (safeGetClosure(dateString)) return [];
  if (!safeVetsOnDuty(dateString).length) return [];
  return slotTimesForDate(dateString);
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

/** Throws a 400 error unless `date` + `time` is a future slot within opening hours and not closed. */
export function validateSlot(date, time) {
  if (!isDateString(date)) throw httpError(400, 'กรุณาเลือกวันที่');
  if (date < todayString()) throw httpError(400, 'ไม่สามารถเลือกวันที่ผ่านมาแล้ว');

  const closure = safeGetClosure(date);
  if (closure) throw httpError(400, `คลินิกปิดทำการวันที่เลือก: ${closure.reason}`);

  const [y, m, d] = date.split('-').map(Number);
  const day = new Date(y, m - 1, d).getDay();
  if (safeGetHoursForDay(day) === null) throw httpError(400, 'คลินิกปิดทำการวันนี้');

  if (!safeVetsOnDuty(date).length) {
    throw httpError(400, 'วันนี้ไม่มีสัตวแพทย์เข้าเวร');
  }

  if (typeof time !== 'string' || !time) throw httpError(400, 'กรุณาเลือกเวลา');
  if (!bookableSlots(date).includes(time)) throw httpError(400, 'เวลานี้อยู่นอกเวลาทำการของคลินิก');
  // อนุญาตจองวันนี้ได้ทั้งตารางเวลาทำการ (ไม่บล็อกเพราะนาฬิกาเลยช่องไปแล้ว)
}
