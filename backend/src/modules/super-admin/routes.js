import { Router } from 'express';

/**
 * Super Admin API module
 * Owner: ฟ่าง (Xsup404)
 * Placeholder routes for monorepo shell.
 * Full Pet Hotel CCTV API lives in ./hotel-cctv (standalone).
 */
const router = Router();

router.get('/', (_req, res) => {
  res.json({
    module: 'super-admin',
    owner: 'ฟ่าง',
    github: 'Xsup404',
    status: 'placeholder',
    hotelCctv: 'see ./hotel-cctv',
  });
});

router.get('/users', (_req, res) => {
  res.json({ module: 'super-admin', page: 'users', status: 'placeholder' });
});

router.get('/roles-permissions', (_req, res) => {
  res.json({ module: 'super-admin', page: 'roles-permissions', status: 'placeholder' });
});

router.get('/providers', (_req, res) => {
  res.json({ module: 'super-admin', page: 'providers', status: 'placeholder' });
});

router.get('/pricing', (_req, res) => {
  res.json({ module: 'super-admin', page: 'pricing', status: 'placeholder' });
});

router.get('/promotions', (_req, res) => {
  res.json({ module: 'super-admin', page: 'promotions', status: 'placeholder' });
});

router.get('/reports', (_req, res) => {
  res.json({ module: 'super-admin', page: 'reports', status: 'placeholder' });
});

router.get('/settings', (_req, res) => {
  res.json({ module: 'super-admin', page: 'settings', status: 'placeholder' });
});

export default router;
