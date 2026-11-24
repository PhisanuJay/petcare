import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { cancelBooking, createBooking, listBookings } from './bookingStore.js';
import { isServiceOnline } from '../clinic-admin/clinicSettings.js';
import { BOOKING_SERVICES, isDateString, todayString, validateSlot } from './clinicSchedule.js';
import { cancelReservation, createReservation, listReservations } from './hotelStore.js';
import { findAdoptionAnimal, listAdoptionAnimals } from './adoptionAnimals.js';
import { cancelAdoptionRequest, createAdoptionRequest, listAdoptionRequests } from './adoptionStore.js';
import { cancelTransportRequest, createTransportRequest, listTransportRequests } from './transportStore.js';
import { createPet, deletePet, findPet, listPets, updatePet } from './store.js';
import { saveOwnerProfile } from './ownerStore.js';

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

// Records written by the clinic carry `source: 'vet'`. Owners cannot create, change or remove them,
// so any `source` sent by an owner is dropped here (and the store keeps the clinic's own records).
const withIds = (rows) =>
  rows
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const { source: _source, ...rest } = row;
      return { ...rest, id: row.id || randomUUID() };
    })
    .filter(Boolean);

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

/* ---------- Bookings ---------- */

// Services and opening hours live in clinicSchedule.js (shared with the clinic-side modules).

/** Optional short text from the request body. */
const optionalText = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/* ---------- Owner contact details ---------- */

// The clinic reaches the owner through these (shown on the veterinarian's Customers page).
// PUT /profile  { name, phone?, email?, address?, emergencyName?, emergencyPhone? }
router.put('/profile', requireOwner, wrap(async (req, res) => {
  const body = req.body ?? {};
  const profile = {
    name: optionalText(body.name, 100),
    phone: optionalText(body.phone, 30),
    email: optionalText(body.email, 100),
    address: optionalText(body.address, 300),
    emergencyName: optionalText(body.emergencyName, 100),
    emergencyPhone: optionalText(body.emergencyPhone, 30),
  };
  if (!profile.name) throw httpError(400, 'กรุณากรอกชื่อเจ้าของ');
  await saveOwnerProfile(req.ownerId, profile);
  res.json({ ok: true });
}));

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
  if (!isServiceOnline(service)) throw httpError(400, 'บริการนี้ปิดรับจองออนไลน์ชั่วคราว');
  validateSlot(date, time);

  // Users live in the browser (localStorage), so the clinic only learns the owner's name and phone
  // from the booking itself. The Medical Assistant uses them to call the owner. Both are optional.
  const booking = await createBooking(req.ownerId, {
    petId,
    petName: pet.name,
    petSpecies: pet.species,
    ownerName: optionalText(body.ownerName, 100),
    ownerPhone: optionalText(body.ownerPhone, 30),
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

/* ---------- Cat hotel ---------- */

// Keep in sync with HOTEL_ROOMS in frontend/src/features/pet-owner/hotelOptions.js
// (room names and prices are copied from the home page: shared/data/homeContent.js).
const HOTEL_ROOMS = {
  standard: { label: 'Standard', pricePerNight: 450 },
  deluxe: { label: 'Deluxe', pricePerNight: 750 },
  suite: { label: 'Suite', pricePerNight: 1200 },
};
const HOTEL_SPECIES = 'cat';
const MAX_HOTEL_NIGHTS = 30;

const nightsBetween = (from, to) => Math.round((new Date(to) - new Date(from)) / 86400000);

router.use('/cat-hotel/reservations', requireOwner);

router.get('/cat-hotel/reservations', wrap(async (req, res) => {
  res.json(await listReservations(req.ownerId));
}));

router.post('/cat-hotel/reservations', wrap(async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw httpError(400, 'ข้อมูลไม่ถูกต้อง');
  const { petId, roomType, checkIn, checkOut } = body;
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '';

  if (typeof petId !== 'string' || !petId) throw httpError(400, 'กรุณาเลือกสัตว์เลี้ยง');
  const pet = await findPet(req.ownerId, petId);
  if (!pet) throw httpError(404, 'ไม่พบข้อมูลสัตว์เลี้ยงนี้');
  if (pet.species !== HOTEL_SPECIES) throw httpError(400, 'โรงแรมนี้รับเฉพาะน้องแมว');
  if (!Object.hasOwn(HOTEL_ROOMS, roomType)) throw httpError(400, 'กรุณาเลือกประเภทห้อง');
  if (!isDateString(checkIn)) throw httpError(400, 'กรุณาเลือกวันเช็คอิน');
  if (!isDateString(checkOut)) throw httpError(400, 'กรุณาเลือกวันเช็คเอาท์');
  if (checkIn < todayString()) throw httpError(400, 'วันเช็คอินต้องไม่ใช่วันที่ผ่านมาแล้ว');
  const nights = nightsBetween(checkIn, checkOut);
  if (nights < 1) throw httpError(400, 'วันเช็คเอาท์ต้องหลังวันเช็คอินอย่างน้อย 1 วัน');
  if (nights > MAX_HOTEL_NIGHTS) throw httpError(400, `ฝากได้ไม่เกิน ${MAX_HOTEL_NIGHTS} คืนต่อครั้ง`);

  const room = HOTEL_ROOMS[roomType];
  const reservation = await createReservation(req.ownerId, {
    petId,
    petName: pet.name,
    petSpecies: pet.species,
    roomType,
    roomLabel: room.label,
    pricePerNight: room.pricePerNight,
    checkIn,
    checkOut,
    nights,
    totalPrice: room.pricePerNight * nights,
    note,
  });
  res.status(201).json(reservation);
}));

router.post('/cat-hotel/reservations/:id/cancel', wrap(async (req, res) => {
  res.json(await cancelReservation(req.ownerId, req.params.id));
}));

/* ---------- Pet transport ---------- */

// Keep in sync with TRANSPORT_DIRECTIONS in frontend/src/features/pet-owner/transportOptions.js
const TRANSPORT_DIRECTIONS = {
  to_clinic: 'รับจากบ้านไปคลินิก',
  to_home: 'ส่งจากคลินิกกลับบ้าน',
  round_trip: 'รับ-ส่ง ไป-กลับ',
};

router.use('/transport/requests', requireOwner);

router.get('/transport/requests', wrap(async (req, res) => {
  res.json(await listTransportRequests(req.ownerId));
}));

router.post('/transport/requests', wrap(async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw httpError(400, 'ข้อมูลไม่ถูกต้อง');
  const { petId, direction, date, time } = body;
  const address = typeof body.address === 'string' ? body.address.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.replace(/[-\s]/g, '') : '';
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '';

  if (typeof petId !== 'string' || !petId) throw httpError(400, 'กรุณาเลือกสัตว์เลี้ยง');
  const pet = await findPet(req.ownerId, petId);
  if (!pet) throw httpError(404, 'ไม่พบข้อมูลสัตว์เลี้ยงนี้');
  if (!Object.hasOwn(TRANSPORT_DIRECTIONS, direction)) throw httpError(400, 'กรุณาเลือกรูปแบบการรับ-ส่ง');
  validateSlot(date, time);
  if (address.length < 10) throw httpError(400, 'กรุณากรอกที่อยู่ให้ละเอียด');
  if (address.length > 300) throw httpError(400, 'ที่อยู่ยาวเกินไป');
  if (!/^0\d{8,9}$/.test(phone)) throw httpError(400, 'เบอร์โทร 9-10 หลัก ขึ้นต้นด้วย 0');

  const request = await createTransportRequest(req.ownerId, {
    petId,
    petName: pet.name,
    petSpecies: pet.species,
    direction,
    directionLabel: TRANSPORT_DIRECTIONS[direction],
    date,
    time,
    address,
    phone,
    note,
  });
  res.status(201).json(request);
}));

router.post('/transport/requests/:id/cancel', wrap(async (req, res) => {
  res.json(await cancelTransportRequest(req.ownerId, req.params.id));
}));

/* ---------- Adoption ---------- */

// Keep in sync with HOUSING_OPTIONS / EXPERIENCE_OPTIONS in frontend/src/features/pet-owner/adoptionOptions.js
const HOUSING = ['house', 'townhome', 'condo', 'apartment', 'other'];
const EXPERIENCE = ['none', 'some', 'experienced'];

router.get('/adoption/animals', wrap(async (_req, res) => {
  res.json(await listAdoptionAnimals());
}));

router.use('/adoption/requests', requireOwner);

router.get('/adoption/requests', wrap(async (req, res) => {
  res.json(await listAdoptionRequests(req.ownerId));
}));

router.post('/adoption/requests', wrap(async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw httpError(400, 'ข้อมูลไม่ถูกต้อง');
  const text = (v) => (typeof v === 'string' ? v.trim() : '');
  const fullName = text(body.fullName);
  const phone = text(body.phone).replace(/[-\s]/g, '');
  const address = text(body.address);
  const reason = text(body.reason);

  const animal = typeof body.animalId === 'string' ? await findAdoptionAnimal(body.animalId) : null;
  if (!animal) throw httpError(404, 'ไม่พบน้องที่ต้องการขอรับเลี้ยง');
  if (fullName.length < 2 || fullName.length > 100) throw httpError(400, 'กรุณากรอกชื่อ-นามสกุล');
  if (!/^0\d{8,9}$/.test(phone)) throw httpError(400, 'เบอร์โทร 9-10 หลัก ขึ้นต้นด้วย 0');
  if (address.length < 10 || address.length > 300) throw httpError(400, 'กรุณากรอกที่อยู่ให้ละเอียด');
  if (!HOUSING.includes(body.housing)) throw httpError(400, 'กรุณาเลือกประเภทที่พักอาศัย');
  if (typeof body.hasOtherPets !== 'boolean') throw httpError(400, 'กรุณาระบุว่ามีสัตว์เลี้ยงอื่นหรือไม่');
  if (!EXPERIENCE.includes(body.experience)) throw httpError(400, 'กรุณาเลือกประสบการณ์การเลี้ยงสัตว์');
  if (reason.length < 10) throw httpError(400, 'กรุณาเล่าเหตุผลที่อยากรับเลี้ยงอย่างน้อย 10 ตัวอักษร');
  if (reason.length > 1000) throw httpError(400, 'เหตุผลยาวเกินไป');

  const request = await createAdoptionRequest(req.ownerId, {
    animalId: animal.id,
    animalName: animal.name,
    fullName,
    phone,
    address,
    housing: body.housing,
    hasOtherPets: body.hasOtherPets,
    experience: body.experience,
    reason,
  });
  res.status(201).json(request);
}));

router.post('/adoption/requests/:id/cancel', wrap(async (req, res) => {
  res.json(await cancelAdoptionRequest(req.ownerId, req.params.id));
}));

/* ---------- CCTV ---------- */

/**
 * Which of the owner's cat hotel stays can be watched. Only the owner's own stays are returned.
 *   live     – confirmed and today is within check-in … check-out
 *   upcoming – confirmed, check-in is still ahead
 *   pending  – the hotel has not confirmed the stay yet
 * `streamUrl` is null until the hotel team connects a camera to the stay (field not defined yet).
 */
function cctvAccess(reservation, today) {
  if (reservation.status === 'pending') return 'pending';
  if (reservation.status !== 'confirmed') return null;
  if (today < reservation.checkIn) return 'upcoming';
  if (today <= reservation.checkOut) return 'live';
  return null;
}

router.use('/cctv', requireOwner);

router.get('/cctv', wrap(async (req, res) => {
  const today = todayString();
  const stays = [];
  for (const r of await listReservations(req.ownerId)) {
    const access = cctvAccess(r, today);
    if (!access) continue;
    stays.push({
      id: r.id,
      petName: r.petName,
      roomLabel: r.roomLabel,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      status: r.status,
      access,
      streamUrl: access === 'live' ? (r.streamUrl ?? null) : null,
    });
  }
  res.json(stays);
}));

/* Errors from this module's routes (e.g. 404 from the store) become JSON responses. */
router.use((err, _req, res, _next) => {
  const status = err.status ?? 500;
  if (status >= 500) console.error('[pet-owner]', err);
  res.status(status).json({ error: status >= 500 ? 'เกิดข้อผิดพลาดของเซิร์ฟเวอร์' : err.message });
});

export default router;
