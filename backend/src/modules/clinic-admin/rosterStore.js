import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findStaffAnyById, listStaff } from '../auth/staffAccounts.js';
import { httpError } from '../pet-owner/jsonCollection.js';
import { getClosure, getHoursForDay } from './clinicSettings.js';
import { createSyncJsonStore } from './syncJsonStore.js';

const rosterFile = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'roster.json');
const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(v) {
  if (typeof v !== 'string' || !DATE_RE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

function dayOfWeek(dateString) {
  const [y, m, d] = dateString.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

function normalizeRoster(raw) {
  if (!Array.isArray(raw)) return [];
  const seenStaff = new Set();
  const list = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object' || typeof item.staffId !== 'string') continue;
    if (seenStaff.has(item.staffId)) continue;
    seenStaff.add(item.staffId);

    const weekdays = Array.isArray(item.weekdays)
      ? [...new Set(item.weekdays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort(
          (a, b) => a - b,
        )
      : [...ALL_WEEKDAYS];

    const leaves = Array.isArray(item.leaves)
      ? item.leaves
          .filter(
            (l) =>
              l &&
              typeof l === 'object' &&
              typeof l.id === 'string' &&
              isValidDate(l.from) &&
              isValidDate(l.to) &&
              l.from <= l.to,
          )
          .map((l) => ({
            id: l.id,
            from: l.from,
            to: l.to,
            note: typeof l.note === 'string' ? l.note.trim().slice(0, 100) : '',
          }))
      : [];

    list.push({ staffId: item.staffId, weekdays, leaves });
  }

  return list;
}

const rosterStore = createSyncJsonStore(rosterFile, {
  defaults: () => [],
  normalize: normalizeRoster,
  label: 'rosterStore',
});

export function getRoster(staffId) {
  return rosterStore.get().find((r) => r.staffId === staffId) ?? null;
}

export function isVetOnDuty(staffId, date) {
  if (!staffId || !isValidDate(date)) return false;
  const record = getRoster(staffId);
  if (!record) return true; // Vets without a configured roster are assumed on duty every day
  const day = dayOfWeek(date);
  if (!record.weekdays.includes(day)) return false;
  return !record.leaves.some((l) => date >= l.from && date <= l.to);
}

export function vetsOnDuty(date) {
  if (!isValidDate(date)) return [];
  if (getClosure(date)) return [];
  if (getHoursForDay(dayOfWeek(date)) === null) return [];
  return listStaff('veterinarian').filter((vet) => isVetOnDuty(vet.id, date));
}

function assertVetStaff(staffId) {
  const staff = findStaffAnyById(staffId);
  if (!staff) throw httpError(404, 'ไม่พบข้อมูลสัตวแพทย์');
  if (staff.role !== 'veterinarian') throw httpError(400, 'เจ้าหน้าที่นี้ไม่ใช่สัตวแพทย์');
  return staff;
}

export async function setWeekdays(staffId, weekdays) {
  assertVetStaff(staffId);
  if (!Array.isArray(weekdays)) {
    throw httpError(400, 'ข้อมูลวันเข้าเวรไม่ถูกต้อง');
  }
  const clean = [];
  const seen = new Set();
  for (const d of weekdays) {
    if (!Number.isInteger(d) || d < 0 || d > 6) {
      throw httpError(400, 'วันเข้าเวรต้องเป็นตัวเลข 0–6');
    }
    if (!seen.has(d)) {
      seen.add(d);
      clean.push(d);
    }
  }
  clean.sort((a, b) => a - b);

  return rosterStore.update((records) => {
    const idx = records.findIndex((r) => r.staffId === staffId);
    const updated =
      idx === -1
        ? { staffId, weekdays: clean, leaves: [] }
        : { ...records[idx], weekdays: clean };
    const next = records.slice();
    if (idx === -1) next.push(updated);
    else next[idx] = updated;
    return { value: next, result: updated };
  });
}

export async function addLeave(staffId, { from, to, note = '' } = {}) {
  assertVetStaff(staffId);
  if (!isValidDate(from) || !isValidDate(to)) {
    throw httpError(400, 'กรุณาระบุวันเริ่มต้นและวันสิ้นสุดในรูปแบบ YYYY-MM-DD');
  }
  if (from > to) {
    throw httpError(400, 'วันเริ่มต้นต้องไม่หลังวันสิ้นสุด');
  }
  if (note !== undefined && note !== null && typeof note !== 'string') {
    throw httpError(400, 'หมายเหตุการลาไม่ถูกต้อง');
  }
  const cleanNote = typeof note === 'string' ? note.trim() : '';
  if (cleanNote.length > 100) {
    throw httpError(400, 'หมายเหตุการลาต้องไม่เกิน 100 ตัวอักษร');
  }

  const leave = {
    id: randomUUID(),
    from,
    to,
    note: cleanNote,
  };

  return rosterStore.update((records) => {
    const idx = records.findIndex((r) => r.staffId === staffId);
    const current =
      idx === -1 ? { staffId, weekdays: [...ALL_WEEKDAYS], leaves: [] } : records[idx];
    const updated = {
      ...current,
      leaves: [...current.leaves, leave].sort((a, b) => a.from.localeCompare(b.from)),
    };
    const next = records.slice();
    if (idx === -1) next.push(updated);
    else next[idx] = updated;
    return { value: next, result: leave };
  });
}

export async function removeLeave(staffId, leaveId) {
  assertVetStaff(staffId);
  if (typeof leaveId !== 'string' || !leaveId) {
    throw httpError(400, 'รหัสวันลาไม่ถูกต้อง');
  }
  return rosterStore.update((records) => {
    const idx = records.findIndex((r) => r.staffId === staffId);
    if (idx === -1) throw httpError(404, 'ไม่พบวันลานี้');
    const exists = records[idx].leaves.some((l) => l.id === leaveId);
    if (!exists) throw httpError(404, 'ไม่พบวันลานี้');
    const updated = {
      ...records[idx],
      leaves: records[idx].leaves.filter((l) => l.id !== leaveId),
    };
    const next = records.slice();
    next[idx] = updated;
    return { value: next, result: { ok: true, id: leaveId } };
  });
}
