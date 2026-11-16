import { Router } from 'express';
import { BOOKING_STATUSES, listAllBookings, updateBookingStatus } from '../pet-owner/bookingStore.js';
import { getPetById, listAllPets } from '../pet-owner/store.js';

/**
 * Veterinarian API module
 * Owner: มะแอ่ว
 *
 * Reads the owners' bookings and pets that the Pet Owner module stores
 * (backend/src/modules/pet-owner), so both modules always see the same data.
 */
const router = Router();

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

// POST /appointments/:id/status  { status: 'confirmed'|'rejected'|'completed'|'no_show', note? }
router.post('/appointments/:id/status', wrap(async (req, res) => {
  const { status } = req.body ?? {};
  const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 500) : '';
  if (!BOOKING_STATUSES.includes(status)) throw httpError(400, 'สถานะไม่ถูกต้อง');
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

/* ---------- Not implemented yet ---------- */

router.get('/medical-records', (_req, res) => {
  res.json({ module: 'veterinarian', page: 'medical-records', status: 'placeholder' });
});

router.get('/vaccination', (_req, res) => {
  res.json({ module: 'veterinarian', page: 'vaccination', status: 'placeholder' });
});

router.get('/reports', (_req, res) => {
  res.json({ module: 'veterinarian', page: 'reports', status: 'placeholder' });
});

/* Errors from this module's routes become JSON responses. */
router.use((err, _req, res, _next) => {
  const status = err.status ?? 500;
  if (status >= 500) console.error('[veterinarian]', err);
  res.status(status).json({ error: status >= 500 ? 'เกิดข้อผิดพลาดของเซิร์ฟเวอร์' : err.message });
});

export default router;
