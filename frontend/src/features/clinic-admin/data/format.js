export const WEEKDAYS_TH = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

export const WEEKDAYS_FULL_TH = [
  'วันอาทิตย์',
  'วันจันทร์',
  'วันอังคาร',
  'วันพุธ',
  'วันพฤหัสบดี',
  'วันศุกร์',
  'วันเสาร์',
];

/** Display order Monday through Sunday matching the spec (จ.–อา.). */
export const DISPLAY_WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export const ROLE_LABELS = {
  veterinarian: 'สัตวแพทย์',
  medical_assistant: 'ผู้ช่วยสัตวแพทย์',
  clinic_admin: 'แอดมินคลินิก',
};

export const ROLE_TAG_CLASS = {
  veterinarian: 'sky',
  medical_assistant: 'ok',
  clinic_admin: 'warn',
};

export const STATUS_LABELS = {
  pending: 'รอยืนยัน',
  confirmed: 'ยืนยันแล้ว',
  completed: 'เสร็จสิ้น',
  no_show: 'ไม่มาตามนัด',
  rejected: 'ปฏิเสธ',
  cancelled: 'เจ้าของยกเลิก',
};

export const STATUS_ORDER = ['pending', 'confirmed', 'completed', 'no_show', 'rejected', 'cancelled'];

export function toDateKey(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayKey() {
  return toDateKey(new Date());
}

export function addDays(dateKey, delta) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return toDateKey(new Date(y, m - 1, d + delta));
}

export function monthStartKey(dateKey = todayKey()) {
  return `${dateKey.slice(0, 7)}-01`;
}

export function daysBetweenInclusive(from, to) {
  if (!from || !to) return 0;
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.round((end - start) / 86400000) + 1;
}

function parseDateValue(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function formatThaiDate(value, { withWeekday = false } = {}) {
  const dt = parseDateValue(value);
  if (!dt) return '-';
  return dt.toLocaleDateString('th-TH', {
    ...(withWeekday ? { weekday: 'short' } : {}),
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatThaiDateTime(value) {
  const dt = parseDateValue(value);
  if (!dt) return '-';
  const datePart = dt.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const timePart = dt.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${datePart} ${timePart} น.`;
}

export function formatDurationMinutes(minutes) {
  const rounded = Math.round(Number(minutes) || 0);
  if (rounded >= 60) {
    const hours = Math.floor(rounded / 60);
    const mins = rounded % 60;
    return mins > 0 ? `${hours} ชม. ${mins} นาที` : `${hours} ชม.`;
  }
  return `${Math.round((Number(minutes) || 0) * 10) / 10} นาที`;
}

const TEMP_PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

export function generateTempPassword(length = 10) {
  const randomValues = new Uint32Array(length);
  window.crypto.getRandomValues(randomValues);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += TEMP_PASSWORD_CHARS[randomValues[i] % TEMP_PASSWORD_CHARS.length];
  }
  return out;
}

export const TIME_OPTIONS_30M = Array.from({ length: 48 }, (_, idx) => {
  const hh = String(Math.floor(idx / 2)).padStart(2, '0');
  const mm = idx % 2 === 0 ? '00' : '30';
  return `${hh}:${mm}`;
});

export function timeToMinutes(hhmm) {
  if (typeof hhmm !== 'string' || !/^\d{2}:\d{2}$/.test(hhmm)) return NaN;
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
}

export function minus30Minutes(hhmm) {
  const mins = timeToMinutes(hhmm);
  if (!Number.isFinite(mins) || mins < 30) return '';
  const target = mins - 30;
  const hh = String(Math.floor(target / 60)).padStart(2, '0');
  const mm = String(target % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}
