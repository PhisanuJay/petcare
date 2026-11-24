import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { BOOKING_STATUSES, listAllBookings, updateBookingStatus } from '../pet-owner/bookingStore.js';
import { getPetById, listAllPets, updatePetAsClinic } from '../pet-owner/store.js';
import { dueVaccines } from './dueVaccines.js';

/**
 * Veterinarian API module
 * Owner: มะแอ่ว
 *
 * Reads the owners' bookings and pets that the Pet Owner module stores
 * (backend/src/modules/pet-owner), so both modules always see the same data.
 */
const router = Router();

// Keep in sync with PARASITE_TYPES in frontend/src/features/pet-owner/petUtils.js
const PARASITE_LABELS = { deworm: 'ถ่ายพยาธิ', flea: 'ป้องกันเห็บหมัด', heartworm: 'ป้องกันพยาธิหนอนหัวใจ' };
const PARASITE_TYPES = Object.keys(PARASITE_LABELS);

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/**
 * PLACEHOLDER access check — NOT real security.
 * The project has no staff login yet, so the veterinarian pages send `x-staff-role: veterinarian`.
 * Anyone can send that header. Replace this with a real authentication check once staff accounts exist,
 * before these endpoints (which expose every owner's pets) are used outside development.
 */
function requireVet(req, _res, next) {
  if (req.get('x-staff-role') !== 'veterinarian') return next(httpError(401, 'กรุณาเข้าสู่ระบบสัตวแพทย์'));
  next();
}

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
const isDateString = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(v).getTime());

router.get('/', (_req, res) => {
  res.json({ module: 'veterinarian', owner: 'มะแอ่ว', status: 'placeholder' });
});

/* ---------- Appointments ---------- */

/** The pet details a vet needs to see next to an appointment. */
function petSummary(pet) {
  if (!pet) return null;
  const { id, name, species, breed, sex, birthDate, weight, neutered, allergies, chronicDiseases, medications } = pet;
  return { id, name, species, breed, sex, birthDate, weight, neutered, allergies, chronicDiseases, medications };
}

router.use('/appointments', requireVet);

// GET /appointments?date=YYYY-MM-DD&status=pending
router.get('/appointments', wrap(async (req, res) => {
  const { date, status } = req.query;
  if (date !== undefined && !isDateString(date)) throw httpError(400, 'วันที่ไม่ถูกต้อง');
  if (status !== undefined && !BOOKING_STATUSES.includes(status)) throw httpError(400, 'สถานะไม่ถูกต้อง');

  const bookings = (await listAllBookings()).filter((b) => (!date || b.date === date) && (!status || b.status === status));
  const result = [];
  for (const b of bookings) {
    result.push({ ...b, pet: petSummary(await getPetById(b.petId)) });
  }
  res.json(result);
}));

// POST /appointments/:id/status  { status: 'completed', note? }
// The vet only closes the case. Confirming, declining, no-show and rescheduling are done by the
// Medical Assistant (backend/src/modules/medical-assistant) through the same bookingStore.js.
router.post('/appointments/:id/status', wrap(async (req, res) => {
  const { status } = req.body ?? {};
  const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 500) : '';
  if (!BOOKING_STATUSES.includes(status)) throw httpError(400, 'สถานะไม่ถูกต้อง');
  if (status !== 'completed') throw httpError(403, 'ผู้ช่วยสัตวแพทย์เป็นผู้ดำเนินการ สัตวแพทย์ปิดเคสได้อย่างเดียว');
  const booking = await updateBookingStatus(req.params.id, status, note);
  res.json({ ...booking, pet: petSummary(await getPetById(booking.petId)) });
}));

/* ---------- Patients ---------- */

// A "patient" is any pet registered by an owner. Visit statistics come from the owners' bookings.

const today = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Visit statistics of one pet from its bookings (sorted by date and time). */
function visitStats(bookings) {
  const t = today();
  const completed = bookings.filter((b) => b.status === 'completed');
  const upcoming = bookings.filter((b) => ['pending', 'confirmed'].includes(b.status) && b.date >= t);
  const next = upcoming[0];
  return {
    visitCount: completed.length,
    lastVisit: completed.length ? completed[completed.length - 1].date : null,
    nextAppointment: next ? { date: next.date, time: next.time, status: next.status, serviceLabel: next.serviceLabel } : null,
  };
}

/** Pet fields for the list (no photo: it can be large). Owner id is not exposed. */
function patientListItem(pet, bookings) {
  const { id, name, species, breed, sex, birthDate, weight, allergies, chronicDiseases } = pet;
  return { id, name, species, breed, sex, birthDate, weight, allergies, chronicDiseases, ...visitStats(bookings) };
}

const byPetId = (bookings) => {
  const map = new Map();
  for (const b of bookings) map.set(b.petId, [...(map.get(b.petId) ?? []), b]);
  return map;
};

router.use('/patients', requireVet);

router.get('/patients', wrap(async (_req, res) => {
  const [pets, bookings] = await Promise.all([listAllPets(), listAllBookings()]);
  const grouped = byPetId(bookings);
  const list = pets.map((pet) => patientListItem(pet, grouped.get(pet.id) ?? []));
  list.sort((a, b) => a.name.localeCompare(b.name, 'th'));
  res.json(list);
}));

// Full record of one patient, with its appointments (newest first).
router.get('/patients/:id', wrap(async (req, res) => {
  const pet = await getPetById(req.params.id);
  if (!pet) throw httpError(404, 'ไม่พบข้อมูลคนไข้');
  const bookings = (await listAllBookings()).filter((b) => b.petId === pet.id);
  const { ownerId: _ownerId, ...record } = pet;
  res.json({
    ...record,
    ...visitStats(bookings),
    appointments: bookings.slice().reverse().map(({ ownerId: _o, ...b }) => b),
  });
}));

/* ---------- Medical records ---------- */

// A medical record is one entry of the pet's `treatments` list: the same list the owner sees on the
// Medical page. Entries written here carry `source: 'vet'`; owners cannot edit or delete them.

const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function parseRecord(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw httpError(400, 'ข้อมูลไม่ถูกต้อง');
  const record = {
    date: body.date,
    vet: text(body.vet, 100),
    clinic: text(body.clinic, 100),
    symptoms: text(body.symptoms, 2000),
    diagnosis: text(body.diagnosis, 2000),
    treatment: text(body.treatment, 2000),
    followUp: body.followUp || '',
  };
  if (!isDateString(record.date)) throw httpError(400, 'กรุณาเลือกวันที่ตรวจ');
  if (record.date > today()) throw httpError(400, 'วันที่ตรวจต้องไม่ใช่วันในอนาคต');
  if (!record.vet) throw httpError(400, 'กรุณากรอกชื่อสัตวแพทย์');
  if (!record.symptoms && !record.diagnosis) throw httpError(400, 'กรุณากรอกอาการหรือผลการวินิจฉัยอย่างน้อยหนึ่งอย่าง');
  if (record.followUp) {
    if (!isDateString(record.followUp)) throw httpError(400, 'วันนัดติดตามไม่ถูกต้อง');
    if (record.followUp < record.date) throw httpError(400, 'วันนัดติดตามต้องไม่ก่อนวันที่ตรวจ');
  }
  return record;
}

/**
 * Clinic-written entries in one of the pet's health lists (`treatments`, `vaccines`, `parasites`).
 * Entries carry `source: 'vet'`; owners cannot create, change or remove them (see the Pet Owner store).
 * Both helpers run inside the store's write queue.
 */
async function addClinicEntry(petId, listKey, record) {
  if (typeof petId !== 'string' || !petId) throw httpError(400, 'กรุณาเลือกคนไข้');
  const now = new Date().toISOString();
  const entry = { ...record, id: randomUUID(), source: 'vet', createdAt: now, updatedAt: now };
  await updatePetAsClinic(petId, (pet) => ({ ...pet, [listKey]: [...(pet[listKey] ?? []), entry] }));
  return entry;
}

async function editClinicEntry(petId, listKey, recordId, record, notFoundMessage) {
  let updated;
  await updatePetAsClinic(petId, (pet) => {
    const list = pet[listKey] ?? [];
    const index = list.findIndex((row) => row.id === recordId);
    if (index === -1) throw httpError(404, notFoundMessage);
    if (list[index].source !== 'vet') throw httpError(403, 'แก้ไขได้เฉพาะบันทึกที่คลินิกเป็นผู้บันทึก');
    updated = { ...list[index], ...record, updatedAt: new Date().toISOString() };
    const next = list.slice();
    next[index] = updated;
    return { ...pet, [listKey]: next };
  });
  return updated;
}

router.use('/medical-records', requireVet);

// POST /medical-records  { petId, date, vet, clinic?, symptoms?, diagnosis?, treatment?, followUp? }
router.post('/medical-records', wrap(async (req, res) => {
  const record = parseRecord(req.body);
  res.status(201).json(await addClinicEntry(req.body.petId, 'treatments', record));
}));

// PUT /medical-records/:petId/:recordId — only records written by the clinic can be changed
router.put('/medical-records/:petId/:recordId', wrap(async (req, res) => {
  const record = parseRecord(req.body);
  res.json(await editClinicEntry(req.params.petId, 'treatments', req.params.recordId, record, 'ไม่พบบันทึกการรักษานี้'));
}));

/* ---------- Vaccination and parasite treatment ---------- */

// Vaccinations go to the pet's `vaccines` list, parasite treatments to `parasites`: the same lists the
// owner sees (the owner's health history has a separate category for each). Both carry a `vet` field.

function parseDose(body, { isVaccine }) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw httpError(400, 'ข้อมูลไม่ถูกต้อง');
  const record = {
    date: body.date,
    nextDate: body.nextDate || '',
    place: text(body.place, 100),
    vet: text(body.vet, 100),
  };
  if (isVaccine) {
    record.name = text(body.name, 100);
    record.lot = text(body.lot, 200);
    if (!record.name) throw httpError(400, 'กรุณากรอกชื่อวัคซีน');
  } else {
    record.type = body.type;
    record.product = text(body.product, 100);
    if (!PARASITE_TYPES.includes(record.type)) throw httpError(400, 'กรุณาเลือกประเภทการป้องกันพยาธิ');
  }
  if (!isDateString(record.date)) throw httpError(400, 'กรุณาเลือกวันที่');
  if (record.date > today()) throw httpError(400, 'วันที่ต้องไม่ใช่วันในอนาคต');
  if (!record.vet) throw httpError(400, 'กรุณากรอกชื่อสัตวแพทย์');
  if (record.nextDate) {
    if (!isDateString(record.nextDate)) throw httpError(400, 'วันนัดครั้งถัดไปไม่ถูกต้อง');
    if (record.nextDate <= record.date) throw httpError(400, 'วันนัดครั้งถัดไปต้องหลังวันที่ให้บริการ');
  }
  return record;
}

const parseVaccination = (body) => parseDose(body, { isVaccine: true });
const parseParasite = (body) => parseDose(body, { isVaccine: false });

// dueVaccines() lives in dueVaccines.js (shared with the Medical Assistant module).

router.use('/vaccination', requireVet);
router.use('/parasite', requireVet);

// GET /vaccination/due?days=30
router.get('/vaccination/due', wrap(async (req, res) => {
  const days = req.query.days === undefined ? 30 : Number(req.query.days);
  if (!Number.isInteger(days) || days < 0 || days > 365) throw httpError(400, 'จำนวนวันไม่ถูกต้อง');
  res.json(dueVaccines(await listAllPets(), days));
}));

// POST /vaccination  { petId, name, date, nextDate?, place?, vet, lot? }
router.post('/vaccination', wrap(async (req, res) => {
  const record = parseVaccination(req.body);
  res.status(201).json(await addClinicEntry(req.body.petId, 'vaccines', record));
}));

// PUT /vaccination/:petId/:recordId — only records written by the clinic can be changed
router.put('/vaccination/:petId/:recordId', wrap(async (req, res) => {
  const record = parseVaccination(req.body);
  res.json(await editClinicEntry(req.params.petId, 'vaccines', req.params.recordId, record, 'ไม่พบบันทึกวัคซีนนี้'));
}));

// POST /parasite  { petId, type: 'deworm'|'flea'|'heartworm', product?, date, place?, vet, nextDate? }
// Used by the Medical Records page: it only records that the treatment was given (nextDate is optional).
router.post('/parasite', wrap(async (req, res) => {
  const record = parseParasite(req.body);
  res.status(201).json(await addClinicEntry(req.body.petId, 'parasites', record));
}));

// PUT /parasite/:petId/:recordId — only records written by the clinic can be changed
router.put('/parasite/:petId/:recordId', wrap(async (req, res) => {
  const record = parseParasite(req.body);
  res.json(await editClinicEntry(req.params.petId, 'parasites', req.params.recordId, record, 'ไม่พบบันทึกนี้'));
}));

/* ---------- Reports ---------- */

const MAX_REPORT_DAYS = 366;
const dayNumber = (dateString) => Math.round(Date.parse(`${dateString}T00:00:00Z`) / 86400000);
const addDaysTo = (dateString, days) => new Date((dayNumber(dateString) + days) * 86400000).toISOString().slice(0, 10);
const inRange = (date, from, to) => typeof date === 'string' && date >= from && date <= to;

function countBy(items, keyOf) {
  const counts = new Map();
  for (const item of items) counts.set(keyOf(item), (counts.get(keyOf(item)) ?? 0) + 1);
  return counts;
}

/** `[{ key, label?, count }]`, biggest first. */
const ranked = (counts, describe = (key) => ({ key })) =>
  [...counts.entries()].map(([key, count]) => ({ ...describe(key), count })).sort((a, b) => b.count - a.count);

router.use('/reports', requireVet);

// GET /reports?from=YYYY-MM-DD&to=YYYY-MM-DD  (default: the last 30 days up to today, at most 366 days)
router.get('/reports', wrap(async (req, res) => {
  const to = req.query.to ?? today();
  const from = req.query.from ?? addDaysTo(to, -29);
  if (!isDateString(from) || !isDateString(to)) throw httpError(400, 'วันที่ไม่ถูกต้อง');
  if (from > to) throw httpError(400, 'วันเริ่มต้นต้องไม่หลังวันสิ้นสุด');
  const days = dayNumber(to) - dayNumber(from) + 1;
  if (days > MAX_REPORT_DAYS) throw httpError(400, `เลือกช่วงเวลาได้ไม่เกิน ${MAX_REPORT_DAYS} วัน`);

  const [pets, allBookings] = await Promise.all([listAllPets(), listAllBookings()]);

  // Appointments
  const bookings = allBookings.filter((b) => inRange(b.date, from, to));
  const byStatus = Object.fromEntries(BOOKING_STATUSES.map((s) => [s, 0]));
  for (const [status, count] of countBy(bookings, (b) => b.status)) byStatus[status] = count;
  const byDayCounts = countBy(bookings, (b) => b.date);
  const byDay = Array.from({ length: days }, (_, i) => {
    const date = addDaysTo(from, i);
    return { date, count: byDayCounts.get(date) ?? 0 };
  });
  const byService = ranked(countBy(bookings, (b) => b.service), (service) => ({
    service,
    label: bookings.find((b) => b.service === service)?.serviceLabel ?? service,
  }));
  // Of the appointments that were actually carried out or missed.
  const decided = byStatus.completed + byStatus.no_show;

  // Work the clinic recorded in this period (entries written by the clinic only, by the date they happened)
  const clinicRows = (list) => pets.flatMap((p) => (p[list] ?? []).filter((r) => r.source === 'vet' && inRange(r.date, from, to)));
  const treatments = clinicRows('treatments');
  const vaccines = clinicRows('vaccines');
  const parasites = clinicRows('parasites');

  // Patients
  const seenPetIds = new Set(bookings.filter((b) => b.status === 'completed').map((b) => b.petId));
  const seenPets = pets.filter((p) => seenPetIds.has(p.id));

  res.json({
    range: { from, to, days },
    appointments: {
      total: bookings.length,
      byStatus,
      completionRate: decided ? byStatus.completed / decided : null,
      noShowRate: decided ? byStatus.no_show / decided : null,
      byService,
      byDay,
    },
    records: {
      treatments: treatments.length,
      vaccinations: vaccines.length,
      parasites: parasites.length,
      topVaccines: ranked(countBy(vaccines, (v) => String(v.name ?? '').trim()), (name) => ({ name })).slice(0, 5),
    },
    patients: {
      registered: pets.length,
      newInRange: pets.filter((p) => inRange(String(p.createdAt ?? '').slice(0, 10), from, to)).length,
      seen: seenPets.length,
      seenBySpecies: ranked(countBy(seenPets, (p) => p.species), (species) => ({ species })),
    },
  });
}));

/* Errors from this module's routes become JSON responses. */
router.use((err, _req, res, _next) => {
  const status = err.status ?? 500;
  if (status >= 500) console.error('[veterinarian]', err);
  res.status(status).json({ error: status >= 500 ? 'เกิดข้อผิดพลาดของเซิร์ฟเวอร์' : err.message });
});

export default router;
