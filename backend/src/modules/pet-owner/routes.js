import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { cancelBooking, createBooking, listBookings } from './bookingStore.js';
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

/* ---------- Bookings ---------- */

// Keep in sync with BOOKING_SERVICES / OPENING_HOURS in frontend/src/features/pet-owner/bookingOptions.js
const BOOKING_SERVICES = {
  checkup: 'ตรวจสุขภาพทั่วไป',
  vaccine: 'ฉีดวัคซีน',
  parasite: 'ถ่ายพยาธิ / เห็บหมัด',
  followup: 'ติดตามอาการ',
  other: 'อื่นๆ',
};

/**
 * Clinic opening hours, taken from the home page (frontend/src/shared/pages/home/InfoSections.jsx):
 * Mon–Fri 08:00–22:00, Sat–Sun 09:00–21:00. Slots are 30 minutes and the last one starts
 * 30 minutes before closing. Emergency care (24h) is not booked online. Public holidays are not handled.
 */
const WEEKDAY_HOURS = { open: '08:00', close: '22:00' };
const WEEKEND_HOURS = { open: '09:00', close: '21:00' };

const toMinutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

function bookableSlots(dateString) {
  const [y, m, d] = dateString.split('-').map(Number);
  const day = new Date(y, m - 1, d).getDay(); // 0 = Sunday, 6 = Saturday
  const { open, close } = day === 0 || day === 6 ? WEEKEND_HOURS : WEEKDAY_HOURS;
  const slots = [];
  for (let t = toMinutes(open); t + 30 <= toMinutes(close); t += 30) {
    slots.push(`${String(Math.floor(t / 60)).padStart(2, '0')}:${t % 60 === 0 ? '00' : '30'}`);
  }
  return slots;
}

function nowTimeString() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function todayString() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

router.use('/bookings', requireOwner);

router.get('/bookings', wrap(async (req, res) => {
  res.json(await listBookings(req.ownerId));
}));

router.post('/bookings', wrap(async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw httpError(400, 'ข้อมูลไม่ถูกต้อง');
  const { petId, service, date, time } = body;
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '';

  if (typeof petId !== 'string' || !petId) throw httpError(400, 'กรุณาเลือกสัตว์เลี้ยง');
  const pet = await findPet(req.ownerId, petId);
  if (!pet) throw httpError(404, 'ไม่พบข้อมูลสัตว์เลี้ยงนี้');
  if (!Object.hasOwn(BOOKING_SERVICES, service)) throw httpError(400, 'กรุณาเลือกบริการ');
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(date).getTime())) {
    throw httpError(400, 'กรุณาเลือกวันที่');
  }
  if (date < todayString()) throw httpError(400, 'ไม่สามารถจองวันที่ผ่านมาแล้ว');
  if (typeof time !== 'string' || !time) throw httpError(400, 'กรุณาเลือกเวลา');
  if (!bookableSlots(date).includes(time)) throw httpError(400, 'เวลานี้อยู่นอกเวลาทำการของคลินิก');
  if (date === todayString() && time <= nowTimeString()) throw httpError(400, 'เวลานี้ผ่านไปแล้ว');

  const booking = await createBooking(req.ownerId, {
    petId,
    petName: pet.name,
    petSpecies: pet.species,
    service,
    serviceLabel: BOOKING_SERVICES[service],
    date,
    time,
    note,
  });
  res.status(201).json(booking);
}));

router.post('/bookings/:id/cancel', wrap(async (req, res) => {
  res.json(await cancelBooking(req.ownerId, req.params.id));
}));

/* Errors from this module's routes (e.g. 404 from the store) become JSON responses. */
router.use((err, _req, res, _next) => {
  const status = err.status ?? 500;
  if (status >= 500) console.error('[pet-owner]', err);
  res.status(status).json({ error: status >= 500 ? 'เกิดข้อผิดพลาดของเซิร์ฟเวอร์' : err.message });
});

export default router;
