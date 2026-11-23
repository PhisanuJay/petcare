import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { readJSON, updateById, findById, addItem } from '../utils/db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logActivity, generateId } from '../utils/helpers.js';

const router = Router();

router.get('/', authenticate, authorize('admin'), (req, res) => {
  const users = readJSON('users.json').map(({ password, ...u }) => u);
  res.json(users);
});

router.post('/', authenticate, authorize('admin'), async (req, res) => {
  const { name, email, password, phone, role } = req.body;
  if (!name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: 'กรุณากรอกชื่อ อีเมล และรหัสผ่าน' });
  }
  if (!['customer', 'staff', 'admin'].includes(role || 'customer')) {
    return res.status(400).json({ error: 'สิทธิ์ไม่ถูกต้อง' });
  }
  const users = readJSON('users.json');
  if (users.find((u) => u.email === email.trim())) {
    return res.status(400).json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' });
  }
  const hashed = await bcrypt.hash(password, 10);
  const user = {
    id: generateId(),
    name: name.trim(),
    email: email.trim(),
    password: hashed,
    phone: (phone || '').trim(),
    role: role || 'customer',
    avatar: null,
    createdAt: new Date().toISOString(),
  };
  addItem('users.json', user);
  logActivity('create_user', `สร้างผู้ใช้ ${user.email} (${user.role})`, req.user.id);
  const { password: _, ...safeUser } = user;
  res.status(201).json(safeUser);
});

router.get('/:id', authenticate, (req, res) => {
  const user = findById('users.json', req.params.id);
  if (!user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
  if (req.user.id !== user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'ไม่มีสิทธิ์' });
  }
  const { password, ...safeUser } = user;
  res.json(safeUser);
});

router.put('/:id', authenticate, async (req, res) => {
  const user = findById('users.json', req.params.id);
  if (!user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
  if (req.user.id !== user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'ไม่มีสิทธิ์' });
  }
  const { name, phone, email, currentPassword, newPassword, role, address } = req.body;
  const updates = {};
  if (name) updates.name = name;
  if (phone !== undefined) updates.phone = phone;
  if (email) updates.email = email;
  if (address !== undefined) updates.address = address;
  if (role && req.user.role === 'admin') updates.role = role;
  if (newPassword) {
    if (!currentPassword || !(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(400).json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
    }
    updates.password = await bcrypt.hash(newPassword, 10);
  }
  const updated = updateById('users.json', req.params.id, updates);
  const { password, ...safeUser } = updated;
  logActivity('update_profile', `อัปเดตโปรไฟล์ ${updated.email}`, req.user.id);
  res.json(safeUser);
});

router.post('/:id/avatar', authenticate, (req, res) => {
  const { avatar } = req.body;
  const user = findById('users.json', req.params.id);
  if (!user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
  if (req.user.id !== user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'ไม่มีสิทธิ์' });
  }
  const updated = updateById('users.json', req.params.id, { avatar });
  const { password, ...safeUser } = updated;
  res.json(safeUser);
});

export default router;
