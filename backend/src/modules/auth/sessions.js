import { randomBytes } from 'node:crypto';

/**
 * Staff login sessions, kept in memory: restarting the backend logs everyone out.
 * Fine for development; use a stored session table before real use.
 */
const SESSION_MS = 12 * 60 * 60 * 1000;
const sessions = new Map(); // token -> { staffId, expiresAt }

export function createSession(staffId) {
  const token = randomBytes(32).toString('hex');
  sessions.set(token, { staffId, expiresAt: Date.now() + SESSION_MS });
  return token;
}

/** The staff id for a token, or null when it is unknown or expired. */
export function sessionStaffId(token) {
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session.staffId;
}

export function destroySession(token) {
  sessions.delete(token);
}
