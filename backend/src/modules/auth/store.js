import { randomBytes } from 'node:crypto';

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
const REMEMBERED_SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const usersById = new Map();
const userIdByEmail = new Map();
const sessions = new Map();

export function findCustomerByEmail(email) {
  const userId = userIdByEmail.get(email);
  return userId ? usersById.get(userId) ?? null : null;
}

export function findCustomerById(userId) {
  return usersById.get(userId) ?? null;
}

export function createCustomer(user) {
  usersById.set(user.id, user);
  userIdByEmail.set(user.email, user.id);
  return user;
}

export function updateCustomer(userId, patch) {
  const user = findCustomerById(userId);
  if (!user) return null;

  const updatedUser = { ...user, ...patch };
  if (updatedUser.email !== user.email) {
    userIdByEmail.delete(user.email);
    userIdByEmail.set(updatedUser.email, userId);
  }
  usersById.set(userId, updatedUser);
  return updatedUser;
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

export function getCustomerSession(req) {
  const token = req.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  const session = token ? sessions.get(token) : null;
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }

  const user = findCustomerById(session.userId);
  if (!user) {
    sessions.delete(token);
    return null;
  }
  return { token, user };
}

export function revokeCustomerSession(token) {
  sessions.delete(token);
}

export function requireCustomer(req, res, next) {
  const session = getCustomerSession(req);
  if (!session) {
    return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบสมาชิก' });
  }

  req.customer = session.user;
  req.customerSessionToken = session.token;
  return next();
}

export function publicCustomer(user) {
  const { passwordHash: _passwordHash, salt: _salt, ...publicUser } = user;
  return publicUser;
}
