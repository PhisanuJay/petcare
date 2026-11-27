/**
 * CCTV UsersPanel accounts: admins (cctv staff), drivers (PetCare), customers (cctv).
 * Mounted under /api/cctv-admin
 */
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { queryAll, queryOne, run } from '../../db/mssql.js';
import {
  findUserByEmail,
  findUserById,
  listUsersByRole,
  updateUserFields,
  upsertUser,
} from '../auth/usersRepository.js';
import { requireCctvPermission } from './cctvAuth.js';

const scrypt = promisify(scryptCallback);
const router = Router();

const PERMISSION_KEYS = [
  'view_cameras',
  'manage_cameras',
  'care_logs',
  'manage_customers',
  'manage_grants',
  'manage_rooms',
  'view_logs',
  'view_settings',
];

function sendError(res, status, code, message) {
  res.status(status).json({ error: { code, message } });
}

function nowIso() {
  return new Date().toISOString();
}

function validId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function normalizePermissions(input = {}) {
  return Object.fromEntries(
    PERMISSION_KEYS.map((key) => [key, Boolean(input[key])]),
  );
}

function splitDisplayName(displayName) {
  const parts = String(displayName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'User', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

async function hashPetcarePassword(password) {
  const salt = randomBytes(16).toString('hex');
  const passwordHash = (await scrypt(password, salt, 64)).toString('hex');
  return { salt, passwordHash };
}

async function permissionsForUser(userId) {
  const row = await queryOne(
    'SELECT * FROM dbo.cctv_staff_permissions WHERE user_id = ?',
    [userId],
  );
  if (!row) return normalizePermissions({});
  return normalizePermissions(row);
}

async function upsertPermissions(userId, permissions) {
  const perms = normalizePermissions(permissions);
  const existing = await queryOne(
    'SELECT user_id FROM dbo.cctv_staff_permissions WHERE user_id = ?',
    [userId],
  );
  if (existing) {
    await run(
      `UPDATE dbo.cctv_staff_permissions SET
        view_cameras = ?, manage_cameras = ?, care_logs = ?,
        manage_customers = ?, manage_grants = ?, manage_rooms = ?,
        view_logs = ?, view_settings = ?
       WHERE user_id = ?`,
      [
        perms.view_cameras ? 1 : 0,
        perms.manage_cameras ? 1 : 0,
        perms.care_logs ? 1 : 0,
        perms.manage_customers ? 1 : 0,
        perms.manage_grants ? 1 : 0,
        perms.manage_rooms ? 1 : 0,
        perms.view_logs ? 1 : 0,
        perms.view_settings ? 1 : 0,
        userId,
      ],
    );
    return;
  }
  await run(
    `INSERT INTO dbo.cctv_staff_permissions
      (user_id, view_cameras, manage_cameras, care_logs, manage_customers,
       manage_grants, manage_rooms, view_logs, view_settings)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      perms.view_cameras ? 1 : 0,
      perms.manage_cameras ? 1 : 0,
      perms.care_logs ? 1 : 0,
      perms.manage_customers ? 1 : 0,
      perms.manage_grants ? 1 : 0,
      perms.manage_rooms ? 1 : 0,
      perms.view_logs ? 1 : 0,
      perms.view_settings ? 1 : 0,
    ],
  );
}

function isSuperAdminRow(row) {
  return row.role === 'admin' && Number(row.id) === 1;
}

async function publicAdmin(row) {
  const permissions = isSuperAdminRow(row)
    ? Object.fromEntries(PERMISSION_KEYS.map((key) => [key, true]))
    : await permissionsForUser(row.id);
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name || row.email,
    role: row.role,
    isActive: Boolean(row.is_active),
    isSuper: isSuperAdminRow(row),
    permissions,
  };
}

function publicCustomer(row) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name || row.email,
    isActive: Boolean(row.is_active),
  };
}

function publicDriver(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email,
    isActive: user.active !== false,
    role: 'driver',
  };
}

async function findCctvUser(id) {
  return queryOne(
    `SELECT id, email, role, display_name, is_active
     FROM dbo.cctv_users WHERE id = ?`,
    [id],
  );
}

// ─── Admins (cctv staff / super admin) ───────────────────────────────────────

router.get('/admins', requireCctvPermission('manage_customers'), async (_req, res) => {
  const rows = await queryAll(
    `SELECT id, email, role, display_name, is_active
     FROM dbo.cctv_users
     WHERE role IN (N'admin', N'staff')
     ORDER BY CASE WHEN role = N'admin' THEN 0 ELSE 1 END, id`,
  );
  const items = [];
  for (const row of rows) items.push(await publicAdmin(row));
  res.json({ items });
});

router.post('/admins', requireCctvPermission('manage_customers'), async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const displayName = String(req.body?.displayName || '').trim().slice(0, 120);
  const password = String(req.body?.password || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !displayName) {
    sendError(res, 400, 'BAD_INPUT', 'กรุณากรอกอีเมลและชื่อให้ถูกต้อง');
    return;
  }
  if (password.length < 4) {
    sendError(res, 400, 'BAD_INPUT', 'รหัสผ่านต้องมีอย่างน้อย 4 ตัว');
    return;
  }
  if (await queryOne('SELECT id FROM dbo.cctv_users WHERE lower(email) = ?', [email])) {
    sendError(res, 409, 'CONFLICT', 'อีเมลนี้มีในระบบแล้ว');
    return;
  }
  const hash = await bcrypt.hash(password, 10);
  const inserted = await queryOne(
    `INSERT INTO dbo.cctv_users (email, password_hash, role, display_name, is_active, created_at)
     OUTPUT INSERTED.id
     VALUES (?, ?, N'staff', ?, 1, ?)`,
    [email, hash, displayName, nowIso()],
  );
  await upsertPermissions(inserted.id, req.body?.permissions);
  const row = await findCctvUser(inserted.id);
  res.status(201).json({ user: await publicAdmin(row), password });
});

router.patch('/admins/:id', requireCctvPermission('manage_customers'), async (req, res) => {
  const id = validId(req.params.id);
  const row = id ? await findCctvUser(id) : null;
  if (!row || !['admin', 'staff'].includes(row.role)) {
    sendError(res, 404, 'NOT_FOUND', 'ไม่พบแอดมินนี้');
    return;
  }
  if (isSuperAdminRow(row)) {
    sendError(res, 403, 'FORBIDDEN', 'แก้บัญชี Super Admin หลักจากหน้านี้ไม่ได้');
    return;
  }
  const displayName = req.body?.displayName !== undefined
    ? String(req.body.displayName || '').trim().slice(0, 120)
    : row.display_name;
  if (!displayName) {
    sendError(res, 400, 'BAD_INPUT', 'ต้องใส่ชื่อ');
    return;
  }
  const password = req.body?.password ? String(req.body.password) : '';
  if (password && password.length < 4) {
    sendError(res, 400, 'BAD_INPUT', 'รหัสผ่านต้องมีอย่างน้อย 4 ตัว');
    return;
  }
  if (password) {
    const hash = await bcrypt.hash(password, 10);
    await run(
      'UPDATE dbo.cctv_users SET display_name = ?, password_hash = ? WHERE id = ?',
      [displayName, hash, id],
    );
  } else {
    await run('UPDATE dbo.cctv_users SET display_name = ? WHERE id = ?', [displayName, id]);
  }
  if (req.body?.permissions) await upsertPermissions(id, req.body.permissions);
  if (typeof req.body?.isActive === 'boolean') {
    await run('UPDATE dbo.cctv_users SET is_active = ? WHERE id = ?', [req.body.isActive ? 1 : 0, id]);
  }
  res.json({
    user: await publicAdmin(await findCctvUser(id)),
    password: password || undefined,
  });
});

router.delete('/admins/:id', requireCctvPermission('manage_customers'), async (req, res) => {
  const id = validId(req.params.id);
  const row = id ? await findCctvUser(id) : null;
  if (!row || !['admin', 'staff'].includes(row.role)) {
    sendError(res, 404, 'NOT_FOUND', 'ไม่พบแอดมินนี้');
    return;
  }
  if (isSuperAdminRow(row)) {
    sendError(res, 403, 'FORBIDDEN', 'ลบบัญชี Super Admin หลักไม่ได้');
    return;
  }
  await run('DELETE FROM dbo.cctv_users WHERE id = ?', [id]);
  res.json({ ok: true });
});

// ─── Drivers (PetCare dbo.users) ─────────────────────────────────────────────

router.get('/drivers', requireCctvPermission('manage_customers'), async (_req, res) => {
  const drivers = await listUsersByRole('driver');
  res.json({
    items: drivers.filter((user) => user.active !== false).map(publicDriver),
  });
});

router.post('/drivers', requireCctvPermission('manage_customers'), async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const displayName = String(req.body?.displayName || '').trim().slice(0, 120);
  const password = String(req.body?.password || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !displayName) {
    sendError(res, 400, 'BAD_INPUT', 'กรุณากรอกอีเมลและชื่อให้ถูกต้อง');
    return;
  }
  if (password.length < 4) {
    sendError(res, 400, 'BAD_INPUT', 'รหัสผ่านต้องมีอย่างน้อย 4 ตัว');
    return;
  }
  if (await findUserByEmail(email)) {
    sendError(res, 409, 'CONFLICT', 'อีเมลนี้มีในระบบแล้ว');
    return;
  }
  const { firstName, lastName } = splitDisplayName(displayName);
  const { salt, passwordHash } = await hashPetcarePassword(password);
  const user = await upsertUser({
    id: randomUUID(),
    email,
    firstName,
    lastName,
    phone: '',
    role: 'driver',
    salt,
    passwordHash,
    active: true,
    points: 0,
    createdAt: nowIso(),
  });
  res.status(201).json({ user: publicDriver(user), password });
});

router.patch('/drivers/:id', requireCctvPermission('manage_customers'), async (req, res) => {
  const id = String(req.params.id || '').trim();
  const user = id ? await findUserById(id) : null;
  if (!user || user.role !== 'driver') {
    sendError(res, 404, 'NOT_FOUND', 'ไม่พบคนขับนี้');
    return;
  }
  const patch = {};
  if (req.body?.displayName !== undefined) {
    const { firstName, lastName } = splitDisplayName(req.body.displayName);
    patch.firstName = firstName;
    patch.lastName = lastName;
  }
  if (req.body?.password) {
    const password = String(req.body.password);
    if (password.length < 4) {
      sendError(res, 400, 'BAD_INPUT', 'รหัสผ่านต้องมีอย่างน้อย 4 ตัว');
      return;
    }
    const { salt, passwordHash } = await hashPetcarePassword(password);
    patch.salt = salt;
    patch.passwordHash = passwordHash;
  }
  if (typeof req.body?.isActive === 'boolean') patch.active = req.body.isActive;
  const updated = Object.keys(patch).length
    ? await updateUserFields(id, patch)
    : user;
  res.json({
    user: publicDriver(updated),
    password: req.body?.password ? String(req.body.password) : undefined,
  });
});

router.delete('/drivers/:id', requireCctvPermission('manage_customers'), async (req, res) => {
  const id = String(req.params.id || '').trim();
  const user = id ? await findUserById(id) : null;
  if (!user || user.role !== 'driver') {
    sendError(res, 404, 'NOT_FOUND', 'ไม่พบคนขับนี้');
    return;
  }
  await updateUserFields(id, { active: false });
  res.json({ ok: true });
});

// ─── Customers CRUD (extend GET already in cctvAdmin) ────────────────────────

router.post('/customers', requireCctvPermission('manage_customers'), async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const displayName = String(req.body?.displayName || '').trim().slice(0, 120);
  const password = String(req.body?.password || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !displayName) {
    sendError(res, 400, 'BAD_INPUT', 'กรุณากรอกอีเมลและชื่อให้ถูกต้อง');
    return;
  }
  if (password.length < 4) {
    sendError(res, 400, 'BAD_INPUT', 'รหัสผ่านต้องมีอย่างน้อย 4 ตัว');
    return;
  }
  if (await queryOne('SELECT id FROM dbo.cctv_users WHERE lower(email) = ?', [email])) {
    sendError(res, 409, 'CONFLICT', 'อีเมลนี้มีในระบบแล้ว');
    return;
  }
  const hash = await bcrypt.hash(password, 10);
  const inserted = await queryOne(
    `INSERT INTO dbo.cctv_users (email, password_hash, role, display_name, is_active, created_at)
     OUTPUT INSERTED.id
     VALUES (?, ?, N'customer', ?, 1, ?)`,
    [email, hash, displayName, nowIso()],
  );
  const row = await findCctvUser(inserted.id);
  res.status(201).json({ user: publicCustomer(row), password });
});

router.patch('/customers/:id', requireCctvPermission('manage_customers'), async (req, res) => {
  const id = validId(req.params.id);
  const row = id ? await findCctvUser(id) : null;
  if (!row || row.role !== 'customer') {
    sendError(res, 404, 'NOT_FOUND', 'ไม่พบลูกค้านี้');
    return;
  }
  const displayName = req.body?.displayName !== undefined
    ? String(req.body.displayName || '').trim().slice(0, 120)
    : row.display_name;
  if (!displayName) {
    sendError(res, 400, 'BAD_INPUT', 'ต้องใส่ชื่อ');
    return;
  }
  const password = req.body?.password ? String(req.body.password) : '';
  if (password && password.length < 4) {
    sendError(res, 400, 'BAD_INPUT', 'รหัสผ่านต้องมีอย่างน้อย 4 ตัว');
    return;
  }
  if (password) {
    const hash = await bcrypt.hash(password, 10);
    await run(
      'UPDATE dbo.cctv_users SET display_name = ?, password_hash = ? WHERE id = ?',
      [displayName, hash, id],
    );
  } else {
    await run('UPDATE dbo.cctv_users SET display_name = ? WHERE id = ?', [displayName, id]);
  }
  if (typeof req.body?.isActive === 'boolean') {
    await run('UPDATE dbo.cctv_users SET is_active = ? WHERE id = ?', [req.body.isActive ? 1 : 0, id]);
  }
  res.json({
    user: publicCustomer(await findCctvUser(id)),
    password: password || undefined,
  });
});

router.delete('/customers/:id', requireCctvPermission('manage_customers'), async (req, res) => {
  const id = validId(req.params.id);
  const row = id ? await findCctvUser(id) : null;
  if (!row || row.role !== 'customer') {
    sendError(res, 404, 'NOT_FOUND', 'ไม่พบลูกค้านี้');
    return;
  }
  await run('DELETE FROM dbo.cctv_users WHERE id = ?', [id]);
  res.json({ ok: true });
});

export default router;
