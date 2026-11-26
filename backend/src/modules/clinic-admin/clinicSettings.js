import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { httpError } from '../pet-owner/jsonCollection.js';
import { createSyncJsonStore } from './syncJsonStore.js';

// Note: Must NEVER import from `pet-owner/clinicSchedule.js` to avoid circular dependency.

/** Seed catalog — used for defaults and first-run migration. */
export const DEFAULT_SERVICE_CATALOG = [
  {
    code: 'triage',
    label: 'ประเมินอาการเบื้องต้น',
    hint: 'เหมาะเมื่อน้องมีอาการผิดปกติ',
    icon: 'bi-clipboard2-pulse',
    prices: { dog: 350, cat: 320 },
    online: true,
    active: true,
    sortOrder: 0,
  },
  {
    code: 'checkup',
    label: 'ตรวจสุขภาพทั่วไป',
    icon: 'bi-heart-pulse',
    prices: { dog: 450, cat: 400 },
    online: true,
    active: true,
    sortOrder: 1,
  },
  {
    code: 'vaccine_combo',
    label: 'ฉีดวัคซีนรวม',
    labelDog: 'ฉีดวัคซีนรวม 5–6 โรค',
    labelCat: 'ฉีดวัคซีนรวม 3–4 โรค',
    icon: 'bi-capsule',
    prices: { dog: 550, cat: 500 },
    online: true,
    active: true,
    sortOrder: 2,
  },
  {
    code: 'vaccine_rabies',
    label: 'วัคซีนพิษสุนัขบ้า',
    icon: 'bi-shield-plus',
    prices: { dog: 250, cat: 200 },
    online: true,
    active: true,
    sortOrder: 3,
  },
  {
    code: 'deworming',
    label: 'ถ่ายพยาธิ',
    icon: 'bi-bug',
    prices: { dog: 150, cat: 150 },
    online: true,
    active: true,
    sortOrder: 4,
  },
  {
    code: 'flea_prevention',
    label: 'ป้องกันเห็บหมัด',
    icon: 'bi-droplet',
    prices: { dog: 450, cat: 350 },
    online: true,
    active: true,
    sortOrder: 5,
  },
];

/** Legacy label map for older imports (reports / booking labels). */
export const DEFAULT_SERVICES = Object.fromEntries(
  DEFAULT_SERVICE_CATALOG.map((item) => [item.code, item.label]),
);

export const DEFAULT_WEEKDAY_HOURS = { open: '09:00', close: '21:00' };
export const DEFAULT_WEEKEND_HOURS = { open: '09:00', close: '21:00' };
export const DEFAULT_LUNCH_BREAK = { start: '12:00', end: '13:00' };
export const DEFAULT_SLOT_MINUTES = 60;

const settingsFile = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'data',
  'clinic-settings.json',
);

const SLOT_TIME_RE = /^([01]\d|2[0-3]):(00|30)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CODE_RE = /^[a-z][a-z0-9_]{1,31}$/;

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

function moneyOr(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.round(n * 100) / 100;
}

function cloneDefaultCatalog() {
  return DEFAULT_SERVICE_CATALOG.map((item, index) => ({
    code: item.code,
    label: item.label,
    labelDog: item.labelDog || '',
    labelCat: item.labelCat || '',
    hint: item.hint || '',
    icon: item.icon || 'bi-calendar2-check',
    prices: {
      dog: moneyOr(item.prices?.dog, 0),
      cat: moneyOr(item.prices?.cat, 0),
    },
    online: item.online !== false,
    active: item.active !== false,
    sortOrder: Number.isFinite(item.sortOrder) ? item.sortOrder : index,
  }));
}

function normalizeCatalogEntry(raw, fallback = null, index = 0) {
  const seed = fallback || DEFAULT_SERVICE_CATALOG.find((s) => s.code === raw?.code) || null;
  const code = typeof raw?.code === 'string' ? raw.code.trim().toLowerCase() : seed?.code;
  if (!code || !CODE_RE.test(code)) return null;

  const label = typeof raw?.label === 'string' && raw.label.trim()
    ? raw.label.trim().slice(0, 80)
    : (seed?.label || code);
  const labelDog = typeof raw?.labelDog === 'string' ? raw.labelDog.trim().slice(0, 80) : (seed?.labelDog || '');
  const labelCat = typeof raw?.labelCat === 'string' ? raw.labelCat.trim().slice(0, 80) : (seed?.labelCat || '');
  const hint = typeof raw?.hint === 'string' ? raw.hint.trim().slice(0, 160) : (seed?.hint || '');
  const icon = typeof raw?.icon === 'string' && raw.icon.trim()
    ? raw.icon.trim().slice(0, 40)
    : (seed?.icon || 'bi-calendar2-check');

  return {
    code,
    label,
    labelDog,
    labelCat,
    hint,
    icon,
    prices: {
      dog: moneyOr(raw?.prices?.dog, seed?.prices?.dog ?? 0),
      cat: moneyOr(raw?.prices?.cat, seed?.prices?.cat ?? 0),
    },
    online: typeof raw?.online === 'boolean' ? raw.online : (seed?.online !== false),
    active: typeof raw?.active === 'boolean' ? raw.active : (seed?.active !== false),
    sortOrder: Number.isFinite(Number(raw?.sortOrder)) ? Number(raw.sortOrder) : (seed?.sortOrder ?? index),
  };
}

function migrateCatalogFromLegacy(raw) {
  const catalog = cloneDefaultCatalog();
  if (!raw?.services || typeof raw.services !== 'object' || Array.isArray(raw.services)) {
    return catalog;
  }
  return catalog.map((item) => {
    const legacy = raw.services[item.code];
    if (!legacy || typeof legacy !== 'object') return item;
    return {
      ...item,
      online: typeof legacy.online === 'boolean' ? legacy.online : item.online,
    };
  });
}

function normalizeCatalog(raw) {
  if (Array.isArray(raw?.catalog) && raw.catalog.length) {
    const seen = new Set();
    const list = [];
    raw.catalog.forEach((entry, index) => {
      const normalized = normalizeCatalogEntry(entry, null, index);
      if (!normalized || seen.has(normalized.code)) return;
      seen.add(normalized.code);
      list.push(normalized);
    });
    if (list.length) {
      return list.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, 'th'));
    }
  }
  return migrateCatalogFromLegacy(raw);
}

function createDefaultSettings() {
  const hours = {};
  for (let d = 0; d <= 6; d += 1) {
    hours[String(d)] = defaultHoursForDay(d);
  }
  return {
    hours,
    catalog: cloneDefaultCatalog(),
    closures: [],
    slotMinutes: DEFAULT_SLOT_MINUTES,
    lunchBreak: { ...DEFAULT_LUNCH_BREAK },
    updatedAt: new Date().toISOString(),
  };
}

function slotOverlapsBreak(slotStartMin, durationMin, breakStart, breakEnd) {
  const bStart = toMinutes(breakStart);
  const bEnd = toMinutes(breakEnd);
  const slotEnd = slotStartMin + durationMin;
  return slotStartMin < bEnd && slotEnd > bStart;
}

const padTime = (n) => String(n).padStart(2, '0');

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

  const slotMinutes = Number(raw.slotMinutes);
  const lunchRaw = raw.lunchBreak;
  const lunchBreak = lunchRaw?.start && lunchRaw?.end
    ? { start: lunchRaw.start, end: lunchRaw.end }
    : base.lunchBreak;

  return {
    hours,
    catalog: normalizeCatalog(raw),
    closures,
    slotMinutes: Number.isFinite(slotMinutes) && slotMinutes >= 30 ? slotMinutes : base.slotMinutes,
    lunchBreak,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : base.updatedAt,
  };
}

const settingsStore = createSyncJsonStore(settingsFile, {
  defaults: createDefaultSettings,
  normalize: normalizeSettings,
  label: 'clinicSettings',
});

function publicServiceView(item) {
  return {
    code: item.code,
    label: item.label,
    labelDog: item.labelDog || undefined,
    labelCat: item.labelCat || undefined,
    hint: item.hint || undefined,
    icon: item.icon,
    prices: { dog: item.prices.dog, cat: item.prices.cat },
    online: item.online,
  };
}

function adminServiceView(item) {
  return {
    ...publicServiceView(item),
    active: item.active,
    sortOrder: item.sortOrder,
  };
}

export function getHoursForDay(day) {
  const key = String(day);
  return settingsStore.get().hours[key] ?? null;
}

export function getClosure(dateString) {
  if (!dateString) return null;
  return settingsStore.get().closures.find((c) => c.date === dateString) ?? null;
}

/** Admin list (includes inactive). */
export function listServices() {
  return settingsStore.get().catalog
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, 'th'))
    .map(adminServiceView);
}

/** Bookable online services for public/booking. */
export function listBookableServices() {
  return settingsStore.get().catalog
    .filter((item) => item.active && item.online)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, 'th'))
    .map(publicServiceView);
}

export function getService(code) {
  const key = String(code || '').trim().toLowerCase();
  return settingsStore.get().catalog.find((item) => item.code === key) || null;
}

export function isKnownService(code) {
  const item = getService(code);
  return Boolean(item?.active);
}

export function isServiceOnline(code) {
  const item = getService(code);
  return Boolean(item?.active && item.online);
}

export function servicePrice(code, species) {
  const item = getService(code);
  if (!item) return 0;
  const group = String(species || '').toLowerCase() === 'cat' ? 'cat' : 'dog';
  return moneyOr(item.prices?.[group], item.prices?.dog ?? 0);
}

export function serviceLabel(code, species) {
  const item = getService(code);
  if (!item) return code;
  const group = String(species || '').toLowerCase() === 'cat' ? 'cat' : 'dog';
  if (group === 'cat' && item.labelCat) return item.labelCat;
  if (group === 'dog' && item.labelDog) return item.labelDog;
  return item.label;
}

export function getSettings() {
  const settings = settingsStore.get();
  return {
    ...settings,
    // Compat shape for older readers that still expect services map
    services: Object.fromEntries(
      settings.catalog.map((item) => [item.code, { online: item.online }]),
    ),
  };
}

/** Bookable start times for a date (respects hours, lunch break, slot length). */
export function slotTimesForDate(dateString) {
  if (!isValidDateString(dateString)) return [];
  if (getClosure(dateString)) return [];
  const [y, m, d] = dateString.split('-').map(Number);
  const day = new Date(y, m - 1, d).getDay();
  const hours = getHoursForDay(day);
  if (!hours) return [];
  const { slotMinutes, lunchBreak } = settingsStore.get();
  const step = Number(slotMinutes) > 0 ? Number(slotMinutes) : DEFAULT_SLOT_MINUTES;
  const lunch = lunchBreak?.start && lunchBreak?.end ? lunchBreak : DEFAULT_LUNCH_BREAK;
  const slots = [];
  for (let t = toMinutes(hours.open); t + step <= toMinutes(hours.close); t += step) {
    if (slotOverlapsBreak(t, step, lunch.start, lunch.end)) continue;
    slots.push(`${padTime(Math.floor(t / 60))}:${padTime(t % 60)}`);
  }
  return slots;
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

/** Patch online flags: `{ checkup: true, triage: false }`. */
export async function updateServices(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw httpError(400, 'ข้อมูลบริการไม่ถูกต้อง');
  }

  const entries = Object.entries(patch);
  if (entries.length === 0) {
    throw httpError(400, 'กรุณาระบุบริการที่ต้องการปรับปรุง');
  }
  for (const [code, online] of entries) {
    if (!getService(code)) throw httpError(400, `ไม่พบรหัสบริการ ${code}`);
    if (typeof online !== 'boolean') {
      throw httpError(400, `ค่าสถานะบริการ ${code} ต้องเป็น boolean`);
    }
  }

  return settingsStore.update((current) => {
    const catalog = current.catalog.map((item) => {
      if (!Object.hasOwn(patch, item.code)) return item;
      return { ...item, online: patch[item.code] };
    });
    const updated = {
      ...current,
      catalog,
      updatedAt: new Date().toISOString(),
    };
    return {
      value: updated,
      result: catalog
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(adminServiceView),
    };
  });
}

function parseServiceInput(body, { requireCode = false, existing = null } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw httpError(400, 'ข้อมูลบริการไม่ถูกต้อง');
  }

  let code = existing?.code;
  if (requireCode || body.code !== undefined) {
    if (typeof body.code !== 'string' || !CODE_RE.test(body.code.trim().toLowerCase())) {
      throw httpError(400, 'รหัสบริการต้องเป็นภาษาอังกฤษตัวเล็ก ตัวเลข หรือ _ (2–32 ตัว)');
    }
    code = body.code.trim().toLowerCase();
  }
  if (!code) throw httpError(400, 'กรุณาระบุรหัสบริการ');

  const label = body.label !== undefined
    ? String(body.label || '').trim()
    : (existing?.label || '');
  if (!label) throw httpError(400, 'กรุณาระบุชื่อบริการ');
  if (label.length > 80) throw httpError(400, 'ชื่อบริการต้องไม่เกิน 80 ตัวอักษร');

  const pricesIn = body.prices && typeof body.prices === 'object' ? body.prices : {};
  const dog = body.priceDog !== undefined ? body.priceDog : pricesIn.dog;
  const cat = body.priceCat !== undefined ? body.priceCat : pricesIn.cat;

  return {
    code,
    label,
    labelDog: body.labelDog !== undefined
      ? String(body.labelDog || '').trim().slice(0, 80)
      : (existing?.labelDog || ''),
    labelCat: body.labelCat !== undefined
      ? String(body.labelCat || '').trim().slice(0, 80)
      : (existing?.labelCat || ''),
    hint: body.hint !== undefined
      ? String(body.hint || '').trim().slice(0, 160)
      : (existing?.hint || ''),
    icon: body.icon !== undefined
      ? String(body.icon || 'bi-calendar2-check').trim().slice(0, 40) || 'bi-calendar2-check'
      : (existing?.icon || 'bi-calendar2-check'),
    prices: {
      dog: moneyOr(dog, existing?.prices?.dog ?? 0),
      cat: moneyOr(cat, existing?.prices?.cat ?? 0),
    },
    online: typeof body.online === 'boolean' ? body.online : (existing?.online !== false),
    active: typeof body.active === 'boolean' ? body.active : (existing?.active !== false),
    sortOrder: Number.isFinite(Number(body.sortOrder))
      ? Number(body.sortOrder)
      : (existing?.sortOrder ?? 100),
  };
}

export async function createService(body) {
  const entry = parseServiceInput(body, { requireCode: true });
  return settingsStore.update((current) => {
    if (current.catalog.some((item) => item.code === entry.code)) {
      throw httpError(409, 'รหัสบริการนี้มีอยู่แล้ว');
    }
    const catalog = [...current.catalog, entry]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, 'th'));
    const updated = {
      ...current,
      catalog,
      updatedAt: new Date().toISOString(),
    };
    return { value: updated, result: adminServiceView(entry) };
  });
}

export async function updateService(code, body) {
  const existing = getService(code);
  if (!existing) throw httpError(404, 'ไม่พบบริการนี้');
  const entry = parseServiceInput(
    { ...body, code: existing.code },
    { existing },
  );
  return settingsStore.update((current) => {
    const catalog = current.catalog.map((item) => (
      item.code === existing.code ? entry : item
    ));
    const updated = {
      ...current,
      catalog,
      updatedAt: new Date().toISOString(),
    };
    return { value: updated, result: adminServiceView(entry) };
  });
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
