import { findStaffById, toPublicStaff } from './staffAccounts.js';
import { sessionStaffId } from './sessions.js';

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export const bearerToken = (req) => /^Bearer (\S+)$/.exec(req.get('authorization') ?? '')?.[1] ?? null;

/**
 * Only a logged-in staff member with the given role gets through (`req.staff` is set).
 * 401 = not logged in (or the session expired), 403 = logged in with another role.
 */
export function requireStaff(role) {
  return (req, _res, next) => {
    const token = bearerToken(req);
    const staff = token ? findStaffById(sessionStaffId(token)) : null;
    if (!staff) return next(httpError(401, 'กรุณาเข้าสู่ระบบ'));
    if (staff.role !== role) return next(httpError(403, 'บัญชีนี้ไม่มีสิทธิ์ใช้งานส่วนนี้'));
    req.staff = toPublicStaff(staff);
    next();
  };
}
