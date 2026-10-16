import { Router } from 'express';

/**
 * Adoption API module
 * Owner: ปร่ย
 * Placeholder routes — implement later.
 */
const router = Router();

router.get('/', (_req, res) => {
  res.json({ module: 'adoption', owner: 'ปร่ย', status: 'placeholder' });
});

router.get('/animals', (_req, res) => {
  res.json({ module: 'adoption', page: 'animals', status: 'placeholder' });
});

router.get('/add-animal', (_req, res) => {
  res.json({ module: 'adoption', page: 'add-animal', status: 'placeholder' });
});

router.get('/requests', (_req, res) => {
  res.json({ module: 'adoption', page: 'requests', status: 'placeholder' });
});

export default router;
