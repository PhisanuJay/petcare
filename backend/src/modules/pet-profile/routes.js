import { Router } from 'express';

/**
 * Pet Profile API module
 * Owner: เอิร์ท, ปร่ย
 * Placeholder routes — implement later.
 */
const router = Router();

router.get('/', (_req, res) => {
  res.json({ module: 'pet-profile', owner: 'เอิร์ท, ปร่ย', status: 'placeholder' });
});

export default router;
