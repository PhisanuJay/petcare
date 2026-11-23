import { Router } from 'express';

/**
 * Medical Assistant API module
 * Owner: เอิร์ท
 * Placeholder routes — implement later.
 */
const router = Router();

router.get('/', (_req, res) => {
  res.json({ module: 'medical-assistant', owner: 'เอิร์ท', status: 'placeholder' });
});

router.get('/appointments', (_req, res) => {
  res.json({ module: 'medical-assistant', page: 'appointments', status: 'placeholder' });
});

router.get('/patients', (_req, res) => {
  res.json({ module: 'medical-assistant', page: 'patients', status: 'placeholder' });
});

router.get('/booking-management', (_req, res) => {
  res.json({ module: 'medical-assistant', page: 'booking-management', status: 'placeholder' });
});

router.get('/medical-support', (_req, res) => {
  res.json({ module: 'medical-assistant', page: 'medical-support', status: 'placeholder' });
});

export default router;
