import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { BOOKING_STATUSES, VET_VISIBLE_STATUSES, listAllBookings, updateBookingStatus } from '../pet-owner/bookingStore.js';
import { getPetById, listAllPets, updatePetAsClinic } from '../pet-owner/store.js';
import { dueVaccines } from './dueVaccines.js';
import { requireStaff } from '../auth/middleware.js';
import { OWNER_FIELDS, listOwnerProfiles } from '../pet-owner/ownerStore.js';

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

/** Only a logged-in veterinarian (staff login, see modules/auth) can use these endpoints. */
const requireVet = requireStaff('veterinarian');

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

/**
 * Every booking the vet side reads goes through here: only bookings the Medical Assistant has
 * confirmed (and what followed) are visible. See VET_VISIBLE_STATUSES in bookingStore.js.
 */
const listVetBookings = async () => (await listAllBookings()).filter((b) => VET_VISIBLE_STATUSES.includes(b.status));
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

  const bookings = (await listVetBookings()).filter((b) => (!date || b.date === date) && (!status || b.status === status));
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
  // updateBookingStatus only allows confirmed → completed, so a booking still waiting for the
  // Medical Assistant (pending) is refused with 409.
  const booking = await updateBookingStatus(req.params.id, status, note);
  res.json({ ...booking, pet: petSummary(await getPetById(booking.petId)) });
}));

/* ---------- Customers (owners) and their pets ---------- */

// A customer is an owner who registered pets; each pet is seen as a patient of the clinic ("สัตว์เลี้ยง" on
// the pages). Visit statistics come from the owners' bookings.

const today = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Visit statistics of one pet from its bookings (sorted by date and time). */
function visitStats(bookings) {
  const t = today();
  const completed = bookings.filter((b) => b.status === 'completed');
  const upcoming = bookings.filter((b) => b.status === 'confirmed' && b.date >= t);
  const next = upcoming[0];
  return {
    visitCount: completed.length,
    lastVisit: completed.length ? completed[completed.length - 1].date : null,
    nextAppointment: next ? { date: next.date, time: next.time, status: next.status, serviceLabel: next.serviceLabel } : null,
  };
}

const NO_CONTACT = { name: '', phone: '', email: '', address: '', emergencyName: '', emergencyPhone: '' };

/**
 * How to reach each owner, by owner id: the contact details the owner's pages sent (owners.json),
 * with the name and phone of their latest booking as a fallback. Owners we know nothing about get empty fields.
 */
async function ownerContacts() {
  const [profiles, bookings] = await Promise.all([listOwnerProfiles(), listAllBookings()]);
  const contacts = new Map();
  for (const b of bookings) {
    // bookings are sorted oldest first, so later ones overwrite earlier ones
    if (b.ownerName || b.ownerPhone) contacts.set(b.ownerId, { ...NO_CONTACT, name: b.ownerName ?? '', phone: b.ownerPhone ?? '' });
  }
  for (const p of profiles) {
    const fallback = contacts.get(p.ownerId) ?? NO_CONTACT;
    const own = Object.fromEntries(OWNER_FIELDS.filter((k) => p[k]).map((k) => [k, p[k]]));
    contacts.set(p.ownerId, { ...fallback, ...own });
  }
  return (ownerId) => ({ id: ownerId, ...NO_CONTACT, ...contacts.get(ownerId) });
}

/** Pet fields for the list (no photo: it can be large). `ownerName` lets the pickers show whose pet it is. */
function patientListItem(pet, bookings, ownerName = '') {
  const { id, name, species, breed, sex, birthDate, weight, allergies, chronicDiseases } = pet;
  // `visited`: the pet has a confirmed or finished appointment, i.e. it has been brought to the clinic
  // (the vet records the treatment during a confirmed visit, before closing it).
  const visited = bookings.some((b) => b.status === 'confirmed' || b.status === 'completed');
  return { id, name, species, breed, sex, birthDate, weight, allergies, chronicDiseases, ownerName, visited, ...visitStats(bookings) };
}

const byPetId = (bookings) => {
  const map = new Map();
  for (const b of bookings) map.set(b.petId, [...(map.get(b.petId) ?? []), b]);
  return map;
};

router.use('/patients', requireVet);
router.use('/owners', requireVet);

router.get('/patients', wrap(async (_req, res) => {
  const [pets, bookings, contactOf] = await Promise.all([listAllPets(), listVetBookings(), ownerContacts()]);
  const grouped = byPetId(bookings);
  const list = pets.map((pet) => patientListItem(pet, grouped.get(pet.id) ?? [], contactOf(pet.ownerId).name));
  list.sort((a, b) => a.name.localeCompare(b.name, 'th'));
  res.json(list);
}));

// Full record of one pet, with its appointments (newest first) and how to reach its owner.
router.get('/patients/:id', wrap(async (req, res) => {
  const pet = await getPetById(req.params.id);
  if (!pet) throw httpError(404, 'ไม่พบข้อมูลสัตว์เลี้ยง');
  const [allBookings, contactOf] = await Promise.all([listVetBookings(), ownerContacts()]);
  const bookings = allBookings.filter((b) => b.petId === pet.id);
  const { ownerId, ...record } = pet;
  res.json({
    ...record,
    owner: contactOf(ownerId),
    ...visitStats(bookings),
    appointments: bookings.slice().reverse().map(({ ownerId: _o, ...b }) => b),
  });
}));

/** The earlier of two `nextAppointment` values (either may be null). */
const earlierAppointment = (a, b) => {
  if (!a || !b) return a ?? b;
  return `${a.date} ${a.time}` <= `${b.date} ${b.time}` ? a : b;
};

/** One owner with the pets they registered: contact details, visit totals and a short pet list. */
function ownerSummary(ownerId, ownerPets, contactOf, grouped) {
  const items = ownerPets.map((pet) => patientListItem(pet, grouped.get(pet.id) ?? [], contactOf(ownerId).name));
  items.sort((a, b) => a.name.localeCompare(b.name, 'th'));
  return {
    ...contactOf(ownerId),
    petCount: items.length,
    visitCount: items.reduce((sum, p) => sum + p.visitCount, 0),
    lastVisit: items.reduce((latest, p) => (p.lastVisit && (!latest || p.lastVisit > latest) ? p.lastVisit : latest), null),
    nextAppointment: items.reduce((next, p) => earlierAppointment(next, p.nextAppointment), null),
    pets: items,
  };
}

const groupByOwner = (pets) => {
  const map = new Map();
  for (const pet of pets) map.set(pet.ownerId, [...(map.get(pet.ownerId) ?? []), pet]);
  return map;
};

// GET /owners — every customer who registered a pet, with contact details and their pets
router.get('/owners', wrap(async (_req, res) => {
  const [pets, bookings, contactOf] = await Promise.all([listAllPets(), listVetBookings(), ownerContacts()]);
  const grouped = byPetId(bookings);
  const list = [...groupByOwner(pets)].map(([ownerId, ownerPets]) => ownerSummary(ownerId, ownerPets, contactOf, grouped));
  list.sort((a, b) => (a.name || '￿').localeCompare(b.name || '￿', 'th'));
  res.json(list);
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
  if (typeof petId !== 'string' || !petId) throw httpError(400, 'กรุณาเลือกสัตว์เลี้ยง');
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

  const [pets, allBookings] = await Promise.all([listAllPets(), listVetBookings()]);

  // Appointments
  const bookings = allBookings.filter((b) => inRange(b.date, from, to));
  const byStatus = Object.fromEntries(VET_VISIBLE_STATUSES.map((s) => [s, 0]));
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
