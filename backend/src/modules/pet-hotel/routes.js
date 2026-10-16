import { Router } from 'express';

/**
 * Pet Hotel API module
 * Owner: ฟ่าง, เจ
 * Placeholder routes — implement later.
 */
const router = Router();

router.get('/', (_req, res) => {
  res.json({ module: 'pet-hotel', owner: 'ฟ่าง, เจ', status: 'placeholder' });
});

router.get('/rooms', (_req, res) => {
  res.json({ module: 'pet-hotel', page: 'rooms', status: 'placeholder' });
});

router.get('/reservations', (_req, res) => {
  res.json({ module: 'pet-hotel', page: 'reservations', status: 'placeholder' });
});

router.get('/check-in-out', (_req, res) => {
  res.json({ module: 'pet-hotel', page: 'check-in-out', status: 'placeholder' });
});

router.get('/pets', (_req, res) => {
  res.json({ module: 'pet-hotel', page: 'pets', status: 'placeholder' });
});

router.get('/care-records', (_req, res) => {
  res.json({ module: 'pet-hotel', page: 'care-records', status: 'placeholder' });
});

router.get('/cctv', (_req, res) => {
  res.json({ module: 'pet-hotel', page: 'cctv', status: 'placeholder' });
});

export default router;
