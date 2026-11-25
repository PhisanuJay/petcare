import { randomBytes } from 'node:crypto';
import {
  emailTaken,
  findUserByEmail,
  findUserById,
  updateUserFields,
  upsertUser,
} from './usersRepository.js';

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
const REMEMBERED_SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const sessions = new Map();

export async function findCustomerByEmail(email) {
  return findUserByEmail(email);
}

export async function findCustomerById(userId) {
  return findUserById(userId);
}

export async function createCustomer(user) {
  if (await emailTaken(user.email)) {
    const err = new Error('อีเมลนี้ถูกใช้สมัครแล้ว ลองเข้าสู่ระบบแทน');
    err.status = 409;
    throw err;
  }
  return upsertUser({
    ...user,
    role: user.role || 'owner',
    active: true,
  });
}

export async function updateCustomer(userId, patch) {
  return updateUserFields(userId, patch);
}

export function createCustomerSession(userId, remember) {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(token);
  }

  const token = randomBytes(32).toString('hex');
  const expiresAt = now + (remember ? REMEMBERED_SESSION_DURATION_MS : SESSION_DURATION_MS);
  sessions.set(token, { userId, expiresAt });
  return { token, expiresAt };
}

export async function getCustomerSession(req) {
  const token = req.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  const session = token ? sessions.get(token) : null;
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }

  const user = await findUserById(session.userId);
  if (!user || user.active === false) {
    sessions.delete(token);
    return null;
  }
  return { token, user };
}

export function revokeCustomerSession(token) {
  sessions.delete(token);
}

export async function requireCustomer(req, res, next) {
  try {
    const session = await getCustomerSession(req);
    if (!session) {
      return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบสมาชิก' });
    }
    req.customer = session.user;
    req.customerSessionToken = session.token;
    return next();
  } catch (error) {
    return next(error);
  }
}

export function publicCustomer(user) {
  if (!user) return null;
  const { passwordHash: _passwordHash, salt: _salt, ...publicUser } = user;
  return publicUser;
}
