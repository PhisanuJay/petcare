import { Router } from 'express';
<<<<<<< HEAD
import { bearerToken } from './middleware.js';
import { createSession, destroySession, sessionStaffId } from './sessions.js';
import { checkStaffLogin, findStaffById, toPublicStaff } from './staffAccounts.js';

/**
 * Staff login API (veterinarians now; other staff roles can use it later).
 * Customers still log in on the frontend only — this module does not touch their accounts.
 */
const router = Router();

// POST /staff/login  { email, password } → { token, staff }
router.post('/staff/login', (req, res) => {
  const { email, password } = req.body ?? {};
  const account = checkStaffLogin(email, password);
  // The same message for a wrong email and a wrong password.
  if (!account) return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
  res.json({ token: createSession(account.id), staff: toPublicStaff(account) });
});

// GET /staff/me — who is logged in (the frontend uses it to check a saved session)
router.get('/staff/me', (req, res) => {
  const token = bearerToken(req);
  const staff = token ? findStaffById(sessionStaffId(token)) : null;
  if (!staff) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
  res.json(toPublicStaff(staff));
});

// POST /staff/logout
router.post('/staff/logout', (req, res) => {
  const token = bearerToken(req);
  if (token) destroySession(token);
  res.json({ ok: true });
});

=======
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import {
  createCustomer,
  createCustomerSession,
  findCustomerByEmail,
  publicCustomer,
  requireCustomer,
  revokeCustomerSession,
  updateCustomer,
} from './store.js';

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
  const candidate = await scrypt(password, user?.salt || 'invalid-customer', 64);
  const expected = user ? Buffer.from(user.passwordHash, 'hex') : Buffer.alloc(64);
  return expected.length === candidate.length && timingSafeEqual(expected, candidate);
}

function createLoginResponse(user, remember) {
  const { token, expiresAt } = createCustomerSession(user.id, remember);
  return { user: publicCustomer(user), token, expiresAt: new Date(expiresAt).toISOString() };
}

router.post('/register', async (req, res) => {
  const { firstName, lastName, email, phone, password, remember = true } = req.body ?? {};
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (
    !validName(firstName) ||
    !validName(lastName) ||
    !validEmail(normalizedEmail) ||
    !validPhone(phone) ||
    typeof password !== 'string' ||
    password.length < 8 ||
    password.length > 128 ||
    typeof remember !== 'boolean'
  ) {
    return res.status(400).json({ error: 'กรุณาตรวจสอบข้อมูลสมัครสมาชิก' });
  }
  if (findCustomerByEmail(normalizedEmail)) {
    return res.status(409).json({ error: 'อีเมลนี้ถูกใช้สมัครแล้ว ลองเข้าสู่ระบบแทน' });
  }

  const salt = randomBytes(16).toString('hex');
  const passwordHash = await hashPassword(password, salt);
  const user = createCustomer({
    id: randomUUID(),
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: normalizedEmail,
    phone: phone.replace(/[-\s]/g, ''),
    salt,
    passwordHash,
    createdAt: new Date().toISOString(),
  });

  return res.status(201).json(createLoginResponse(user, remember));
});

router.post('/login', async (req, res) => {
  const { email, password, remember = true } = req.body ?? {};
  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    typeof remember !== 'boolean'
  ) {
    return res.status(400).json({ error: 'กรุณากรอกอีเมลและรหัสผ่าน' });
  }

  const user = findCustomerByEmail(email.trim().toLowerCase());
  if (!(await verifyPassword(password, user))) {
    return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
  }

  return res.json(createLoginResponse(user, remember));
});

router.get('/session', requireCustomer, (req, res) => {
  res.json({ user: publicCustomer(req.customer) });
});

router.post('/logout', requireCustomer, (req, res) => {
  revokeCustomerSession(req.customerSessionToken);
  res.json({ ok: true });
});

router.patch('/profile', requireCustomer, (req, res) => {
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
    const existing = findCustomerByEmail(normalizedEmail);
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

  const user = updateCustomer(req.customer.id, patch);
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
  updateCustomer(req.customer.id, { salt, passwordHash });
  return res.json({ ok: true });
});

>>>>>>> origin/Adoption
export default router;
