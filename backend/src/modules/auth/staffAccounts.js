import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { httpError } from '../pet-owner/jsonCollection.js';
import {
  emailTaken,
  listUsersByRole,
  updateUserFields,
  upsertUser,
} from './usersRepository.js';

/**
 * Staff accounts live in dbo.users (roles below). In-memory cache keeps existing sync call sites working.
 */
export const ROLES = ['veterinarian', 'medical_assistant', 'clinic_admin', 'accountant'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
let cache = [];
let readyPromise = null;

/** Same scheme as auth/routes + seedUsers (scrypt over salt hex string, 64 bytes). */
const hashPasswordHex = (password, saltHex) =>
  scryptSync(String(password ?? ''), String(saltHex), 64).toString('hex');

function displayName(user) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email;
}

function toStaffShape(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: displayName(user),
    email: user.email,
    role: user.role,
    active: user.active !== false,
    salt: user.salt,
    passwordHash: user.passwordHash,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

async function loadStaffFromDb() {
  const groups = await Promise.all(ROLES.map((role) => listUsersByRole(role)));
  cache = groups.flat().map(toStaffShape).filter(Boolean);
  return cache;
}

export async function ensureStaffReady() {
  if (!readyPromise) {
    readyPromise = loadStaffFromDb().catch((error) => {
      readyPromise = null;
      throw error;
    });
  }
  return readyPromise;
}

async function refreshStaffCache() {
  readyPromise = loadStaffFromDb();
  return readyPromise;
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
  return cache
    .filter((a) => a.active && a.role === role)
    .map(toPublicStaff);
}

export function findStaffById(id) {
  return cache.find((a) => a.id === id && a.active) ?? null;
}

export function findStaffAnyById(id) {
  if (!id) return null;
  const account = cache.find((a) => a.id === id);
  return account ? toAdminPublicStaff(account) : null;
}

function passwordMatches(password, salt, passwordHash) {
  if (!salt || !passwordHash) return false;
  const storedBuf = Buffer.from(passwordHash, 'hex');
  if (!storedBuf.length) return false;

  // dbo.users seeds /auth routes: scrypt(password, saltHexString, 64)
  if (storedBuf.length === 64) {
    const actual = scryptSync(String(password ?? ''), salt, 64);
    return actual.length === storedBuf.length && timingSafeEqual(actual, storedBuf);
  }

  // legacy staff create: scrypt(password, saltBytes, 32)
  const saltBuf = Buffer.from(salt, 'hex');
  const actual = scryptSync(
    String(password ?? ''),
    saltBuf.length ? saltBuf : Buffer.alloc(16),
    32,
  );
  return actual.length === storedBuf.length && timingSafeEqual(actual, storedBuf);
}

/** The matching active account when email and password are right, otherwise null. */
export async function checkStaffLogin(email, password) {
  await ensureStaffReady();
  const normalized = String(email ?? '').trim().toLowerCase();
  const account = cache.find((a) => a.email === normalized);
  if (!account || !account.active) return null;
  if (!passwordMatches(password, account.salt, account.passwordHash)) return null;
  return account;
}

export async function listAllStaff() {
  await ensureStaffReady();
  return cache.map(toAdminPublicStaff);
}

export async function createStaff({ name, email, role, password }) {
  await ensureStaffReady();
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
  if (await emailTaken(normalizedEmail) || cache.some((a) => a.email === normalizedEmail)) {
    throw httpError(409, 'อีเมลนี้มีบัญชีแล้ว');
  }

  const now = new Date().toISOString();
  const salt = randomBytes(16).toString('hex');
  const parts = name.trim().split(/\s+/);
  const created = await upsertUser({
    id: `staff-${randomUUID()}`,
    firstName: parts[0] || name.trim(),
    lastName: parts.slice(1).join(' '),
    email: normalizedEmail,
    role,
    active: true,
    salt,
    passwordHash: hashPasswordHex(password, salt),
    phone: '',
    address: '',
    emergencyName: '',
    emergencyPhone: '',
    avatar: '',
    points: 0,
    vehicle: '',
    plateNumber: '',
    licenseNumber: '',
    licenseExpiry: '',
    createdAt: now,
  });
  await refreshStaffCache();
  return toAdminPublicStaff(toStaffShape(created));
}

export async function updateStaff(id, patch = {}) {
  await ensureStaffReady();
  const current = cache.find((a) => a.id === id);
  if (!current) throw httpError(404, 'ไม่พบบัญชีเจ้าหน้าที่นี้');

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
    if (cache.some((a) => a.id !== id && a.email === normalizedEmail) || await emailTaken(normalizedEmail, id)) {
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
    const otherActiveAdmins = cache.filter(
      (a) => a.id !== id && a.role === 'clinic_admin' && a.active,
    );
    if (otherActiveAdmins.length === 0) {
      throw httpError(409, 'ต้องมีแอดมินที่ใช้งานได้อย่างน้อย 1 คน');
    }
  }

  const parts = nextName.split(/\s+/);
  const updated = await updateUserFields(id, {
    firstName: parts[0] || nextName,
    lastName: parts.slice(1).join(' '),
    email: nextEmail,
    role: nextRole,
    active: nextActive,
  });
  await refreshStaffCache();
  return toAdminPublicStaff(toStaffShape(updated));
}

export async function setStaffPassword(id, password) {
  await ensureStaffReady();
  if (typeof password !== 'string' || password.length < 8) {
    throw httpError(400, 'รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร');
  }
  if (!cache.some((a) => a.id === id)) {
    throw httpError(404, 'ไม่พบบัญชีเจ้าหน้าที่นี้');
  }
  const salt = randomBytes(16).toString('hex');
  await updateUserFields(id, {
    salt,
    passwordHash: hashPasswordHex(password, salt),
  });
  await refreshStaffCache();
  return { ok: true };
}
