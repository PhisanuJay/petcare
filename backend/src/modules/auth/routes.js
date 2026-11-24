import { Router } from 'express';
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

export default router;
