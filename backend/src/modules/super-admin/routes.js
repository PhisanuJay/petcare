import { Router } from 'express';
import { getCustomerSession, publicCustomer } from '../auth/store.js';
import { listAllUsers } from '../auth/usersRepository.js';
import { buildOverview, buildReports } from './overview.js';

/**
 * Super Admin API — real PetCare overview (not placeholder).
 * Auth: Bearer session ของผู้ใช้ role = super_admin (POST /api/auth/login)
 * CCTV ยังอยู่ที่ /api/cctv-admin และ /api/cctv-auth
 */
const router = Router();

async function requireSuperAdmin(req, res, next) {
  try {
    const session = await getCustomerSession(req);
    if (!session) {
      return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
    }
    if (session.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'เฉพาะ Super Admin เท่านั้น' });
    }
    req.customer = session.user;
    req.customerSessionToken = session.token;
    return next();
  } catch (error) {
    return next(error);
  }
}

function wrap(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
}

router.get('/', requireSuperAdmin, wrap(async (_req, res) => {
  res.json({
    module: 'super-admin',
    owner: 'ฟ่าง',
    status: 'ready',
    endpoints: ['/overview', '/users', '/reports'],
    hotelCctv: 'see /api/cctv-admin and /api/cctv-auth',
  });
}));

router.get('/overview', requireSuperAdmin, wrap(async (_req, res) => {
  res.json(await buildOverview());
}));

router.get('/users', requireSuperAdmin, wrap(async (_req, res) => {
  const users = await listAllUsers();
  const publicUsers = users.map((user) => {
    const pub = publicCustomer(user);
    return {
      id: pub.id,
      email: pub.email,
      role: pub.role,
      firstName: pub.firstName,
      lastName: pub.lastName,
      name: [pub.firstName, pub.lastName].filter(Boolean).join(' ').trim() || pub.email,
      phone: pub.phone || '',
      active: pub.active !== false,
      createdAt: pub.createdAt,
    };
  });
  const byRole = publicUsers.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {});
  res.json({
    total: publicUsers.length,
    byRole,
    users: publicUsers,
  });
}));

router.get('/reports', requireSuperAdmin, wrap(async (_req, res) => {
  res.json(await buildReports());
}));

export default router;
