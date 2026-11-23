import { Router } from 'express';
import { readJSON, updateById, writeJSON } from '../utils/db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, (req, res) => {
  let notifications = readJSON('notifications.json');
  notifications = notifications.filter((n) => n.userId === req.user.id);
  notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(notifications);
});

router.patch('/:id/read', authenticate, (req, res) => {
  const updated = updateById('notifications.json', req.params.id, { isRead: true });
  if (!updated) return res.status(404).json({ error: 'ไม่พบการแจ้งเตือน' });
  res.json(updated);
});

router.patch('/read-all', authenticate, (req, res) => {
  const notifications = readJSON('notifications.json');
  const updated = notifications.map((n) => {
    if (n.userId === req.user.id) return { ...n, isRead: true };
    return n;
  });
  writeJSON('notifications.json', updated);
  res.json({ message: 'อ่านทั้งหมดแล้ว' });
});

router.get('/templates', authenticate, (req, res) => {
  const raw = readJSON('notificationTemplates.json');
  const templates = Array.isArray(raw) ? {} : raw;
  res.json(templates);
});

router.put('/templates', authenticate, (req, res) => {
  writeJSON('notificationTemplates.json', req.body);
  res.json(req.body);
});

export default router;
