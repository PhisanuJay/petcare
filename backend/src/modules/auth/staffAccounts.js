import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSyncJsonStore } from '../clinic-admin/syncJsonStore.js';
import { httpError } from '../pet-owner/jsonCollection.js';

/**
 * Staff accounts kept in `auth/data/staff.json` (no public sign-up: managed by clinic_admin).
 * DEVELOPMENT SEED ONLY — initial accounts below seed `DEV_PASSWORD` hashed with scrypt when no
 * file exists yet. Replace with production provisioning before live deployment.
 *
 * `role` decides which staff pages and protected APIs a staff member may use.
 */
const DEV_PASSWORD = 'vet12345';

export const ROLES = ['veterinarian', 'medical_assistant', 'clinic_admin', 'accountant'];

const DEV_STAFF = [
  { id: 'staff-vet-1', name: 'สพ.ญ.ณัฐชา ใจดี', email: 'vet1@petcare.clinic', role: 'veterinarian' },
  { id: 'staff-vet-2', name: 'น.สพ.วิทยา รักสัตว์', email: 'vet2@petcare.clinic', role: 'veterinarian' },
  { id: 'staff-vet-3', name: 'สพ.ญ.พิมพ์ชนก แสนสุข', email: 'vet3@petcare.clinic', role: 'veterinarian' },
  { id: 'staff-vet-4', name: 'น.สพ.ธนกฤต ใจเย็น', email: 'vet4@petcare.clinic', role: 'veterinarian' },
  { id: 'staff-ma-1', name: 'สมใจ ช่วยดี', email: 'ma1@petcare.clinic', role: 'medical_assistant' },
  { id: 'staff-ma-2', name: 'กมล ใส่ใจ', email: 'ma2@petcare.clinic', role: 'medical_assistant' },
  { id: 'staff-admin-1', name: 'ผู้ดูแลคลินิก', email: 'admin@petcare.clinic', role: 'clinic_admin' },
  { id: 'staff-accountant-1', name: 'ฝ่ายบัญชี', email: 'accountant@petcare.local', role: 'accountant', password: 'Account1234' },
];

const staffFile = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'staff.json');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const hashPasswordHex = (password, saltHex) =>
  scryptSync(String(password ?? ''), Buffer.from(saltHex, 'hex'), 32).toString('hex');

function createSeedAccounts() {
  const now = new Date().toISOString();
  return DEV_STAFF.map(({ password = DEV_PASSWORD, ...staff }) => {
    const salt = randomBytes(16).toString('hex');
    return {
      ...staff,
      active: true,
      salt,
      passwordHash: hashPasswordHex(password, salt),
      createdAt: now,
      updatedAt: now,
    };
  });
}

function normalizeStaffList(raw) {
  if (!Array.isArray(raw)) return createSeedAccounts();
  return raw
    .filter((item) => item && typeof item === 'object' && typeof item.id === 'string')
    .map((item) => ({
      id: item.id,
      name: String(item.name ?? '').trim(),
      email: String(item.email ?? '').trim().toLowerCase(),
      role: ROLES.includes(item.role) ? item.role : 'veterinarian',
      active: item.active !== false,
      salt: typeof item.salt === 'string' ? item.salt : '',
      passwordHash: typeof item.passwordHash === 'string' ? item.passwordHash : '',
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString(),
    }));
}

const staffStore = createSyncJsonStore(staffFile, {
  defaults: createSeedAccounts,
  normalize: normalizeStaffList,
  label: 'staffAccounts',
});

// Ensure staff.json is created on startup when missing
staffStore.get();

const accountantSeed = createSeedAccounts().find((staff) => staff.role === 'accountant');
if (!staffStore.get().some((staff) => staff.email === accountantSeed.email)) {
  await staffStore.update((accounts) => ({
    value: accounts.some((staff) => staff.email === accountantSeed.email)
      ? accounts
      : [...accounts, accountantSeed],
    result: null,
  }));
}

/** What the frontend may know about a staff member (never salt or passwordHash). */
export const toPublicStaff = ({ id, name, email, role, active = true }) => ({
  id,
  name,
  email,
  role,
  active: Boolean(active),
});

const toAdminPublicStaff = ({ id, name, email, role, active = true, createdAt, updatedAt }) => ({
  id,
  name,
  email,
  role,
  active: Boolean(active),
  createdAt,
  updatedAt,
});

export function listStaff(role) {
  return staffStore
    .get()
    .filter((a) => a.active && a.role === role)
    .map(toPublicStaff);
}

export function findStaffById(id) {
  return staffStore.get().find((a) => a.id === id && a.active) ?? null;
}

export function findStaffAnyById(id) {
  if (!id) return null;
  const account = staffStore.get().find((a) => a.id === id);
  return account ? toAdminPublicStaff(account) : null;
}

/** The matching active account when email and password are right, otherwise null. */
export function checkStaffLogin(email, password) {
  const normalized = String(email ?? '').trim().toLowerCase();
  const account = staffStore.get().find((a) => a.email === normalized);
  const saltBuf = account?.salt ? Buffer.from(account.salt, 'hex') : Buffer.alloc(16);
  const actualBuf = scryptSync(String(password ?? ''), saltBuf.length ? saltBuf : Buffer.alloc(16), 32);
  const storedBuf = account?.passwordHash ? Buffer.from(account.passwordHash, 'hex') : Buffer.alloc(32);

  // Constant-time compare regardless of whether email matched or password lengths differed
  const validHash =
    actualBuf.length === storedBuf.length && timingSafeEqual(actualBuf, storedBuf);
  if (!account || !account.active || !validHash) return null;
  return account;
}

export async function listAllStaff() {
  return staffStore.get().map(toAdminPublicStaff);
}

export async function createStaff({ name, email, role, password }) {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) {
    throw httpError(400, 'กรุณากรอกชื่อเจ้าหน้าที่ 1–100 ตัวอักษร');
  }
  const normalizedEmail = String(email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(normalizedEmail)) {
    throw httpError(400, 'รูปแบบอีเมลไม่ถูกต้อง');
  }
  if (!ROLES.includes(role)) {
    throw httpError(400, 'บทบาทเจ้าหน้าที่ไม่ถูกต้อง');
  }
  if (typeof password !== 'string' || password.length < 8) {
    throw httpError(400, 'รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร');
  }

  return staffStore.update((accounts) => {
    if (accounts.some((a) => a.email === normalizedEmail)) {
      throw httpError(409, 'อีเมลนี้มีบัญชีแล้ว');
    }
    const now = new Date().toISOString();
    const salt = randomBytes(16).toString('hex');
    const created = {
      id: `staff-${randomUUID()}`,
      name: name.trim(),
      email: normalizedEmail,
      role,
      active: true,
      salt,
      passwordHash: hashPasswordHex(password, salt),
      createdAt: now,
      updatedAt: now,
    };
    return {
      value: [...accounts, created],
      result: toAdminPublicStaff(created),
    };
  });
}

export async function updateStaff(id, patch = {}) {
  return staffStore.update((accounts) => {
    const index = accounts.findIndex((a) => a.id === id);
    if (index === -1) throw httpError(404, 'ไม่พบบัญชีเจ้าหน้าที่นี้');

    const current = accounts[index];
    let nextName = current.name;
    let nextEmail = current.email;
    let nextRole = current.role;
    let nextActive = current.active;

    if (patch.name !== undefined) {
      if (typeof patch.name !== 'string' || !patch.name.trim() || patch.name.trim().length > 100) {
        throw httpError(400, 'กรุณากรอกชื่อเจ้าหน้าที่ 1–100 ตัวอักษร');
      }
      nextName = patch.name.trim();
    }

    if (patch.email !== undefined) {
      const normalizedEmail = String(patch.email ?? '').trim().toLowerCase();
      if (!EMAIL_RE.test(normalizedEmail)) {
        throw httpError(400, 'รูปแบบอีเมลไม่ถูกต้อง');
      }
      if (accounts.some((a) => a.id !== id && a.email === normalizedEmail)) {
        throw httpError(409, 'อีเมลนี้มีบัญชีแล้ว');
      }
      nextEmail = normalizedEmail;
    }

    if (patch.role !== undefined) {
      if (!ROLES.includes(patch.role)) {
        throw httpError(400, 'บทบาทเจ้าหน้าที่ไม่ถูกต้อง');
      }
      nextRole = patch.role;
    }

    if (patch.active !== undefined) {
      if (typeof patch.active !== 'boolean') {
        throw httpError(400, 'สถานะการใช้งานไม่ถูกต้อง');
      }
      nextActive = patch.active;
    }

    const wasActiveAdmin = current.role === 'clinic_admin' && current.active;
    const staysActiveAdmin = nextRole === 'clinic_admin' && nextActive;
    if (wasActiveAdmin && !staysActiveAdmin) {
      const otherActiveAdmins = accounts.filter(
        (a) => a.id !== id && a.role === 'clinic_admin' && a.active,
      );
      if (otherActiveAdmins.length === 0) {
        throw httpError(409, 'ต้องมีแอดมินที่ใช้งานได้อย่างน้อย 1 คน');
      }
    }

    const updated = {
      ...current,
      name: nextName,
      email: nextEmail,
      role: nextRole,
      active: nextActive,
      updatedAt: new Date().toISOString(),
    };
    const next = accounts.slice();
    next[index] = updated;
    return { value: next, result: toAdminPublicStaff(updated) };
  });
}

export async function setStaffPassword(id, password) {
  if (typeof password !== 'string' || password.length < 8) {
    throw httpError(400, 'รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร');
  }

  return staffStore.update((accounts) => {
    const index = accounts.findIndex((a) => a.id === id);
    if (index === -1) throw httpError(404, 'ไม่พบบัญชีเจ้าหน้าที่นี้');

    const salt = randomBytes(16).toString('hex');
    const updated = {
      ...accounts[index],
      salt,
      passwordHash: hashPasswordHex(password, salt),
      updatedAt: new Date().toISOString(),
    };
    const next = accounts.slice();
    next[index] = updated;
    return { value: next, result: { ok: true } };
  });
}
