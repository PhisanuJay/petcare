import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { readJSON, writeJSON, addItem, findById } from '../utils/db.js';
import { generateId, logActivity } from '../utils/helpers.js';
import { JWT_SECRET } from '../middleware/auth.js';

const router = Router();

router.post('/register', async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' });
  }
  const users = readJSON('users.json');
  if (users.find((u) => u.email === email)) {
    return res.status(400).json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' });
  }
  const hashed = await bcrypt.hash(password, 10);
  const user = {
    id: generateId(),
    name,
    email,
    password: hashed,
    phone: phone || '',
    role: 'customer',
    avatar: null,
    createdAt: new Date().toISOString(),
  };
  addItem('users.json', user);
  logActivity('register', `ผู้ใช้ ${email} สมัครสมาชิก`, user.id);
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  const { password: _, ...safeUser } = user;
  res.status(201).json({ user: safeUser, token });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = readJSON('users.json').find((u) => u.email === email);
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
  }
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  const { password: _, ...safeUser } = user;
  res.json({ user: safeUser, token });
});

router.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  const user = readJSON('users.json').find((u) => u.email === email);
  if (!user) {
    return res.status(404).json({ error: 'ไม่พบอีเมลนี้ในระบบ' });
  }
  res.json({ message: 'ลิงก์รีเซ็ตรหัสผ่านถูกส่งไปยังอีเมลของคุณแล้ว (จำลอง)' });
});

export default router;
