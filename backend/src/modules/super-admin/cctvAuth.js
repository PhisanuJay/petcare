import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { queryOne } from '../../db/mssql.js';
import { migrateCctv } from './cctvMigrate.js';

const COOKIE_NAME = 'cathotel';
const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;
const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_SECONDS * 1000;
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

const sessions = new Map();
let readyPromise = null;

export function ensureCctvReady() {
  if (!readyPromise) {
    readyPromise = migrateCctv().catch((error) => {
      readyPromise = null;
      throw error;
    });
  }
  return readyPromise;
}

function getSessionToken(req) {
  const cookie = req.headers.cookie || '';
  const entry = cookie.split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`));
  return entry ? entry.slice(COOKIE_NAME.length + 1) : '';
}

async function findUserById(id) {
  return queryOne(
    `SELECT id, email, role, display_name, is_active
     FROM dbo.cctv_users WHERE id = ? AND is_active = 1`,
    [id],
  );
}

async function findSessionUser(token) {
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return findUserById(session.userId);
}

async function publicUser(user) {
  const permissionRow = await queryOne(
    'SELECT * FROM dbo.cctv_staff_permissions WHERE user_id = ?',
    [user.id],
  );
  const isSuper = user.role === 'admin' && Number(user.id) === 1;
  const permissions = Object.fromEntries(
    PERMISSION_KEYS.map((key) => [key, isSuper || Boolean(permissionRow?.[key])]),
  );

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    displayName: user.display_name,
    isActive: Boolean(user.is_active),
    isSuper,
    permissions,
  };
}

export async function getCctvRequestUser(req) {
  await ensureCctvReady();
  const token = getSessionToken(req);
  const user = token ? await findSessionUser(token) : null;
  return user ? publicUser(user) : null;
}

export function requireCctvPermission(permission) {
  return async (req, res, next) => {
    try {
      const user = await getCctvRequestUser(req);
      if (!user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'กรุณาเข้าสู่ระบบ' } });
        return;
      }
      if (!user.isSuper && !user.permissions[permission]) {
        res.status(403).json({ error: { code: 'FORBIDDEN', message: 'ไม่มีสิทธิ์ดำเนินการนี้' } });
        return;
      }
      req.cctvUser = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}

function setSessionCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}`,
  );
}

function unauthorized(res) {
  res.status(401).json({
    error: { code: 'UNAUTHORIZED', message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' },
  });
}

const router = Router();

router.use(async (_req, _res, next) => {
  try {
    await ensureCctvReady();
    next();
  } catch (error) {
    next(error);
  }
});

router.get('/brand', (_req, res) => {
  res.json({ hotelName: 'PetCare Hotel' });
});

router.post('/login', async (req, res) => {
  const loginName = String(req.body?.username || req.body?.email || '').trim();
  const password = req.body?.password;
  if (!loginName || typeof password !== 'string' || password.length === 0) {
    res.status(400).json({ error: { code: 'BAD_INPUT', message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' } });
    return;
  }

  const user = loginName.toLowerCase() === 'admin'
    ? await queryOne(
      `SELECT TOP 1 id, email, password_hash, role, display_name, is_active
       FROM dbo.cctv_users WHERE role = N'admin' AND is_active = 1 ORDER BY id`,
    )
    : await queryOne(
      `SELECT id, email, password_hash, role, display_name, is_active
       FROM dbo.cctv_users WHERE lower(email) = ? AND is_active = 1`,
      [loginName.toLowerCase()],
    );

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    unauthorized(res);
    return;
  }

  const token = randomBytes(32).toString('hex');
  sessions.set(token, {
    userId: user.id,
    expiresAt: Date.now() + SESSION_MAX_AGE_MS,
  });
  setSessionCookie(res, token);
  res.json({ user: await publicUser(user) });
});

router.get('/me', async (req, res) => {
  const token = getSessionToken(req);
  const user = token ? await findSessionUser(token) : null;
  if (!user) {
    if (token) sessions.delete(token);
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'กรุณาเข้าสู่ระบบ' } });
    return;
  }
  res.json({ user: await publicUser(user) });
});

router.post('/logout', (req, res) => {
  const token = getSessionToken(req);
  if (token) sessions.delete(token);
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
  res.json({ ok: true });
});

export default router;
