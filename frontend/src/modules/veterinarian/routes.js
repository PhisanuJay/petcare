import { Router } from 'express';

/**
 * Veterinarian API module
 * Owner: มะแอ่ว
 * Placeholder routes — implement later.
 */
const router = Router();

router.get('/', (_req, res) => {
  res.json({ module: 'veterinarian', owner: 'มะแอ่ว', status: 'placeholder' });
});

router.get('/appointments', (_req, res) => {
  res.json({ module: 'veterinarian', page: 'appointments', status: 'placeholder' });
});

router.get('/patients', (_req, res) => {
  res.json({ module: 'veterinarian', page: 'patients', status: 'placeholder' });
});

router.get('/medical-records', (_req, res) => {
  res.json({ module: 'veterinarian', page: 'medical-records', status: 'placeholder' });
});

router.get('/vaccination', (_req, res) => {
  res.json({ module: 'veterinarian', page: 'vaccination', status: 'placeholder' });
});

router.get('/reports', (_req, res) => {
  res.json({ module: 'veterinarian', page: 'reports', status: 'placeholder' });
});

export default router;
