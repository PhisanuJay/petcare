import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Router } from 'express';
import { bearerToken } from './middleware.js';
import { createSession, destroySession, sessionStaffId } from './sessions.js';
import { checkStaffLogin, findStaffById, toPublicStaff } from './staffAccounts.js';
import {
  createCustomer,
  createCustomerSession,
  findCustomerByEmail,
  publicCustomer,
  requireCustomer,
  revokeCustomerSession,
  updateCustomer,
} from './store.js';
import { listActiveOwners, listUsersByRole, upsertUser } from './usersRepository.js';

const router = Router();
const scrypt = promisify(scryptCallback);

function validEmail(value) {
  return typeof value === 'string' && value.length <= 254 && /^\S+@\S+\.\S+$/.test(value);
}

function validName(value) {
  return typeof value === 'string' && Boolean(value.trim()) && value.trim().length <= 100;
}

function validPhone(value) {
  return typeof value === 'string' && /^0\d{8,9}$/.test(value.replace(/[-\s]/g, ''));
}

async function hashPassword(password, salt) {
  return (await scrypt(password, salt, 64)).toString('hex');
}

async function verifyPassword(password, user) {
  if (!user?.salt || !user?.passwordHash) return false;
  const keyLen = Buffer.from(user.passwordHash, 'hex').length || 64;
  const candidate = await scrypt(password, user.salt, keyLen);
  const expected = Buffer.from(user.passwordHash, 'hex');
  return expected.length === candidate.length && timingSafeEqual(expected, candidate);
}

function createLoginResponse(user, remember) {
  const { token, expiresAt } = createCustomerSession(user.id, remember);
  return { user: publicCustomer(user), token, expiresAt: new Date(expiresAt).toISOString() };
}

router.post('/staff/login', async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    const account = await checkStaffLogin(email, password);
    if (!account) return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    res.json({ token: createSession(account.id), staff: toPublicStaff(account) });
  } catch (error) {
    next(error);
  }
});

router.get('/staff/me', async (req, res, next) => {
  try {
    const token = bearerToken(req);
    const staff = token ? await findStaffById(sessionStaffId(token)) : null;
    if (!staff) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
    res.json(toPublicStaff(staff));
  } catch (error) {
    next(error);
  }
});

router.post('/staff/logout', (req, res) => {
  const token = bearerToken(req);
  if (token) destroySession(token);
  res.json({ ok: true });
});

router.get('/owners', async (_req, res, next) => {
  try {
    const owners = await listActiveOwners();
    res.json({
      owners: owners.map((user) => ({
        id: user.id,
        email: user.email,
        displayName: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
        isActive: user.active !== false,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/register', async (req, res) => {
  const { firstName, lastName, email, phone, password, remember = true } = req.body ?? {};
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (
    !validName(firstName)
    || !validName(lastName)
    || !validEmail(normalizedEmail)
    || !validPhone(phone)
    || typeof password !== 'string'
    || password.length < 8
    || password.length > 128
    || typeof remember !== 'boolean'
  ) {
    return res.status(400).json({ error: 'กรุณาตรวจสอบข้อมูลสมัครสมาชิก' });
  }
  if (await findCustomerByEmail(normalizedEmail)) {
    return res.status(409).json({ error: 'อีเมลนี้ถูกใช้สมัครแล้ว ลองเข้าสู่ระบบแทน' });
  }

  const salt = randomBytes(16).toString('hex');
  const passwordHash = await hashPassword(password, salt);
  try {
    const user = await createCustomer({
      id: randomUUID(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      phone: phone.replace(/[-\s]/g, ''),
      salt,
      passwordHash,
      role: 'owner',
      points: 50,
      createdAt: new Date().toISOString(),
    });
    return res.status(201).json(createLoginResponse(user, remember));
  } catch (error) {
    if (error.status === 409) return res.status(409).json({ error: error.message });
    throw error;
  }
});

const APP_LOGIN_ROLES = new Set([
  'owner',
  'admin',
  'driver',
  'accountant',
  'super_admin',
  'find_home',
]);

router.post('/login', async (req, res) => {
  const { email, password, remember = true } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string' || typeof remember !== 'boolean') {
    return res.status(400).json({ error: 'กรุณากรอกอีเมลและรหัสผ่าน' });
  }

  const user = await findCustomerByEmail(email.trim().toLowerCase());
  if (
    !user
    || user.active === false
    || !APP_LOGIN_ROLES.has(user.role)
    || !(await verifyPassword(password, user))
  ) {
    return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
  }
  return res.json(createLoginResponse(user, remember));
});

router.post('/drivers', requireCustomer, async (req, res, next) => {
  try {
    if (req.customer.role !== 'admin') {
      return res.status(403).json({ error: 'เฉพาะแอดมินเท่านั้นที่สร้างบัญชีคนขับได้' });
    }
    const { firstName, lastName, email, phone, password, vehicle } = req.body ?? {};
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!validName(firstName) || !validName(lastName) || !validEmail(normalizedEmail)) {
      return res.status(400).json({ error: 'กรุณาตรวจสอบข้อมูลคนขับ' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'รหัสผ่านอย่างน้อย 8 ตัวอักษร' });
    }
    if (await findCustomerByEmail(normalizedEmail)) {
      return res.status(409).json({ error: 'อีเมลนี้มีในระบบแล้ว' });
    }
    const salt = randomBytes(16).toString('hex');
    const passwordHash = await hashPassword(password, salt);
    const user = await upsertUser({
      id: randomUUID(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      phone: typeof phone === 'string' ? phone.trim() : '',
      role: 'driver',
      vehicle: typeof vehicle === 'string' ? vehicle.trim() : '',
      salt,
      passwordHash,
      active: true,
      points: 0,
      createdAt: new Date().toISOString(),
    });
    return res.status(201).json({ user: publicCustomer(user) });
  } catch (error) {
    next(error);
  }
});

router.get('/drivers', requireCustomer, async (req, res, next) => {
  try {
    if (req.customer.role !== 'admin') {
      return res.status(403).json({ error: 'เฉพาะแอดมินเท่านั้น' });
    }
    const drivers = await listUsersByRole('driver');
    res.json({ drivers: drivers.map(publicCustomer) });
  } catch (error) {
    next(error);
  }
});

router.get('/session', requireCustomer, (req, res) => {
  res.json({ user: publicCustomer(req.customer) });
});

router.post('/logout', requireCustomer, (req, res) => {
  revokeCustomerSession(req.customerSessionToken);
  res.json({ ok: true });
});

router.patch('/profile', requireCustomer, async (req, res) => {
  const patch = {};
  const { firstName, lastName, email, phone } = req.body ?? {};

  if (firstName !== undefined) {
    if (!validName(firstName)) return res.status(400).json({ error: 'กรุณากรอกชื่อให้ถูกต้อง' });
    patch.firstName = firstName.trim();
  }
  if (lastName !== undefined) {
    if (!validName(lastName)) return res.status(400).json({ error: 'กรุณากรอกนามสกุลให้ถูกต้อง' });
    patch.lastName = lastName.trim();
  }
  if (email !== undefined) {
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!validEmail(normalizedEmail)) return res.status(400).json({ error: 'รูปแบบอีเมลไม่ถูกต้อง' });
    const existing = await findCustomerByEmail(normalizedEmail);
    if (existing && existing.id !== req.customer.id) {
      return res.status(409).json({ error: 'อีเมลนี้มีผู้ใช้อื่นใช้แล้ว' });
    }
    patch.email = normalizedEmail;
  }
  if (phone !== undefined) {
    if (typeof phone !== 'string' || phone.length > 30) {
      return res.status(400).json({ error: 'เบอร์โทรไม่ถูกต้อง' });
    }
    patch.phone = phone.trim();
  }
  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: 'ไม่มีข้อมูลบัญชีให้แก้ไข' });
  }

  const user = await updateCustomer(req.customer.id, patch);
  return res.json({ user: publicCustomer(user) });
});

router.patch('/password', requireCustomer, async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร' });
  }
  if (!(await verifyPassword(currentPassword, req.customer))) {
    return res.status(401).json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
  }

  const salt = randomBytes(16).toString('hex');
  const passwordHash = await hashPassword(newPassword, salt);
  await updateCustomer(req.customer.id, { salt, passwordHash });
  return res.json({ ok: true });
});

export default router;
