import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import {
  createBooking,
  deleteBooking,
  listBookings,
  requestBookingCancellation,
  resolveBookingCancellation,
} from './bookingStore.js';
import { confirmOnlineBooking } from './confirmOnlineBooking.js';
import { availableOnlineSlots } from './onlineSlots.js';
import { isServiceOnline } from '../clinic-admin/clinicSettings.js';
import { vetsOnDuty } from '../clinic-admin/rosterStore.js';
import { BOOKING_SERVICES, isDateString, todayString, validateSlot } from './clinicSchedule.js';
import {
  bookingServiceLabel,
  normalizeBookingServiceCode,
} from './bookingServiceLabels.js';
import { getHotelRoomCatalog } from '../pet-transport/service.js';
import {
  createHotelStay,
  getHotelAvailability,
  getStayForOwner,
  listStaysForOwner,
} from './hotelStayStore.js';
import { resolveReservationCancellation } from './hotelStore.js';
import { createPet, deletePet, findPet, listPets, updatePet } from './store.js';
import { saveOwnerProfile } from './ownerStore.js';
import { getCustomerSession } from '../auth/store.js';
import { listGrantedCamerasForOwner } from '../super-admin/cctvAdmin.js';

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

/** Owner from Bearer session (preferred) or legacy x-owner-id during transition. */
async function requireOwner(req, _res, next) {
  try {
    const session = await getCustomerSession(req);
    if (session?.user?.id) {
      req.ownerId = session.user.id;
      return next();
    }
    const headerId = req.get('x-owner-id')?.trim();
    if (headerId) {
      req.ownerId = headerId;
      return next();
    }
    return next(httpError(401, 'กรุณาเข้าสู่ระบบ'));
  } catch (error) {
    next(error);
  }
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

  let petIds = [];
  if (Array.isArray(body.petIds) && body.petIds.length) {
    petIds = [...new Set(body.petIds.map((id) => String(id).trim()).filter(Boolean))];
  } else if (typeof petId === 'string' && petId.trim()) {
    petIds = [petId.trim()];
  }
  if (!petIds.length) throw httpError(400, 'กรุณาเลือกสัตว์เลี้ยง');

  const petsOnBooking = [];
  for (const id of petIds) {
    const found = await findPet(req.ownerId, id);
    if (!found) throw httpError(404, 'ไม่พบข้อมูลสัตว์เลี้ยงบางตัวในรายการ');
    petsOnBooking.push(found);
  }
  const pet = petsOnBooking[0];
  const petsById = new Map(petsOnBooking.map((p) => [p.id, p]));

  let petLines;
  if (Array.isArray(body.petLines) && body.petLines.length) {
    petLines = [];
    for (const row of body.petLines) {
      const pid = String(row?.petId || '').trim();
      const rowPet = petsById.get(pid);
      if (!rowPet) throw httpError(400, 'รายการสัตว์ไม่ตรงกับที่เลือก');
      const lineService = normalizeBookingServiceCode(row.service);
      if (!Object.hasOwn(BOOKING_SERVICES, lineService)) throw httpError(400, 'กรุณาเลือกบริการ');
      if (!isServiceOnline(lineService)) throw httpError(400, 'บริการนี้ปิดรับจองออนไลน์ชั่วคราว');
      petLines.push({
        petId: rowPet.id,
        petName: rowPet.name,
        petSpecies: rowPet.species,
        service: lineService,
        serviceLabel: bookingServiceLabel(lineService, rowPet.species),
      });
    }
    for (const rowPet of petsOnBooking) {
      if (!petLines.some((line) => line.petId === rowPet.id)) {
        throw httpError(400, 'กรุณาระบุบริการอย่างน้อย 1 รายการต่อสัตว์ที่เลือก');
      }
    }
  } else {
    const serviceCode = normalizeBookingServiceCode(service);
    if (!Object.hasOwn(BOOKING_SERVICES, serviceCode)) throw httpError(400, 'กรุณาเลือกบริการ');
    if (!isServiceOnline(serviceCode)) throw httpError(400, 'บริการนี้ปิดรับจองออนไลน์ชั่วคราว');
    petLines = petsOnBooking.map((p) => ({
      petId: p.id,
      petName: p.name,
      petSpecies: p.species,
      service: serviceCode,
      serviceLabel: bookingServiceLabel(serviceCode, p.species),
    }));
  }

  const serviceCode = petLines.length === 1 ? petLines[0].service : 'multi';
  const serviceLabel = petLines.length === 1
    ? petLines[0].serviceLabel
    : petLines.map((l) => `${l.petName}: ${l.serviceLabel}`).join(' · ');

  validateSlot(date, time);

  const vetId = typeof body.vetId === 'string' ? body.vetId.trim() : '';
  const slotCheck = await availableOnlineSlots(date, vetId);
  if (!slotCheck.slots.includes(time)) {
    throw httpError(409, slotCheck.reason || 'ช่วงเวลานี้ไม่ว่างแล้ว กรุณาเลือกใหม่');
  }
  let vetName = '';
  if (vetId) {
    const onDuty = vetsOnDuty(date);
    const match = onDuty.find((v) => v.id === vetId);
    if (!match) throw httpError(400, 'สัตวแพทย์ที่เลือกไม่ได้เข้าเวรวันนี้');
    vetName = match.name ?? '';
  }

  // Users live in the browser (localStorage), so the clinic only learns the owner's name and phone
  // from the booking itself. The Medical Assistant uses them to call the owner. Both are optional.
  const pending = await createBooking(req.ownerId, {
    petId: pet.id,
    petIds: petsOnBooking.map((p) => p.id),
    petName: petsOnBooking.map((p) => p.name).join(', '),
    petSpecies:
      petsOnBooking.length === 1
        ? pet.species
        : (petsOnBooking.every((p) => p.species === pet.species) ? pet.species : 'mixed'),
    ownerName: optionalText(body.ownerName, 100),
    ownerPhone: optionalText(body.ownerPhone, 30),
    service: serviceCode,
    serviceLabel,
    petLines,
    date,
    time,
    note,
    vetId: vetId || undefined,
    vetName: vetName || undefined,
  });
  try {
    const booking = await confirmOnlineBooking(pending);
    res.status(201).json(booking);
  } catch (err) {
    try {
      await deleteBooking(pending.id);
    } catch {
      // best-effort rollback
    }
    throw err;
  }
}));

router.post('/bookings/:id/request-cancel', wrap(async (req, res) => {
  res.json(await requestBookingCancellation(
    req.ownerId,
    req.params.id,
    req.body?.cancellationId,
    req.body?.reason,
  ));
}));

router.post('/admin/bookings/:id/resolve-cancel', wrap(async (req, res) => {
  res.json(await resolveBookingCancellation(
    req.params.id,
    req.body?.cancellationId,
    Boolean(req.body?.approve),
    req.body?.adminNote || '',
  ));
}));

/* ---------- Cat hotel ---------- */

const hotelReservationsMoved = () => ({
  error: 'ระบบจองโรงแรมแบบเก่ายกเลิกแล้ว ใช้การฝากผ่าน /api/pet-owner/cat-hotel/stays',
  redirect: '/pet-owner/cat-hotel/book',
});

router.get('/cat-hotel/reservations', requireOwner, (_req, res) => {
  res.status(410).json(hotelReservationsMoved());
});

router.post('/cat-hotel/reservations', requireOwner, (_req, res) => {
  res.status(410).json(hotelReservationsMoved());
});

router.post('/cat-hotel/reservations/:id/request-cancel', requireOwner, (_req, res) => {
  res.status(410).json(hotelReservationsMoved());
});

router.post('/admin/cat-hotel/reservations/:id/resolve-cancel', wrap(async (req, res) => {
  res.json(await resolveReservationCancellation(
    req.params.id,
    req.body?.cancellationId,
    Boolean(req.body?.approve),
    req.body?.adminNote || '',
  ));
}));

/* ---------- Cat hotel stays (multi-room, SQL) ---------- */

router.get('/cat-hotel/catalog', wrap(async (_req, res) => {
  const items = await getHotelRoomCatalog();
  res.json({ items });
}));

router.get('/cat-hotel/availability', wrap(async (req, res) => {
  const { checkIn, checkOut } = req.query || {};
  if (!isDateString(checkIn) || !isDateString(checkOut)) {
    throw httpError(400, 'กรุณาระบุวันเข้าพักและวันรับกลับ');
  }
  res.json({
    checkIn,
    checkOut,
    items: await getHotelAvailability(checkIn, checkOut),
  });
}));

router.use('/cat-hotel/stays', requireOwner);

router.get('/cat-hotel/stays', wrap(async (req, res) => {
  res.json({ items: await listStaysForOwner(req.ownerId) });
}));

router.get('/cat-hotel/stays/:id', wrap(async (req, res) => {
  res.json(await getStayForOwner(req.ownerId, req.params.id));
}));

router.post('/cat-hotel/stays', wrap(async (req, res) => {
  const pets = await listPets(req.ownerId);
  const petsById = new Map(pets.map((pet) => [pet.id, pet]));
  const stay = await createHotelStay(
    req.ownerId,
    req.headers['x-owner-email'] || '',
    req.body,
    petsById,
  );
  res.status(201).json(stay);
}));

/* ---------- Pet transport ---------- */

// Keep in sync with TRANSPORT_DIRECTIONS in frontend/src/features/pet-owner/transportOptions.js
const TRANSPORT_DIRECTIONS = {
  to_clinic: 'รับจากบ้านไปคลินิก',
  to_home: 'ส่งจากคลินิกกลับบ้าน',
  round_trip: 'รับ-ส่ง ไป-กลับ',
};

router.use('/transport/requests', requireOwner);

const transportMoved = { error: 'ใช้ระบบรับส่งใหม่ที่ /api/pet-transport แทน' };

router.get('/transport/requests', (_req, res) => {
  res.status(410).json(transportMoved);
});

router.post('/transport/requests', (_req, res) => {
  res.status(410).json(transportMoved);
});

router.post('/transport/requests/:id/cancel', (_req, res) => {
  res.status(410).json(transportMoved);
});

/* ---------- Adoption ---------- */

// Keep in sync with HOUSING_OPTIONS / EXPERIENCE_OPTIONS in frontend/src/features/pet-owner/adoptionOptions.js
const HOUSING = ['house', 'townhome', 'condo', 'apartment', 'other'];
const EXPERIENCE = ['none', 'some', 'experienced'];

router.get('/adoption/animals', (_req, res) => {
  res.status(410).json({
    error: 'ใช้ GET /api/adoption/animals แทน — ระบบหาบ้านรวมอยู่ที่โมดูล adoption แล้ว',
  });
});

const adoptionMoved = () => ({
  error: 'ระบบหาบ้านย้ายไปที่ /api/adoption แล้ว — ใช้ Adoption Hub แทน',
});

router.use('/adoption/requests', requireOwner);

router.get('/adoption/requests', (_req, res) => {
  res.status(410).json(adoptionMoved());
});

router.post('/adoption/requests', (_req, res) => {
  res.status(410).json(adoptionMoved());
});

router.post('/adoption/requests/:id/cancel', (_req, res) => {
  res.status(410).json(adoptionMoved());
});

/* ---------- CCTV ---------- */

/**
 * Which of the owner's cat hotel stays can be watched. Only the owner's own stays are returned.
 *   live     – confirmed and today is within check-in … check-out
 *   upcoming – confirmed, check-in is still ahead
 *   pending  – the hotel has not confirmed the stay yet
 * `streamUrl` is null until the hotel team connects a camera to the stay (field not defined yet).
 */
function cctvAccessForStay(stay, today) {
  if (['waiting', 'pending'].includes(stay.status)) return 'pending';
  const active = ['waiting', 'checked_in', 'confirmed', 'pending'].includes(stay.status);
  if (!active) return null;
  if (today < stay.checkIn) return 'upcoming';
  if (today <= stay.checkOut) return 'live';
  return null;
}

router.use('/cctv', requireOwner);

router.get('/cctv/cameras', wrap(async (req, res) => {
  const email = String(req.get('x-owner-email') || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw httpError(400, 'ข้อมูลบัญชีลูกค้าไม่ถูกต้อง');
  }
  res.json({ items: await listGrantedCamerasForOwner(req.ownerId, email) });
}));

router.get('/cctv', wrap(async (req, res) => {
  const today = todayString();
  const catalog = await getHotelRoomCatalog();
  const catalogById = new Map(catalog.map((item) => [item.id, item]));
  const stays = [];
  for (const stay of await listStaysForOwner(req.ownerId)) {
    const access = cctvAccessForStay(stay, today);
    if (!access) continue;
    const line = stay.lines?.[0];
    const room = line ? catalogById.get(line.roomTypeId) : null;
    let petName = 'สัตว์เลี้ยง';
    const firstPetId = line?.petIds?.[0];
    if (firstPetId) {
      const pet = await findPet(req.ownerId, firstPetId);
      if (pet?.name) petName = pet.name;
    }
    stays.push({
      id: stay.id,
      petName,
      roomLabel: room?.titleTh || line?.roomTypeId || 'ห้องพัก',
      checkIn: stay.checkIn,
      checkOut: stay.checkOut,
      status: stay.status,
      access,
      streamUrl: null,
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
