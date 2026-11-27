const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const { asyncHandler, HttpError } = require('../errors');
const { findUserByEmail, findAdminUser, updateProfile } = require('../store');
const { publicUser } = require('../serialize');
const { query } = require('../db');

const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 8);

function setCookie(res, config, user) {
  const token = jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: '12h' });
  res.cookie('cathotel', token, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    maxAge: 12 * 60 * 60 * 1000,
    path: '/',
  });
}

function authRoutes(config, requireAuth) {
  const router = express.Router();
  const loginLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'พยายามเข้าสู่ระบบบ่อยเกินไป รอสักครู่แล้วลองใหม่' } },
  });
  const ownerLinkLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'ตรวจสิทธิ์บ่อยเกินไป รอสักครู่แล้วลองใหม่' } },
  });

  router.get('/brand', (req, res) => {
    res.json({ hotelName: config.hotelName });
  });

  router.post('/login', loginLimit, asyncHandler(async (req, res) => {
    // รองรับทั้ง username แบบง่าย และอีเมลลูกค้า
    const body = z.object({
      username: z.string().trim().min(1, 'ต้องใส่ชื่อผู้ใช้').max(255).optional(),
      email: z.string().trim().min(1).max(255).optional(),
      password: z.string().min(1, 'ต้องใส่รหัสผ่าน').max(200),
    }).parse(req.body);

    const loginName = String(body.username || body.email || '').trim();
    if (!loginName) {
      res.status(400).json({ error: { code: 'BAD_INPUT', message: 'ต้องใส่ชื่อผู้ใช้' } });
      return;
    }

    let user = null;
    if (loginName.toLowerCase() === 'admin') {
      user = await findAdminUser();
    } else {
      user = await findUserByEmail(loginName.toLowerCase());
    }

    const hash = user ? user.password_hash : DUMMY_HASH;
    let match = false;
    try {
      match = await bcrypt.compare(body.password, hash);
    } catch {
      match = false;
    }
    if (!user || !match || !user.is_active) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' } });
      return;
    }
    setCookie(res, config, user);
    res.json({ user: publicUser(user) });
  }));

  // ลูกค้า PetCare ไม่ใส่รหัสกล้อง ผูกด้วยอีเมลบัญชีที่มีอยู่แล้ว และออกเฉพาะสิทธิ์ลูกค้า
  router.post('/owner-link', ownerLinkLimit, asyncHandler(async (req, res) => {
    const body = z.object({
      email: z.string().trim().email().max(255),
    }).parse(req.body);
    const user = await findUserByEmail(body.email.toLowerCase());
    if (!user || user.role !== 'customer' || !user.is_active) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'ยังไม่ได้รับสิทธิ์ดูกล้อง' } });
      return;
    }
    const token = jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: '12h' });
    res.cookie('cathotel_owner', token, {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: 'lax',
      maxAge: 12 * 60 * 60 * 1000,
      path: '/',
    });
    res.json({ user: publicUser(user) });
  }));

  router.get('/me', requireAuth, (req, res) => {
    res.json({ user: publicUser(req.user), hotelName: config.hotelName });
  });

  router.patch('/me', requireAuth, asyncHandler(async (req, res) => {
    const body = z.object({
      displayName: z.string().trim().min(1, 'ต้องใส่ชื่อ').max(120).optional(),
      password: z.string().min(4, 'รหัสผ่านต้องมีอย่างน้อย 4 ตัว').max(200).optional(),
      currentPassword: z.string().min(1).max(200).optional(),
    }).parse(req.body);

    if (!body.displayName && !body.password) {
      throw new HttpError(400, 'BAD_INPUT', 'ไม่มีข้อมูลที่จะบันทึก');
    }

    if (body.password) {
      if (!body.currentPassword) throw new HttpError(400, 'BAD_INPUT', 'ต้องใส่รหัสผ่านปัจจุบัน');
      const [rows] = await query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
      const hash = rows[0]?.password_hash;
      const match = hash ? await bcrypt.compare(body.currentPassword, hash) : false;
      if (!match) throw new HttpError(401, 'UNAUTHORIZED', 'รหัสผ่านปัจจุบันไม่ถูกต้อง');
    }

    const user = await updateProfile(req.user.id, {
      displayName: body.displayName,
      password: body.password,
    });
    res.json({ user: publicUser(user), hotelName: config.hotelName });
  }));

  router.post('/logout', (req, res) => {
    res.clearCookie('cathotel', { path: '/', secure: config.cookieSecure, sameSite: 'lax' });
    res.json({ ok: true });
  });

  return router;
}

module.exports = { authRoutes };
