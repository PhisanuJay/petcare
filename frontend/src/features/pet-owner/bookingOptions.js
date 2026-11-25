import { useEffect, useState } from 'react';
import { API_BASE } from './api.js';

// Fallback service list & icons. Live online availability comes from /api/clinic-admin/public/clinic-info.
export const BOOKING_SERVICES = [
  { value: 'checkup', label: 'ตรวจสุขภาพทั่วไป', icon: 'bi-heart-pulse' },
  { value: 'vaccine', label: 'ฉีดวัคซีน', icon: 'bi-capsule' },
  { value: 'parasite', label: 'ถ่ายพยาธิ / เห็บหมัด', icon: 'bi-bug' },
  { value: 'followup', label: 'ติดตามอาการ', icon: 'bi-journal-medical' },
  { value: 'other', label: 'อื่นๆ', icon: 'bi-three-dots' },
];

/**
 * Fallback clinic opening hours. Live hours & closures come from /api/clinic-admin/public/clinic-info.
 * Emergency care (24h) is not booked online.
 */
export const OPENING_HOURS = {
  weekday: { label: 'จันทร์ - ศุกร์', open: '08:00', close: '22:00' },
  weekend: { label: 'เสาร์ - อาทิตย์', open: '09:00', close: '21:00' },
};
export const CLINIC_PHONE = '02-123-4567';

export const FALLBACK_CLINIC_INFO = {
  hours: {
    0: { open: OPENING_HOURS.weekend.open, close: OPENING_HOURS.weekend.close },
    1: { open: OPENING_HOURS.weekday.open, close: OPENING_HOURS.weekday.close },
    2: { open: OPENING_HOURS.weekday.open, close: OPENING_HOURS.weekday.close },
    3: { open: OPENING_HOURS.weekday.open, close: OPENING_HOURS.weekday.close },
    4: { open: OPENING_HOURS.weekday.open, close: OPENING_HOURS.weekday.close },
    5: { open: OPENING_HOURS.weekday.open, close: OPENING_HOURS.weekday.close },
    6: { open: OPENING_HOURS.weekend.open, close: OPENING_HOURS.weekend.close },
  },
  services: BOOKING_SERVICES.map(({ value, label }) => ({ code: value, label })),
  closures: [],
  slotMinutes: 30,
  fallback: true,
};

const toMinutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
const pad = (n) => String(n).padStart(2, '0');
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const WEEKDAY_NAMES_TH = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const SUMMARY_DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedInfo = null;
let cachedAt = 0;
let inflightClinicInfo = null;

function isValidClinicInfo(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  if (!body.hours || typeof body.hours !== 'object' || Array.isArray(body.hours)) return false;
  for (let d = 0; d <= 6; d += 1) {
    const val = body.hours[String(d)];
    if (val === null) continue;
    if (!val || typeof val !== 'object' || Array.isArray(val)) return false;
    if (!TIME_RE.test(val.open ?? '') || !TIME_RE.test(val.close ?? '')) return false;
    if (toMinutes(val.close) - toMinutes(val.open) < 30) return false;
  }
  if (!Array.isArray(body.services) || !Array.isArray(body.closures)) return false;
  return true;
}

/**
 * Fetch public clinic schedule/services/closures without throwing.
 * Returns null on network error, timeout (5s), non-2xx HTTP status, or malformed payload.
 */
export async function fetchClinicInfo() {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 5000) : null;
  try {
    const res = await fetch(`${API_BASE}/api/clinic-admin/public/clinic-info`, {
      ...(controller ? { signal: controller.signal } : {}),
    });
    if (!res.ok) return null;
    const body = await res.json().catch(() => null);
    if (!isValidClinicInfo(body)) return null;
    return {
      hours: body.hours,
      services: body.services,
      closures: body.closures,
      slotMinutes: body.slotMinutes ?? 30,
      fallback: false,
    };
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function getFreshCachedInfo() {
  if (cachedInfo && Date.now() - cachedAt < CACHE_TTL_MS) return cachedInfo;
  return null;
}

/**
 * Load public clinic info once per 5 minutes (shared module cache) with safe FALLBACK_CLINIC_INFO.
 */
export function useClinicInfo() {
  const initialFresh = getFreshCachedInfo();
  const [info, setInfo] = useState(() => initialFresh ?? FALLBACK_CLINIC_INFO);
  const [loading, setLoading] = useState(() => !initialFresh);

  useEffect(() => {
    const fresh = getFreshCachedInfo();
    if (fresh) {
      setInfo(fresh);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    if (!inflightClinicInfo) {
      inflightClinicInfo = fetchClinicInfo().finally(() => {
        inflightClinicInfo = null;
      });
    }

    inflightClinicInfo.then((result) => {
      if (result) {
        cachedInfo = result;
        cachedAt = Date.now();
      }
      if (!cancelled) {
        setInfo(result ?? FALLBACK_CLINIC_INFO);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return { info, loading };
}

export function closureFor(dateString, info) {
  if (!dateString || !Array.isArray(info?.closures)) return null;
  const hit = info.closures.find((c) => c?.date === dateString);
  return hit ? { date: hit.date, reason: hit.reason } : null;
}

export function hoursFor(dateString, info) {
  if (!dateString) return null;
  const [y, m, d] = dateString.split('-').map(Number);
  if (!y || !m || !d) return null;
  const day = new Date(y, m - 1, d).getDay();
  if (info?.hours && Object.hasOwn(info.hours, String(day))) {
    const entry = info.hours[String(day)];
    return entry ? { open: entry.open, close: entry.close } : null;
  }
  const fallback = day === 0 || day === 6 ? OPENING_HOURS.weekend : OPENING_HOURS.weekday;
  return { open: fallback.open, close: fallback.close };
}

/** Format clinic weekly hours for display, merging adjacent days with equal hours. */
export function hoursSummary(info) {
  const hoursMap = info?.hours ?? FALLBACK_CLINIC_INFO.hours;
  const groups = [];
  for (const day of SUMMARY_DAY_ORDER) {
    const entry = hoursMap[String(day)] ?? null;
    const key = entry ? `${entry.open}-${entry.close}` : 'closed';
    const prev = groups[groups.length - 1];
    if (prev && prev.key === key) {
      prev.days.push(day);
    } else {
      groups.push({ key, entry, days: [day] });
    }
  }
  return groups.map(({ entry, days }) => {
    const dayLabel =
      days.length === 1
        ? WEEKDAY_NAMES_TH[days[0]]
        : `${WEEKDAY_NAMES_TH[days[0]]} - ${WEEKDAY_NAMES_TH[days[days.length - 1]]}`;
    return entry ? `${dayLabel} ${entry.open} - ${entry.close} น.` : `${dayLabel} ปิดทำการ`;
  });
}

/** 30-minute slots for a 'YYYY-MM-DD' date; the last slot starts 30 minutes before closing. */
export function slotsForDate(dateString, info) {
  if (!dateString) return [];
  if (info !== undefined && closureFor(dateString, info)) return [];

  let hours;
  if (info !== undefined) {
    hours = hoursFor(dateString, info);
    if (!hours) return [];
  } else {
    const [y, m, d] = dateString.split('-').map(Number);
    const day = new Date(y, m - 1, d).getDay();
    hours = day === 0 || day === 6 ? OPENING_HOURS.weekend : OPENING_HOURS.weekday;
  }

  const slots = [];
  for (let t = toMinutes(hours.open); t + 30 <= toMinutes(hours.close); t += 30) {
    slots.push(`${pad(Math.floor(t / 60))}:${pad(t % 60)}`);
  }
  return slots;
}

/** Slots on `dateString` that are still in the future (all of them unless it is today). */
export function availableSlots(dateString, info) {
  const slots = slotsForDate(dateString, info);
  if (dateString !== todayString()) return slots;
  const now = new Date();
  const current = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return slots.filter((t) => t > current);
}

export const BOOKING_STATUS = {
  pending: { label: 'รอยืนยัน', tone: 'warn' },
  confirmed: { label: 'ยืนยันแล้ว', tone: 'ok' },
  completed: { label: 'เสร็จสิ้น', tone: 'sky' },
  no_show: { label: 'ไม่มาตามนัด', tone: 'danger' },
  rejected: { label: 'คลินิกไม่สามารถรับนัดได้', tone: 'danger' },
  cancel_requested: { label: 'รอแอดมินพิจารณายกเลิก', tone: 'warn' },
  cancelled: { label: 'ยกเลิกแล้ว', tone: '' },
};

/** Bookings the owner can still cancel (the backend enforces the same rule). */
export const OWNER_CANCELLABLE = ['pending', 'confirmed'];

export function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
