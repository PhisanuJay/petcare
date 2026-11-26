import { useEffect, useState } from 'react';
import { API_BASE } from './api.js';

/** Legacy URL/booking codes → current catalog codes */
export const LEGACY_SERVICE_CODES = {
  vaccine: 'vaccine_combo',
  parasite: 'deworming',
  followup: 'checkup',
  other: 'checkup',
};

export function normalizeServiceCode(code) {
  if (!code) return 'checkup';
  return LEGACY_SERVICE_CODES[code] || code;
}

export function petSpeciesPriceGroup(species) {
  return String(species || '').toLowerCase() === 'cat' ? 'cat' : 'dog';
}

export const BOOKING_SERVICES = [
  {
    value: 'triage',
    label: 'ประเมินอาการเบื้องต้น',
    hint: 'เหมาะเมื่อน้องมีอาการผิดปกติ',
    icon: 'bi-clipboard2-pulse',
  },
  { value: 'checkup', label: 'ตรวจสุขภาพทั่วไป', icon: 'bi-heart-pulse' },
  {
    value: 'vaccine_combo',
    labelDog: 'ฉีดวัคซีนรวม 5–6 โรค',
    labelCat: 'ฉีดวัคซีนรวม 3–4 โรค',
    icon: 'bi-capsule',
  },
  { value: 'vaccine_rabies', label: 'วัคซีนพิษสุนัขบ้า', icon: 'bi-shield-plus' },
  { value: 'deworming', label: 'ถ่ายพยาธิ', icon: 'bi-bug' },
  { value: 'flea_prevention', label: 'ป้องกันเห็บหมัด', icon: 'bi-droplet' },
];

export const CLINIC_SERVICE_PRICES = {
  dog: {
    triage: 350,
    checkup: 450,
    vaccine_combo: 550,
    vaccine_rabies: 250,
    deworming: 150,
    flea_prevention: 450,
  },
  cat: {
    triage: 320,
    checkup: 400,
    vaccine_combo: 500,
    vaccine_rabies: 200,
    deworming: 150,
    flea_prevention: 350,
  },
};

/** Live catalog from /public/clinic-info (fallback to BOOKING_SERVICES / CLINIC_SERVICE_PRICES). */
let liveCatalog = null;

export function setLiveClinicCatalog(services) {
  if (!Array.isArray(services)) {
    liveCatalog = null;
    return;
  }
  liveCatalog = services
    .filter((item) => item && typeof item.code === 'string')
    .map((item) => ({
      code: item.code,
      label: item.label || item.code,
      labelDog: item.labelDog || '',
      labelCat: item.labelCat || '',
      hint: item.hint || '',
      icon: item.icon || 'bi-calendar2-check',
      prices: {
        dog: Number(item.prices?.dog),
        cat: Number(item.prices?.cat),
      },
    }));
}

export function getLiveClinicCatalog() {
  return liveCatalog;
}

export function clinicServiceLabel(serviceCode, species) {
  const code = normalizeServiceCode(serviceCode);
  const group = petSpeciesPriceGroup(species);
  const live = liveCatalog?.find((item) => item.code === code);
  if (live) {
    if (group === 'cat' && live.labelCat) return live.labelCat;
    if (group === 'dog' && live.labelDog) return live.labelDog;
    return live.label || code;
  }
  const meta = BOOKING_SERVICES.find((s) => s.value === code);
  if (!meta) return code;
  if (group === 'cat' && meta.labelCat) return meta.labelCat;
  if (meta.labelDog) return meta.labelDog;
  return meta.label;
}

export function clinicServicePrice(serviceCode, species) {
  const code = normalizeServiceCode(serviceCode);
  const group = petSpeciesPriceGroup(species);
  const live = liveCatalog?.find((item) => item.code === code);
  if (live) {
    const value = live.prices?.[group];
    if (Number.isFinite(value) && value >= 0) return value;
  }
  const table = CLINIC_SERVICE_PRICES[group];
  return table[code] ?? table.checkup;
}

/**
 * Fallback clinic opening hours. Live hours & closures come from /api/clinic-admin/public/clinic-info.
 */
export const OPENING_HOURS = {
  weekday: { label: 'จันทร์ - ศุกร์', open: '09:00', close: '18:00' },
  weekend: { label: 'เสาร์ - อาทิตย์', open: '09:00', close: '17:00' },
};

export const DEFAULT_LUNCH_BREAK = { start: '12:00', end: '13:00' };
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
  services: BOOKING_SERVICES.map((item) => ({
    code: item.value,
    label: item.label || item.labelDog,
    labelDog: item.labelDog,
    labelCat: item.labelCat,
    hint: item.hint,
    icon: item.icon,
    prices: {
      dog: CLINIC_SERVICE_PRICES.dog[item.value],
      cat: CLINIC_SERVICE_PRICES.cat[item.value],
    },
  })),
  vets: [],
  closures: [],
  slotMinutes: 60,
  lunchBreak: { ...DEFAULT_LUNCH_BREAK },
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

function normalizeVets(vets) {
  if (!Array.isArray(vets)) return [];
  return vets
    .filter((v) => v && typeof v.id === 'string' && v.id && typeof v.name === 'string')
    .map((v) => ({ id: v.id, name: v.name }));
}

export async function fetchClinicAvailability(dateString) {
  if (!dateString) return null;
  try {
    const res = await fetch(
      `${API_BASE}/api/clinic-admin/public/clinic-availability?date=${encodeURIComponent(dateString)}`,
    );
    if (!res.ok) return null;
    const body = await res.json().catch(() => null);
    if (!body || typeof body !== 'object') return null;
    return body;
  } catch {
    return null;
  }
}

export async function fetchClinicSlots(dateString, vetId = '') {
  if (!dateString) return null;
  try {
    const params = new URLSearchParams({ date: dateString });
    if (vetId) params.set('vetId', vetId);
    const res = await fetch(
      `${API_BASE}/api/clinic-admin/public/clinic-slots?${params.toString()}`,
    );
    if (!res.ok) return null;
    const body = await res.json().catch(() => null);
    if (!body || typeof body !== 'object') return null;
    return body;
  } catch {
    return null;
  }
}

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
    setLiveClinicCatalog(body.services);
    return {
      hours: body.hours,
      services: body.services,
      vets: normalizeVets(body.vets),
      closures: body.closures,
      slotMinutes: body.slotMinutes ?? 60,
      lunchBreak: body.lunchBreak?.start && body.lunchBreak?.end
        ? { start: body.lunchBreak.start, end: body.lunchBreak.end }
        : DEFAULT_LUNCH_BREAK,
      fallback: false,
    };
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function getFreshCachedInfo() {
  if (!cachedInfo || Date.now() - cachedAt >= CACHE_TTL_MS) return null;
  if (!cachedInfo.fallback && !Array.isArray(cachedInfo.vets)) return null;
  return cachedInfo;
}

setLiveClinicCatalog(FALLBACK_CLINIC_INFO.services);

export function useClinicInfo() {
  const initialFresh = getFreshCachedInfo();
  const [info, setInfo] = useState(() => initialFresh ?? FALLBACK_CLINIC_INFO);
  const [loading, setLoading] = useState(() => !initialFresh);

  useEffect(() => {
    const fresh = getFreshCachedInfo();
    if (fresh) {
      setLiveClinicCatalog(fresh.services);
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
        const next = result ?? FALLBACK_CLINIC_INFO;
        setLiveClinicCatalog(next.services);
        setInfo(next);
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

function slotOverlapsBreak(slotStartMin, durationMin, breakStart, breakEnd) {
  const bStart = toMinutes(breakStart);
  const bEnd = toMinutes(breakEnd);
  return slotStartMin < bEnd && slotStartMin + durationMin > bStart;
}

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

  const step = info?.slotMinutes > 0 ? info.slotMinutes : 60;
  const lunch = info?.lunchBreak?.start && info?.lunchBreak?.end
    ? info.lunchBreak
    : DEFAULT_LUNCH_BREAK;

  const slots = [];
  for (let t = toMinutes(hours.open); t + step <= toMinutes(hours.close); t += step) {
    if (slotOverlapsBreak(t, step, lunch.start, lunch.end)) continue;
    slots.push(`${pad(Math.floor(t / 60))}:${pad(t % 60)}`);
  }
  return slots;
}

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

export const OWNER_CANCELLABLE = ['pending', 'confirmed'];

export function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}