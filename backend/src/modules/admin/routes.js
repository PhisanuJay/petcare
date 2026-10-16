import { Router } from 'express';

/**
 * Admin API module
 * Owner: เจ
 * Placeholder routes — implement later.
 */
const router = Router();

router.get('/', (_req, res) => {
  res.json({ module: 'admin', owner: 'เจ', status: 'placeholder' });
});

router.get('/users', (_req, res) => {
  res.json({ module: 'admin', page: 'users', status: 'placeholder' });
});

router.get('/providers', (_req, res) => {
  res.json({ module: 'admin', page: 'providers', status: 'placeholder' });
});

router.get('/bookings', (_req, res) => {
  res.json({ module: 'admin', page: 'bookings', status: 'placeholder' });
});

router.get('/reports', (_req, res) => {
  res.json({ module: 'admin', page: 'reports', status: 'placeholder' });
});

export default router;
