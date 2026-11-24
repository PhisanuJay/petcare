import { Router } from 'express';
import { requireStaff } from '../auth/middleware.js';
import { findStaffAnyById, listStaff } from '../auth/staffAccounts.js';
import { getClosure, getSettings, listServices } from '../clinic-admin/clinicSettings.js';
import { isVetOnDuty, vetsOnDuty } from '../clinic-admin/rosterStore.js';
import {
  BOOKING_STATUSES,
  VET_VISIBLE_STATUSES,
  listAllBookings,
  rescheduleBookingAsClinic,
  updateBookingStatus,
} from '../pet-owner/bookingStore.js';
import {
  BOOKING_SERVICES,
  WEEKDAY_HOURS,
  WEEKEND_HOURS,
  isDateString,
  todayString,
} from '../pet-owner/clinicSchedule.js';
import { httpError } from '../pet-owner/jsonCollection.js';
import { getPetById, listAllPets } from '../pet-owner/store.js';
import { dueVaccines } from '../veterinarian/dueVaccines.js';
import {
  CAUTION_FLAGS,
  DURATIONS,
  MA_STAGES,
  NOTE_CATEGORIES,
  REJECT_REASONS,
  TRIAGE_LEVELS,
  VITAL_LIMITS,
  minutesToTime,
  overlaps,
  toMinutes,
} from './maRules.js';
import { addNote, deleteNote, getEntry, listEntries, setFlags } from './patientNoteStore.js';
import { backfillVetIds, getVisit, listVisits, upsertVisit } from './visitStore.js';

/**
 * Medical Assistant API module
 * Owner: เอิร์ท
 *
 * Uses the shared Pet Owner / Veterinarian bookingStore, store, clinicSchedule, and dueVaccines.
 * Internal clinic workflow (vet assignment, duration, check-in, treatment start, triage, vitals,
 * checklist, and patient caution notes) lives in this module's own stores keyed by bookingId / petId.
 */
const router = Router();

backfillVetIds();

const requireMA = requireStaff('medical_assistant');
const vetNames = () => listStaff('veterinarian').map((s) => s.name);

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

function resolveVetName(visit) {
  if (!visit) return null;
  if (visit.vetId) {
    const staff = findStaffAnyById(visit.vetId);
    if (staff?.name) return staff.name;
  }
  return visit.vet ?? null;
}

function decorateVisit(visit) {
  if (!visit) return null;
  const vetName = resolveVetName(visit);
  return {
    ...visit,
    vetId: visit.vetId ?? null,
    vetName,
  };
}

function resolveActiveVet({ vetId, vet }) {
  const activeVets = listStaff('veterinarian');
  if (typeof vetId === 'string' && vetId.trim()) {
    return activeVets.find((s) => s.id === vetId.trim()) ?? null;
  }
  if (typeof vet === 'string' && vet.trim()) {
    return activeVets.find((s) => s.name === vet.trim()) ?? null;
  }
  return null;
}

function petSummary(pet) {
  if (!pet) return null;
  const {
    id,
    name,
    species,
    breed,
    sex,
    birthDate,
    weight,
    neutered,
    allergies,
    chronicDiseases,
    medications,
  } = pet;
  return {
    id,
    name,
    species,
    breed,
    sex,
    birthDate,
    weight,
    neutered,
    allergies,
    chronicDiseases,
    medications,
  };
}

function computeStage(booking, visit) {
  if (booking.status === 'confirmed') {
    if (visit?.treatmentStartedAt) return 'in_treatment';
    if (visit?.checkedInAt) return 'checked_in';
    return 'confirmed';
  }
  return booking.status;
}

function appointmentView(booking, visit, pet) {
  const { ownerId: _ownerId, ...rest } = booking;
  const decoratedVisit = decorateVisit(visit);
  const closure = ['pending', 'confirmed'].includes(booking.status)
    ? getClosure(booking.date)
    : null;
  return {
    ...rest,
    ownerName: rest.ownerName ?? '',
    ownerPhone: rest.ownerPhone ?? '',
    pet: petSummary(pet),
    visit: decoratedVisit,
    vetId: decoratedVisit?.vetId ?? null,
    vetName: decoratedVisit?.vetName ?? null,
    stage: computeStage(booking, visit),
    visibleToVet: VET_VISIBLE_STATUSES.includes(booking.status),
    closure: closure ? { reason: closure.reason } : null,
  };
}

function sameVet(visit, { vetId, vet }) {
  if (vetId && visit.vetId) return visit.vetId === vetId;
  if (vetId && !visit.vetId) return visit.vet === vet;
  return Boolean(vet && visit.vet === vet);
}

function findVetConflict(
  bookings,
  visitsMap,
  { vetId = null, vet, date, time, durationMin },
  excludeId = null,
) {
  const targetStart = toMinutes(time);
  const targetDur = Number(durationMin) || 30;
  if (Number.isNaN(targetStart)) return null;

  for (const b of bookings) {
    if (b.id === excludeId) continue;
    if (b.status !== 'confirmed' && b.status !== 'completed') continue;
    if (b.date !== date) continue;
    const v = visitsMap.get(b.id);
    if (!v || !sameVet(v, { vetId, vet })) continue;

    const bStart = toMinutes(b.time);
    const bDur = Number(v.durationMin) || 30;
    if (overlaps(targetStart, targetDur, bStart, bDur)) {
      return {
        booking: b,
        rangeText: `${b.time}–${minutesToTime(bStart + bDur)} น.`,
      };
    }
  }
  return null;
}

const byDateTimeAsc = (a, b) =>
  `${a.date ?? ''} ${a.time ?? ''}`.localeCompare(`${b.date ?? ''} ${b.time ?? ''}`);

const byDateTimeDesc = (a, b) => byDateTimeAsc(b, a);

function visitStatsFor(bookings, visitsMap) {
  const sorted = [...bookings].sort(byDateTimeAsc);
  const t = todayString();
  const completed = sorted.filter((b) => b.status === 'completed');
  const upcoming = sorted.filter(
    (b) => ['pending', 'confirmed'].includes(b.status) && b.date >= t,
  );
  const next = upcoming[0];
  const nextVisit = next ? visitsMap.get(next.id) : null;
  return {
    visitCount: completed.length,
    lastVisit: completed.length ? completed[completed.length - 1].date : null,
    nextAppointment: next
      ? {
          id: next.id,
          date: next.date,
          time: next.time,
          status: next.status,
          serviceLabel: next.serviceLabel,
          vetId: nextVisit?.vetId ?? null,
          vet: resolveVetName(nextVisit),
        }
      : null,
  };
}

function latestOwnerContact(bookings) {
  const sorted = [...bookings].sort(byDateTimeAsc);
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const b = sorted[i];
    if (b.ownerName || b.ownerPhone) {
      return { ownerName: b.ownerName ?? '', ownerPhone: b.ownerPhone ?? '' };
    }
  }
  return { ownerName: '', ownerPhone: '' };
}

function hasAnyVitals(vitals) {
  if (!vitals || typeof vitals !== 'object') return false;
  return Object.values(vitals).some((val) => val !== '' && val !== null && val !== undefined);
}

router.get('/', (_req, res) => {
  res.json({ module: 'medical-assistant', owner: 'เอิร์ท', status: 'ok' });
});

router.use(requireMA);

/* ---------- Appointments ---------- */

// GET /appointments?date=&from=&to=&status=&stage=
router.get(
  '/appointments',
  wrap(async (req, res) => {
    const { date, from, to, status, stage } = req.query;
    if (date !== undefined && !isDateString(date)) throw httpError(400, 'วันที่ไม่ถูกต้อง');
    if (from !== undefined && !isDateString(from)) throw httpError(400, 'วันเริ่มต้นไม่ถูกต้อง');
    if (to !== undefined && !isDateString(to)) throw httpError(400, 'วันสิ้นสุดไม่ถูกต้อง');
    if (from && to && from > to) throw httpError(400, 'วันเริ่มต้นต้องไม่หลังวันสิ้นสุด');
    if (status !== undefined && !BOOKING_STATUSES.includes(status)) {
      throw httpError(400, 'สถานะไม่ถูกต้อง');
    }
    if (stage !== undefined && !MA_STAGES.includes(stage)) {
      throw httpError(400, 'ขั้นตอนไม่ถูกต้อง');
    }

    const [bookings, visits, pets] = await Promise.all([
      listAllBookings(),
      listVisits(),
      listAllPets(),
    ]);

    const visitsMap = new Map(visits.map((v) => [v.bookingId, v]));
    const petsMap = new Map(pets.map((p) => [p.id, p]));
    const sortedBookings = [...bookings].sort(byDateTimeAsc);

    const views = [];
    for (const b of sortedBookings) {
      if (date && b.date !== date) continue;
      if (from && b.date < from) continue;
      if (to && b.date > to) continue;
      if (status && b.status !== status) continue;

      const view = appointmentView(b, visitsMap.get(b.id) ?? null, petsMap.get(b.petId) ?? null);
      if (stage && view.stage !== stage) continue;
      views.push(view);
    }

    res.json(views);
  }),
);

// GET /appointments/:id — single appointmentView + vet records/vaccines/parasites on the same date (no ownerId, no photo)
router.get(
  '/appointments/:id',
  wrap(async (req, res) => {
    const bookings = await listAllBookings();
    const booking = bookings.find((b) => b.id === req.params.id);
    if (!booking) throw httpError(404, 'ไม่พบนัดหมายนี้');

    const [visit, pet] = await Promise.all([
      getVisit(booking.id),
      getPetById(booking.petId),
    ]);

    const sameDayVetEntry = (r) => r && r.source === 'vet' && r.date === booking.date;
    res.json({
      ...appointmentView(booking, visit, pet),
      vetRecords: (pet?.treatments ?? []).filter(sameDayVetEntry),
      vaccinesGiven: (pet?.vaccines ?? []).filter(sameDayVetEntry),
      parasitesGiven: (pet?.parasites ?? []).filter(sameDayVetEntry),
    });
  }),
);

// POST /appointments/:id/status  { status: 'confirmed'|'rejected'|'no_show', ... }
router.post(
  '/appointments/:id/status',
  wrap(async (req, res) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw httpError(400, 'ข้อมูลไม่ถูกต้อง');
    }

    const { status } = body;
    if (['completed', 'cancelled', 'pending'].includes(status)) {
      throw httpError(403, 'ผู้ช่วยสัตวแพทย์ไม่สามารถตั้งสถานะนี้ได้');
    }
    if (!['confirmed', 'rejected', 'no_show'].includes(status)) {
      throw httpError(400, 'สถานะไม่ถูกต้อง');
    }

    const [bookings, visits] = await Promise.all([listAllBookings(), listVisits()]);
    const current = bookings.find((b) => b.id === req.params.id);
    if (!current) throw httpError(404, 'ไม่พบนัดหมายนี้');

    const visitsMap = new Map(visits.map((v) => [v.bookingId, v]));
    const currentVisit = visitsMap.get(current.id) ?? null;
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '';
    const now = new Date().toISOString();

    if (status === 'confirmed') {
      if (current.status !== 'pending') {
        throw httpError(409, 'สามารถยืนยันได้เฉพาะนัดที่รอยืนยันเท่านั้น');
      }
      const vetStaff = resolveActiveVet({ vetId: body.vetId, vet: body.vet });
      const durationMin = Number(body.durationMin);
      if (!vetStaff) throw httpError(400, 'กรุณาเลือกสัตวแพทย์ที่ถูกต้อง');
      if (!DURATIONS.includes(durationMin)) throw httpError(400, 'กรุณาเลือกระยะเวลาที่ถูกต้อง');

      if (!isVetOnDuty(vetStaff.id, current.date)) {
        throw httpError(409, `${vetStaff.name} ไม่ได้เข้าเวรวันที่ ${current.date}`);
      }

      const conflict = findVetConflict(
        bookings,
        visitsMap,
        { vetId: vetStaff.id, vet: vetStaff.name, date: current.date, time: current.time, durationMin },
        current.id,
      );
      if (conflict) {
        throw httpError(
          409,
          `${vetStaff.name} มีนัดชนกับ ${conflict.booking.petName} ช่วงเวลา ${conflict.rangeText}`,
        );
      }

      const booking = await updateBookingStatus(current.id, 'confirmed', note);
      const visit = await upsertVisit(current.id, {
        petId: booking.petId,
        vetId: vetStaff.id,
        vet: vetStaff.name,
        durationMin,
        handledAt: now,
        handledBy: req.staff.name,
        handledById: req.staff.id,
      });
      const pet = await getPetById(booking.petId);
      return res.json(appointmentView(booking, visit, pet));
    }

    if (status === 'rejected') {
      if (current.status !== 'pending') {
        throw httpError(409, 'สามารถปฏิเสธได้เฉพาะนัดที่รอยืนยันเท่านั้น');
      }
      const { reason } = body;
      if (!REJECT_REASONS.includes(reason)) throw httpError(400, 'กรุณาเลือกเหตุผลในการปฏิเสธ');
      if (reason === 'อื่นๆ' && !note) {
        throw httpError(400, 'กรุณาระบุรายละเอียดเพิ่มเติมเมื่อเลือกเหตุผล "อื่นๆ"');
      }

      const clinicNote = note ? `${reason} — ${note}` : reason;
      const booking = await updateBookingStatus(current.id, 'rejected', clinicNote);
      const visit = await upsertVisit(current.id, {
        petId: booking.petId,
        rejectReason: reason,
        handledAt: now,
        handledBy: req.staff.name,
        handledById: req.staff.id,
      });
      const pet = await getPetById(booking.petId);
      return res.json(appointmentView(booking, visit, pet));
    }

    // status === 'no_show'
    if (current.status !== 'confirmed') {
      throw httpError(409, 'บันทึกไม่มาตามนัดได้เฉพาะนัดที่ยืนยันแล้วเท่านั้น');
    }
    if (currentVisit?.checkedInAt) {
      throw httpError(409, 'นัดนี้เช็คอินแล้ว ไม่สามารถตั้งเป็นไม่มาตามนัดได้');
    }
    if (current.date > todayString()) {
      throw httpError(409, 'ยังไม่ถึงวันนัด');
    }

    const booking = await updateBookingStatus(current.id, 'no_show', note);
    const pet = await getPetById(booking.petId);
    res.json(appointmentView(booking, currentVisit, pet));
  }),
);

// POST /appointments/:id/reschedule  { date, time }
router.post(
  '/appointments/:id/reschedule',
  wrap(async (req, res) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw httpError(400, 'ข้อมูลไม่ถูกต้อง');
    }
    const { date, time } = body;

    const [bookings, visits] = await Promise.all([listAllBookings(), listVisits()]);
    const current = bookings.find((b) => b.id === req.params.id);
    if (!current) throw httpError(404, 'ไม่พบนัดหมายนี้');
    if (!['pending', 'confirmed'].includes(current.status)) {
      throw httpError(409, 'นัดนี้ดำเนินการไปแล้ว ไม่สามารถเลื่อนได้');
    }

    const visitsMap = new Map(visits.map((v) => [v.bookingId, v]));
    const currentVisit = visitsMap.get(current.id) ?? null;
    if (currentVisit?.checkedInAt) {
      throw httpError(409, 'ผู้ป่วยเช็คอินแล้ว ไม่สามารถเลื่อนนัดได้');
    }

    if (currentVisit && (currentVisit.vetId || currentVisit.vet) && isDateString(date)) {
      const assignedVetId =
        currentVisit.vetId ??
        listStaff('veterinarian').find((s) => s.name === currentVisit.vet)?.id ??
        null;
      const assignedVetName = resolveVetName(currentVisit);

      if (assignedVetId && !isVetOnDuty(assignedVetId, date)) {
        throw httpError(409, `${assignedVetName} ไม่ได้เข้าเวรวันที่ ${date}`);
      }

      if (typeof time === 'string' && time) {
        const conflict = findVetConflict(
          bookings,
          visitsMap,
          {
            vetId: assignedVetId,
            vet: assignedVetName,
            date,
            time,
            durationMin: currentVisit.durationMin || 30,
          },
          current.id,
        );
        if (conflict) {
          throw httpError(
            409,
            `${assignedVetName} มีนัดชนกับ ${conflict.booking.petName} ช่วงเวลา ${conflict.rangeText}`,
          );
        }
      }
    }

    const updated = await rescheduleBookingAsClinic(current.id, { date, time });
    const changed = updated.date !== current.date || updated.time !== current.time;
    const visit = changed
      ? await upsertVisit(current.id, {
          petId: updated.petId,
          rescheduledFrom: currentVisit?.rescheduledFrom ?? {
            date: current.date,
            time: current.time,
          },
        })
      : currentVisit;

    const pet = await getPetById(updated.petId);
    res.json(appointmentView(updated, visit, pet));
  }),
);

// POST /appointments/:id/check-in
router.post(
  '/appointments/:id/check-in',
  wrap(async (req, res) => {
    const bookings = await listAllBookings();
    const current = bookings.find((b) => b.id === req.params.id);
    if (!current) throw httpError(404, 'ไม่พบนัดหมายนี้');
    if (current.status !== 'confirmed') {
      throw httpError(409, 'เช็คอินได้เฉพาะนัดที่ยืนยันแล้วเท่านั้น');
    }
    if (current.date !== todayString()) {
      throw httpError(409, 'เช็คอินได้เฉพาะนัดหมายของวันนี้เท่านั้น');
    }

    const currentVisit = await getVisit(current.id);
    if (currentVisit?.checkedInAt) {
      throw httpError(409, 'นัดนี้เช็คอินไปแล้ว');
    }

    const visit = await upsertVisit(current.id, {
      petId: current.petId,
      checkedInAt: new Date().toISOString(),
      checkedInBy: req.staff.name,
      checkedInById: req.staff.id,
    });
    const pet = await getPetById(current.petId);
    res.json(appointmentView(current, visit, pet));
  }),
);

// POST /appointments/:id/start-treatment
router.post(
  '/appointments/:id/start-treatment',
  wrap(async (req, res) => {
    const bookings = await listAllBookings();
    const current = bookings.find((b) => b.id === req.params.id);
    if (!current) throw httpError(404, 'ไม่พบนัดหมายนี้');
    if (current.status !== 'confirmed') {
      throw httpError(409, 'เริ่มตรวจได้เฉพาะนัดที่ยืนยันแล้วเท่านั้น');
    }

    const currentVisit = await getVisit(current.id);
    if (!currentVisit?.checkedInAt) {
      throw httpError(409, 'กรุณาเช็คอินผู้ป่วยก่อนเริ่มตรวจ');
    }
    if (currentVisit.treatmentStartedAt) {
      throw httpError(409, 'นัดนี้เริ่มตรวจไปแล้ว');
    }

    const visit = await upsertVisit(current.id, {
      petId: current.petId,
      treatmentStartedAt: new Date().toISOString(),
    });
    const pet = await getPetById(current.petId);
    res.json(appointmentView(current, visit, pet));
  }),
);

// POST /appointments/:id/contacted
router.post(
  '/appointments/:id/contacted',
  wrap(async (req, res) => {
    const bookings = await listAllBookings();
    const current = bookings.find((b) => b.id === req.params.id);
    if (!current) throw httpError(404, 'ไม่พบนัดหมายนี้');
    if (current.status !== 'no_show') {
      throw httpError(409, 'บันทึกการติดต่อได้เฉพาะนัดที่ไม่มาตามนัดเท่านั้น');
    }

    const visit = await upsertVisit(current.id, {
      petId: current.petId,
      contactedAt: new Date().toISOString(),
      contactedBy: req.staff.name,
      contactedById: req.staff.id,
    });
    const pet = await getPetById(current.petId);
    res.json(appointmentView(current, visit, pet));
  }),
);

/* ---------- Visits / Triage ---------- */

function parseVitals(rawVitals) {
  if (rawVitals === undefined) return undefined;
  if (!rawVitals || typeof rawVitals !== 'object' || Array.isArray(rawVitals)) {
    throw httpError(400, 'ข้อมูลสัญญาณชีพไม่ถูกต้อง');
  }

  const parsed = {};
  for (const [key, limit] of Object.entries(VITAL_LIMITS)) {
    if (rawVitals[key] === undefined) continue;
    const val = rawVitals[key];
    if (val === '' || val === null) {
      parsed[key] = '';
      continue;
    }
    const num = Number(val);
    if (!Number.isFinite(num)) {
      throw httpError(400, `ค่า ${key} ต้องเป็นตัวเลข`);
    }
    if (limit.integer && !Number.isInteger(num)) {
      throw httpError(400, `ค่า ${key} ต้องเป็นจำนวนเต็ม`);
    }
    if (num < limit.min || num > limit.max) {
      throw httpError(400, `ค่า ${key} ต้องอยู่ระหว่าง ${limit.min} ถึง ${limit.max}`);
    }
    parsed[key] = num;
  }

  for (const strKey of ['mucous', 'crt']) {
    if (rawVitals[strKey] === undefined) continue;
    if (typeof rawVitals[strKey] !== 'string') {
      throw httpError(400, `ข้อมูล ${strKey} ไม่ถูกต้อง`);
    }
    parsed[strKey] = rawVitals[strKey].trim().slice(0, 100);
  }

  return parsed;
}

function parseChecklist(rawChecklist) {
  if (rawChecklist === undefined) return undefined;
  if (!rawChecklist || typeof rawChecklist !== 'object' || Array.isArray(rawChecklist)) {
    throw httpError(400, 'ข้อมูลรายการเตรียมความพร้อมไม่ถูกต้อง');
  }
  const clean = {};
  for (const [k, v] of Object.entries(rawChecklist)) {
    if (typeof v !== 'boolean') {
      throw httpError(400, 'ค่าใน checklist ต้องเป็น boolean เท่านั้น');
    }
    clean[String(k).slice(0, 200)] = v;
  }
  return clean;
}

// PUT /visits/:bookingId  { triage?, chiefComplaint?, vitals?, checklist? }
router.put(
  '/visits/:bookingId',
  wrap(async (req, res) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw httpError(400, 'ข้อมูลไม่ถูกต้อง');
    }

    const bookings = await listAllBookings();
    const booking = bookings.find((b) => b.id === req.params.bookingId);
    if (!booking) throw httpError(404, 'ไม่พบนัดหมายนี้');
    if (booking.status !== 'confirmed') {
      throw httpError(409, 'บันทึกการคัดกรองได้เฉพาะนัดที่ยืนยันแล้วและยังไม่ปิดเคสเท่านั้น');
    }

    const currentVisit = await getVisit(booking.id);
    if (!currentVisit?.checkedInAt) {
      throw httpError(409, 'กรุณาเช็คอินผู้ป่วยก่อนบันทึกการคัดกรอง');
    }

    const patch = { petId: booking.petId };

    if (body.triage !== undefined) {
      if (body.triage !== '' && !TRIAGE_LEVELS.includes(body.triage)) {
        throw httpError(400, 'ระดับความเร่งด่วนไม่ถูกต้อง');
      }
      patch.triage = body.triage;
    }

    if (body.chiefComplaint !== undefined) {
      if (typeof body.chiefComplaint !== 'string') {
        throw httpError(400, 'ข้อมูลอาการสำคัญไม่ถูกต้อง');
      }
      const trimmed = body.chiefComplaint.trim();
      if (trimmed.length > 1000) {
        throw httpError(400, 'อาการสำคัญต้องไม่เกิน 1000 ตัวอักษร');
      }
      patch.chiefComplaint = trimmed;
    }

    const vitals = parseVitals(body.vitals);
    if (vitals !== undefined) patch.vitals = vitals;

    const checklist = parseChecklist(body.checklist);
    if (checklist !== undefined) patch.checklist = checklist;

    const updated = await upsertVisit(booking.id, patch);
    res.json(decorateVisit(updated));
  }),
);

// GET /visits?date=YYYY-MM-DD
router.get(
  '/visits',
  wrap(async (req, res) => {
    const date = req.query.date ?? todayString();
    if (!isDateString(date)) throw httpError(400, 'วันที่ไม่ถูกต้อง');

    const [bookings, visits] = await Promise.all([listAllBookings(), listVisits()]);
    const visitsMap = new Map(visits.map((v) => [v.bookingId, v]));

    const result = [];
    for (const b of bookings) {
      if (b.date !== date) continue;
      const v = visitsMap.get(b.id);
      if (!v) continue;
      result.push({
        ...decorateVisit(v),
        petName: b.petName,
        petSpecies: b.petSpecies,
        time: b.time,
        serviceLabel: b.serviceLabel,
        status: b.status,
        stage: computeStage(b, v),
      });
    }

    res.json(result);
  }),
);

/* ---------- Patients ---------- */

// GET /patients — all registered pets (no photo, no ownerId), sorted by Thai name
router.get(
  '/patients',
  wrap(async (_req, res) => {
    const [pets, bookings, visits, entries] = await Promise.all([
      listAllPets(),
      listAllBookings(),
      listVisits(),
      listEntries(),
    ]);

    const visitsMap = new Map(visits.map((v) => [v.bookingId, v]));
    const entriesMap = new Map(entries.map((e) => [e.petId, e]));
    const bookingsByPet = new Map();
    for (const b of bookings) {
      bookingsByPet.set(b.petId, [...(bookingsByPet.get(b.petId) ?? []), b]);
    }

    const list = pets.map((pet) => {
      const petBookings = bookingsByPet.get(pet.id) ?? [];
      const contact = latestOwnerContact(petBookings);
      return {
        ...petSummary(pet),
        ...visitStatsFor(petBookings, visitsMap),
        flags: entriesMap.get(pet.id)?.flags ?? [],
        ownerName: contact.ownerName,
        ownerPhone: contact.ownerPhone,
      };
    });

    list.sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''), 'th'));
    res.json(list);
  }),
);

// GET /patients/:id — full patient record (no ownerId) + appointments + flags + notes + latestVitals
router.get(
  '/patients/:id',
  wrap(async (req, res) => {
    const pet = await getPetById(req.params.id);
    if (!pet) throw httpError(404, 'ไม่พบข้อมูลสัตว์เลี้ยง');

    const [allBookings, visits, noteEntry] = await Promise.all([
      listAllBookings(),
      listVisits(),
      getEntry(pet.id),
    ]);

    const visitsMap = new Map(visits.map((v) => [v.bookingId, v]));
    const petBookings = allBookings.filter((b) => b.petId === pet.id);
    const contact = latestOwnerContact(petBookings);

    // Newest first
    const newestFirst = [...petBookings].sort(byDateTimeDesc);
    const appointments = newestFirst.map((b) =>
      appointmentView(b, visitsMap.get(b.id) ?? null, pet),
    );

    let latestVitals = null;
    for (const b of newestFirst) {
      const v = visitsMap.get(b.id);
      if (v && hasAnyVitals(v.vitals)) {
        latestVitals = {
          bookingId: b.id,
          date: b.date,
          time: b.time,
          vitals: v.vitals,
        };
        break;
      }
    }

    const { ownerId: _ownerId, ...record } = pet;
    res.json({
      ...record,
      ...visitStatsFor(petBookings, visitsMap),
      ownerName: contact.ownerName,
      ownerPhone: contact.ownerPhone,
      flags: noteEntry.flags,
      notes: noteEntry.notes,
      latestVitals,
      appointments,
    });
  }),
);

// PUT /patients/:id/flags  { flags: string[] }
router.put(
  '/patients/:id/flags',
  wrap(async (req, res) => {
    const pet = await getPetById(req.params.id);
    if (!pet) throw httpError(404, 'ไม่พบข้อมูลสัตว์เลี้ยง');

    const flags = req.body?.flags;
    if (!Array.isArray(flags)) throw httpError(400, 'ข้อมูล flags ไม่ถูกต้อง');

    const seen = new Set();
    for (const f of flags) {
      if (typeof f !== 'string' || !CAUTION_FLAGS.includes(f)) {
        throw httpError(400, 'ค่าข้อควรระวังไม่ถูกต้อง');
      }
      if (seen.has(f)) throw httpError(400, 'ค่าข้อควรระวังห้ามซ้ำกัน');
      seen.add(f);
    }

    res.json(await setFlags(pet.id, flags));
  }),
);

// POST /patients/:id/notes  { category, text }
router.post(
  '/patients/:id/notes',
  wrap(async (req, res) => {
    const pet = await getPetById(req.params.id);
    if (!pet) throw httpError(404, 'ไม่พบข้อมูลสัตว์เลี้ยง');

    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw httpError(400, 'ข้อมูลไม่ถูกต้อง');
    }

    const { category } = body;
    if (!NOTE_CATEGORIES.includes(category)) {
      throw httpError(400, 'หมวดหมู่บันทึกไม่ถูกต้อง');
    }

    if (typeof body.text !== 'string') throw httpError(400, 'กรุณากรอกข้อความบันทึก');
    const text = body.text.trim();
    if (text.length < 1 || text.length > 1000) {
      throw httpError(400, 'ข้อความบันทึกต้องมีความยาว 1–1000 ตัวอักษร');
    }

    res.status(201).json(await addNote(pet.id, { category, text }));
  }),
);

// DELETE /patients/:id/notes/:noteId
router.delete(
  '/patients/:id/notes/:noteId',
  wrap(async (req, res) => {
    const pet = await getPetById(req.params.id);
    if (!pet) throw httpError(404, 'ไม่พบข้อมูลสัตว์เลี้ยง');
    res.json(await deleteNote(pet.id, req.params.noteId));
  }),
);

/* ---------- Vaccination & Meta ---------- */

function addDaysTo(dateString, days) {
  const ms = Date.parse(`${dateString}T00:00:00Z`) + days * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

// GET /vaccination/due?days=30
router.get(
  '/vaccination/due',
  wrap(async (req, res) => {
    const days = req.query.days === undefined ? 30 : Number(req.query.days);
    if (!Number.isInteger(days) || days < 0 || days > 365) {
      throw httpError(400, 'จำนวนวันไม่ถูกต้อง');
    }
    res.json(dueVaccines(await listAllPets(), days));
  }),
);

// GET /follow-ups?days=7 — vet treatment followUps due within `days` (or overdue) without a subsequent active booking
router.get(
  '/follow-ups',
  wrap(async (req, res) => {
    const days = req.query.days === undefined ? 7 : Number(req.query.days);
    if (!Number.isInteger(days) || days < 0 || days > 365) {
      throw httpError(400, 'จำนวนวันไม่ถูกต้อง');
    }

    const t = todayString();
    const limitDate = addDaysTo(t, days);
    const [pets, bookings] = await Promise.all([listAllPets(), listAllBookings()]);

    const bookingsByPet = new Map();
    for (const b of bookings) {
      bookingsByPet.set(b.petId, [...(bookingsByPet.get(b.petId) ?? []), b]);
    }

    const items = [];
    for (const pet of pets) {
      const petBookings = bookingsByPet.get(pet.id) ?? [];
      const contact = latestOwnerContact(petBookings);
      const vetTreatments = (pet.treatments ?? []).filter(
        (r) => r && r.source === 'vet' && r.followUp && r.followUp <= limitDate,
      );

      const dedupByDate = new Map();
      for (const r of vetTreatments) {
        const hasBookingAfterVisit = petBookings.some(
          (b) =>
            b.date > r.date && !['cancelled', 'rejected', 'no_show'].includes(b.status),
        );
        if (hasBookingAfterVisit) continue;
        const prev = dedupByDate.get(r.followUp);
        if (!prev || (r.date ?? '') >= (prev.date ?? '')) {
          dedupByDate.set(r.followUp, r);
        }
      }

      for (const r of dedupByDate.values()) {
        items.push({
          id: r.id,
          petId: pet.id,
          petName: pet.name,
          petSpecies: pet.species,
          petBreed: pet.breed || '',
          visitDate: r.date || '',
          followUpDate: r.followUp,
          vet: r.vet || '',
          diagnosis: r.diagnosis || '',
          symptoms: r.symptoms || '',
          ownerName: contact.ownerName,
          ownerPhone: contact.ownerPhone,
          status: r.followUp < t ? 'overdue' : 'soon',
        });
      }
    }

    items.sort((a, b) => a.followUpDate.localeCompare(b.followUpDate));
    res.json(items);
  }),
);

// GET /meta
router.get('/meta', (_req, res) => {
  const t = todayString();
  const limit60 = addDaysTo(t, 60);
  const settings = getSettings();
  const activeVets = listStaff('veterinarian');

  const onDutyByDate = {};
  for (let i = 0; i < 14; i += 1) {
    const dateKey = addDaysTo(t, i);
    onDutyByDate[dateKey] = vetsOnDuty(dateKey).map((v) => v.id);
  }

  res.json({
    BOOKING_SERVICES,
    WEEKDAY_HOURS,
    WEEKEND_HOURS,
    VET_NAMES: vetNames(),
    VETS: activeVets.map(({ id, name }) => ({ id, name })),
    SERVICES: listServices(),
    HOURS: settings.hours,
    onDutyByDate,
    closures: settings.closures.filter((c) => c.date >= t && c.date <= limit60),
    DURATIONS,
    CAUTION_FLAGS,
    NOTE_CATEGORIES,
    TRIAGE_LEVELS,
    REJECT_REASONS,
    VITAL_LIMITS,
  });
});

/* Errors from this module's routes become JSON responses. */
router.use((err, _req, res, _next) => {
  const status = err.status ?? 500;
  if (status >= 500) console.error('[medical-assistant]', err);
  res.status(status).json({ error: status >= 500 ? 'เกิดข้อผิดพลาดของเซิร์ฟเวอร์' : err.message });
});

export default router;
