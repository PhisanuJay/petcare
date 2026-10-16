import { Router } from 'express';

/**
 * Pet Owner API module
 * Owner: มะแอ่ว
 * Placeholder routes — implement later.
 */
const router = Router();

router.get('/', (_req, res) => {
  res.json({ module: 'pet-owner', owner: 'มะแอ่ว', status: 'placeholder' });
});

router.get('/my-pets', (_req, res) => {
  res.json({ module: 'pet-owner', page: 'my-pets', status: 'placeholder' });
});

router.get('/services', (_req, res) => {
  res.json({ module: 'pet-owner', page: 'services', status: 'placeholder' });
});

router.get('/booking', (_req, res) => {
  res.json({ module: 'pet-owner', page: 'booking', status: 'placeholder' });
});

router.get('/medical', (_req, res) => {
  res.json({ module: 'pet-owner', page: 'medical', status: 'placeholder' });
});

router.get('/cat-hotel', (_req, res) => {
  res.json({ module: 'pet-owner', page: 'cat-hotel', status: 'placeholder' });
});

router.get('/transport', (_req, res) => {
  res.json({ module: 'pet-owner', page: 'transport', status: 'placeholder' });
});

router.get('/adoption', (_req, res) => {
  res.json({ module: 'pet-owner', page: 'adoption', status: 'placeholder' });
});

router.get('/cctv', (_req, res) => {
  res.json({ module: 'pet-owner', page: 'cctv', status: 'placeholder' });
});

export default router;
