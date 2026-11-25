import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { httpError } from '../pet-owner/jsonCollection.js';
import { createSyncJsonStore } from './syncJsonStore.js';

// Note: Must NEVER import from `pet-owner/clinicSchedule.js` to avoid circular dependency.
export const DEFAULT_SERVICES = {
  checkup: 'ตรวจสุขภาพทั่วไป',
  vaccine: 'ฉีดวัคซีน',
  parasite: 'ถ่ายพยาธิ / เห็บหมัด',
  followup: 'ติดตามอาการ',
  other: 'อื่นๆ',
};

export const DEFAULT_WEEKDAY_HOURS = { open: '08:00', close: '22:00' };
export const DEFAULT_WEEKEND_HOURS = { open: '09:00', close: '21:00' };

const settingsFile = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'data',
  'clinic-settings.json',
);

const SLOT_TIME_RE = /^([01]\d|2[0-3]):(00|30)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const toMinutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

function isValidDateString(v) {
  if (typeof v !== 'string' || !DATE_RE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

function localTodayString() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function defaultHoursForDay(day) {
  return day === 0 || day === 6 ? { ...DEFAULT_WEEKEND_HOURS } : { ...DEFAULT_WEEKDAY_HOURS };
}

function isValidDayHours(val) {
  if (val === null) return true;
  if (!val || typeof val !== 'object' || Array.isArray(val)) return false;
  if (!SLOT_TIME_RE.test(val.open ?? '') || !SLOT_TIME_RE.test(val.close ?? '')) return false;
  return toMinutes(val.close) - toMinutes(val.open) >= 30;
}

function createDefaultSettings() {
  const hours = {};
  for (let d = 0; d <= 6; d += 1) {
    hours[String(d)] = defaultHoursForDay(d);
  }
  const services = {};
  for (const code of Object.keys(DEFAULT_SERVICES)) {
    services[code] = { online: true };
  }
  return {
    hours,
    services,
    closures: [],
    updatedAt: new Date().toISOString(),
  };
}

function normalizeSettings(raw) {
  const base = createDefaultSettings();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;

  const hours = {};
  for (let d = 0; d <= 6; d += 1) {
    const key = String(d);
    const val = raw.hours?.[key];
    if (val === null) {
      hours[key] = null;
    } else if (isValidDayHours(val)) {
      hours[key] = { open: val.open, close: val.close };
    } else {
      hours[key] = base.hours[key];
    }
  }

  const services = {};
  for (const code of Object.keys(DEFAULT_SERVICES)) {
    const entry = raw.services?.[code];
    services[code] = {
      online: entry && typeof entry.online === 'boolean' ? entry.online : true,
    };
  }

  const seenDates = new Set();
  const closures = [];
  if (Array.isArray(raw.closures)) {
    for (const c of raw.closures) {
      if (!c || typeof c !== 'object' || !isValidDateString(c.date)) continue;
      if (seenDates.has(c.date)) continue;
      seenDates.add(c.date);
      const reason = typeof c.reason === 'string' && c.reason.trim() ? c.reason.trim().slice(0, 100) : 'ปิดทำการ';
      closures.push({ date: c.date, reason });
    }
  }
  closures.sort((a, b) => a.date.localeCompare(b.date));

  return {
    hours,
    services,
    closures,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : base.updatedAt,
  };
}

const settingsStore = createSyncJsonStore(settingsFile, {
  defaults: createDefaultSettings,
  normalize: normalizeSettings,
  label: 'clinicSettings',
});

export function getHoursForDay(day) {
  const key = String(day);
  return settingsStore.get().hours[key] ?? null;
}

export function getClosure(dateString) {
  if (!dateString) return null;
  return settingsStore.get().closures.find((c) => c.date === dateString) ?? null;
}

export function listServices() {
  const { services } = settingsStore.get();
  return Object.entries(DEFAULT_SERVICES).map(([code, label]) => ({
    code,
    label,
    online: services[code]?.online !== false,
  }));
}

export function isServiceOnline(code) {
  if (!Object.hasOwn(DEFAULT_SERVICES, code)) return false;
  return settingsStore.get().services[code]?.online !== false;
}

export function getSettings() {
  return settingsStore.get();
}

export async function updateHours(nextHours) {
  if (!nextHours || typeof nextHours !== 'object' || Array.isArray(nextHours)) {
    throw httpError(400, 'ข้อมูลเวลาทำการไม่ถูกต้อง');
  }

  const validated = {};
  for (let d = 0; d <= 6; d += 1) {
    const key = String(d);
    if (!Object.hasOwn(nextHours, key)) {
      throw httpError(400, 'กรุณาระบุเวลาทำการครบทั้ง 7 วัน (0–6)');
    }
    const val = nextHours[key];
    if (val === null) {
      validated[key] = null;
      continue;
    }
    if (!val || typeof val !== 'object' || Array.isArray(val)) {
      throw httpError(400, `รูปแบบเวลาของวัน ${key} ไม่ถูกต้อง`);
    }
    if (!SLOT_TIME_RE.test(val.open ?? '') || !SLOT_TIME_RE.test(val.close ?? '')) {
      throw httpError(400, 'เวลาต้องอยู่ในรูปแบบ HH:MM โดยลงท้ายด้วย :00 หรือ :30');
    }
    if (toMinutes(val.close) - toMinutes(val.open) < 30) {
      throw httpError(400, 'เวลาเปิดต้องก่อนเวลาปิดอย่างน้อย 30 นาที');
    }
    validated[key] = { open: val.open, close: val.close };
  }

  return settingsStore.update((current) => {
    const updated = {
      ...current,
      hours: validated,
      updatedAt: new Date().toISOString(),
    };
    return { value: updated, result: updated };
  });
}

export async function updateServices(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw httpError(400, 'ข้อมูลบริการไม่ถูกต้อง');
  }

  const entries = Object.entries(patch);
  if (entries.length === 0) {
    throw httpError(400, 'กรุณาระบุบริการที่ต้องการปรับปรุง');
  }
  for (const [code, online] of entries) {
    if (!Object.hasOwn(DEFAULT_SERVICES, code)) {
      throw httpError(400, `ไม่พบรหัสบริการ ${code}`);
    }
    if (typeof online !== 'boolean') {
      throw httpError(400, `ค่าสถานะบริการ ${code} ต้องเป็น boolean`);
    }
  }

  return settingsStore.update((current) => {
    const nextServices = { ...current.services };
    for (const [code, online] of entries) {
      nextServices[code] = { online };
    }
    const updated = {
      ...current,
      services: nextServices,
      updatedAt: new Date().toISOString(),
    };
    return { value: updated, result: listServicesFrom(updated) };
  });
}

function listServicesFrom(settings) {
  return Object.entries(DEFAULT_SERVICES).map(([code, label]) => ({
    code,
    label,
    online: settings.services[code]?.online !== false,
  }));
}

export async function addClosure({ date, reason } = {}) {
  if (!isValidDateString(date)) {
    throw httpError(400, 'กรุณาระบุวันที่ในรูปแบบ YYYY-MM-DD');
  }
  if (date < localTodayString()) {
    throw httpError(400, 'ไม่สามารถเพิ่มวันปิดทำการในอดีตได้');
  }
  let cleanReason = 'ปิดทำการ';
  if (reason !== undefined && reason !== null) {
    if (typeof reason !== 'string') {
      throw httpError(400, 'เหตุผลวันปิดทำการไม่ถูกต้อง');
    }
    const trimmed = reason.trim();
    if (trimmed.length > 100) {
      throw httpError(400, 'เหตุผลวันปิดทำการต้องไม่เกิน 100 ตัวอักษร');
    }
    if (trimmed.length > 0) cleanReason = trimmed;
  }

  return settingsStore.update((current) => {
    if (current.closures.some((c) => c.date === date)) {
      throw httpError(409, 'วันที่นี้ถูกตั้งเป็นวันปิดทำการแล้ว');
    }
    const entry = { date, reason: cleanReason };
    const closures = [...current.closures, entry].sort((a, b) => a.date.localeCompare(b.date));
    const updated = {
      ...current,
      closures,
      updatedAt: new Date().toISOString(),
    };
    return { value: updated, result: entry };
  });
}

export async function removeClosure(date) {
  if (!isValidDateString(date)) {
    throw httpError(400, 'รูปแบบวันที่ไม่ถูกต้อง');
  }
  return settingsStore.update((current) => {
    const exists = current.closures.some((c) => c.date === date);
    if (!exists) throw httpError(404, 'ไม่พบวันปิดทำการนี้');
    const updated = {
      ...current,
      closures: current.closures.filter((c) => c.date !== date),
      updatedAt: new Date().toISOString(),
    };
    return { value: updated, result: { ok: true, date } };
  });
}
