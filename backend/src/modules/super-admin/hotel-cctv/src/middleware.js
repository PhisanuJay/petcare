const jwt = require('jsonwebtoken');
const { HttpError } = require('./errors');
const { findUserById } = require('./store');
const { hasPermission } = require('./permissions');

function createAuth(config) {
  return async function requireAuth(req, res, next) {
    try {
      const stayView = req.get('x-stay-view') === '1';
      const token = stayView
        ? req.cookies && req.cookies.cathotel_owner
        : req.cookies && req.cookies.cathotel;
      if (!token) throw new HttpError(401, 'UNAUTHORIZED', 'กรุณาเข้าสู่ระบบ');
      const payload = jwt.verify(token, config.jwtSecret);
      const user = await findUserById(payload.sub);
      if (!user || !user.is_active) throw new HttpError(401, 'UNAUTHORIZED', 'กรุณาเข้าสู่ระบบ');
      req.user = user;
      next();
    } catch (error) {
      next(error instanceof HttpError ? error : new HttpError(401, 'UNAUTHORIZED', 'กรุณาเข้าสู่ระบบ'));
    }
  };
}

function requireRole(...roles) {
  const allowed = roles.flat();
  return (req, res, next) => {
    if (!req.user || !allowed.includes(req.user.role)) {
      next(new HttpError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์ทำรายการนี้'));
      return;
    }
    next();
  };
}

function requirePermission(...keys) {
  const needed = keys.flat();
  return (req, res, next) => {
    if (!req.user) {
      next(new HttpError(401, 'UNAUTHORIZED', 'กรุณาเข้าสู่ระบบ'));
      return;
    }
    if (req.user.role === 'admin') {
      next();
      return;
    }
    const ok = needed.some((key) => hasPermission(req.user, key));
    if (!ok) {
      next(new HttpError(403, 'FORBIDDEN', 'บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้'));
      return;
    }
    next();
  };
}

module.exports = { createAuth, requireRole, requirePermission };
