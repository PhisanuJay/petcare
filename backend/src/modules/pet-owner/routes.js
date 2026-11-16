import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { createPet, deletePet, findPet, listPets, updatePet } from './store.js';

/**
 * Pet Owner API module
 * Owner: มะแอ่ว
 * Placeholder routes — implement later.
 */
const router = Router();

router.get('/', (_req, res) => {
  res.json({ module: 'pet-owner', owner: 'มะแอ่ว', status: 'placeholder' });
});

/* ---------- My Pets ---------- */

const TEXT_FIELDS = [
  'photo', 'name', 'species', 'breed', 'sex', 'birthDate', 'weight', 'color', 'microchip',
  'neutered', 'allergies', 'chronicDiseases', 'medications', 'food', 'notes',
];
const RECORD_FIELDS = ['vaccines', 'treatments', 'parasites'];

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/** Owner is identified by the x-owner-id header until real auth exists on the backend. */
function requireOwner(req, _res, next) {
  const ownerId = req.get('x-owner-id');
  if (!ownerId || !ownerId.trim()) return next(httpError(401, 'กรุณาเข้าสู่ระบบ'));
  req.ownerId = ownerId.trim();
  next();
}

const withIds = (rows) =>
  rows.map((row) => (row && typeof row === 'object' ? { ...row, id: row.id || randomUUID() } : null)).filter(Boolean);

/** Keep only known pet fields. With `partial`, fields that are absent are left out. */
function sanitizePet(body, { partial = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw httpError(400, 'ข้อมูลไม่ถูกต้อง');
  const data = {};
  for (const key of TEXT_FIELDS) {
    if (body[key] === undefined) continue;
    if (typeof body[key] !== 'string') throw httpError(400, `ข้อมูล ${key} ไม่ถูกต้อง`);
    data[key] = body[key];
  }
  for (const key of RECORD_FIELDS) {
    if (body[key] === undefined) continue;
    if (!Array.isArray(body[key])) throw httpError(400, `ข้อมูล ${key} ไม่ถูกต้อง`);
    data[key] = withIds(body[key]);
  }
  if (!partial || data.name !== undefined) {
    data.name = (data.name ?? '').trim();
    if (!data.name) throw httpError(400, 'กรุณากรอกชื่อสัตว์เลี้ยง');
  }
  return data;
}

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

router.use('/my-pets', requireOwner);

router.get('/my-pets', wrap(async (req, res) => {
  res.json(await listPets(req.ownerId));
}));

router.get('/my-pets/:id', wrap(async (req, res) => {
  const pet = await findPet(req.ownerId, req.params.id);
  if (!pet) throw httpError(404, 'ไม่พบข้อมูลสัตว์เลี้ยงนี้');
  res.json(pet);
}));

router.post('/my-pets', wrap(async (req, res) => {
  const data = sanitizePet(req.body);
  for (const key of RECORD_FIELDS) data[key] ??= [];
  res.status(201).json(await createPet(req.ownerId, data));
}));

router.put('/my-pets/:id', wrap(async (req, res) => {
  res.json(await updatePet(req.ownerId, req.params.id, sanitizePet(req.body, { partial: true })));
}));

router.delete('/my-pets/:id', wrap(async (req, res) => {
  res.json(await deletePet(req.ownerId, req.params.id));
}));

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

/* Errors from this module's routes (e.g. 404 from the store) become JSON responses. */
router.use((err, _req, res, _next) => {
  const status = err.status ?? 500;
  if (status >= 500) console.error('[pet-owner]', err);
  res.status(status).json({ error: status >= 500 ? 'เกิดข้อผิดพลาดของเซิร์ฟเวอร์' : err.message });
});

export default router;
