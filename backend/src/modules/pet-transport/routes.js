import { Router } from 'express';

/**
 * Pet Transport API module
 * Owner: โมเดล
 * Placeholder routes — implement later.
 */
const router = Router();

router.get('/', (_req, res) => {
  res.json({ module: 'pet-transport', owner: 'โมเดล', status: 'placeholder' });
});

router.get('/assigned-jobs', (_req, res) => {
  res.json({ module: 'pet-transport', page: 'assigned-jobs', status: 'placeholder' });
});

router.get('/job-detail', (_req, res) => {
  res.json({ module: 'pet-transport', page: 'job-detail', status: 'placeholder' });
});

router.get('/tracking', (_req, res) => {
  res.json({ module: 'pet-transport', page: 'tracking', status: 'placeholder' });
});

router.get('/history', (_req, res) => {
  res.json({ module: 'pet-transport', page: 'history', status: 'placeholder' });
});

export default router;
