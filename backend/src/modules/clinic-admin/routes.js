import { Router } from 'express';
import { requireStaff } from '../auth/middleware.js';
import {
  createStaff,
  findStaffAnyById,
  listAllStaff,
  listStaff,
  setStaffPassword,
  updateStaff,
} from '../auth/staffAccounts.js';
import { listVisits } from '../medical-assistant/visitStore.js';
import { listAllBookings } from '../pet-owner/bookingStore.js';
import { isDateString, todayString } from '../pet-owner/clinicSchedule.js';
import { httpError } from '../pet-owner/jsonCollection.js';
import {
  addClosure,
  createService,
  getClosure,
  getHoursForDay,
  getSettings,
  listBookableServices,
  listServices,
  removeClosure,
  updateHours,
  updateService,
  updateServices,
} from './clinicSettings.js';
import { buildReport } from './reports.js';
import { addLeave, getRoster, isVetOnDuty, removeLeave, setWeekdays, vetsOnDuty } from './rosterStore.js';
import { availableOnlineSlots } from '../pet-owner/onlineSlots.js';

/**
 * Clinic Admin API module (`clinic_admin`)
 * Owner: เอิร์ท
 */
const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

function addDaysTo(dateString, days) {
  const ms = Date.parse(`${dateString}T00:00:00Z`) + days * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

function dayOfWeek(dateString) {
  const [y, m, d] = dateString.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

function countBookingsOnDate(bookings, date) {
  return bookings.filter(
    (b) => b.date === date && ['pending', 'confirmed'].includes(b.status),
  ).length;
}

/* ---------- Public Clinic Info (No login required) ---------- */

router.get('/public/clinic-info', (_req, res) => {
  const t = todayString();
  const limit90 = addDaysTo(t, 90);
  const settings = getSettings();
  res.json({
    hours: settings.hours,
    services: listBookableServices(),
    vets: listStaff('veterinarian').map(({ id, name }) => ({ id, name })),
    closures: settings.closures.filter((c) => c.date >= t && c.date <= limit90),
    slotMinutes: settings.slotMinutes ?? 60,
    lunchBreak: settings.lunchBreak ?? { start: '12:00', end: '13:00' },
    vetRosterEnabled: true,
  });
});

router.get('/public/clinic-slots', async (req, res, next) => {
  try {
    const date = typeof req.query.date === 'string' ? req.query.date.trim() : '';
    const vetId = typeof req.query.vetId === 'string' ? req.query.vetId.trim() : '';
    if (!isDateString(date)) {
      return res.status(400).json({ error: 'กรุณาระบุวันที่ YYYY-MM-DD' });
    }
    res.json(await availableOnlineSlots(date, vetId));
  } catch (err) {
    next(err);
  }
});

router.get('/public/clinic-availability', (req, res) => {
  const date = typeof req.query.date === 'string' ? req.query.date.trim() : '';
  if (!isDateString(date)) {
    return res.status(400).json({ error: 'กรุณาระบุวันที่ YYYY-MM-DD' });
  }
  const closure = getClosure(date);
  if (closure) {
    return res.json({
      date,
      bookable: false,
      reason: `คลินิกปิดทำการ: ${closure.reason}`,
      vetsOnDuty: [],
    });
  }
  const day = dayOfWeek(date);
  if (getHoursForDay(day) === null) {
    return res.json({
      date,
      bookable: false,
      reason: 'คลินิกปิดทำการวันนี้',
      vetsOnDuty: [],
    });
  }
  // ใช้รายชื่อหมอทั้งหมดที่เปิดใช้ — ตารางเวรถูก seed ครบแล้ว
  const vets = (vetsOnDuty(date).length
    ? vetsOnDuty(date)
    : listStaff('veterinarian')
  ).map(({ id, name }) => ({ id, name }));
  if (!vets.length) {
    return res.json({
      date,
      bookable: false,
      reason: 'วันนี้ไม่มีสัตวแพทย์เข้าเวร',
      vetsOnDuty: [],
    });
  }
  return res.json({ date, bookable: true, reason: null, vetsOnDuty: vets });
});

/* ---------- Protected Admin Routes ---------- */

router.use(requireStaff('clinic_admin'));

/* Staff Management */

router.get(
  '/staff',
  wrap(async (_req, res) => {
    const t = todayString();
    const [staffList, bookings, visits] = await Promise.all([
      listAllStaff(),
      listAllBookings(),
      listVisits(),
    ]);
    const visitsMap = new Map(visits.map((v) => [v.bookingId, v]));

    const result = staffList.map((member) => {
      if (member.role !== 'veterinarian') return member;
      const pendingAssignments = bookings.filter((b) => {
        if (!['pending', 'confirmed'].includes(b.status) || b.date < t) return false;
        const v = visitsMap.get(b.id);
        if (!v) return false;
        if (v.vetId) return v.vetId === member.id;
        return v.vet === member.name;
      }).length;
      return { ...member, pendingAssignments };
    });

    res.json(result);
  }),
);

router.post(
  '/staff',
  wrap(async (req, res) => {
    const created = await createStaff(req.body ?? {});
    res.status(201).json(created);
  }),
);

router.patch(
  '/staff/:id',
  wrap(async (req, res) => {
    const body = req.body ?? {};
    if (req.params.id === req.staff.id && body.active === false) {
      throw httpError(409, 'ไม่สามารถปิดบัญชีของตัวเองได้');
    }
    res.json(await updateStaff(req.params.id, body));
  }),
);

router.post(
  '/staff/:id/password',
  wrap(async (req, res) => {
    res.json(await setStaffPassword(req.params.id, req.body?.password));
  }),
);

/* Clinic Settings */

router.get('/settings', (_req, res) => {
  res.json({
    ...getSettings(),
    services: listServices(),
  });
});

router.put(
  '/settings/hours',
  wrap(async (req, res) => {
    const nextHours = req.body?.hours ?? req.body;
    res.json(await updateHours(nextHours));
  }),
);

router.put(
  '/settings/services',
  wrap(async (req, res) => {
    const patch = req.body?.services ?? req.body;
    res.json(await updateServices(patch));
  }),
);

router.get('/services', (_req, res) => {
  res.json({ services: listServices() });
});

router.post(
  '/services',
  wrap(async (req, res) => {
    res.status(201).json(await createService(req.body ?? {}));
  }),
);

router.patch(
  '/services/:code',
  wrap(async (req, res) => {
    res.json(await updateService(req.params.code, req.body ?? {}));
  }),
);

/* Clinic Closures */

router.get(
  '/closures',
  wrap(async (_req, res) => {
    const t = todayString();
    const [settings, bookings] = await Promise.all([
      Promise.resolve(getSettings()),
      listAllBookings(),
    ]);
    const list = settings.closures
      .filter((c) => c.date >= t)
      .map((c) => ({
        ...c,
        affectedBookings: countBookingsOnDate(bookings, c.date),
      }));
    res.json(list);
  }),
);

router.post(
  '/closures',
  wrap(async (req, res) => {
    const created = await addClosure(req.body ?? {});
    const bookings = await listAllBookings();
    res.status(201).json({
      ...created,
      affectedBookings: countBookingsOnDate(bookings, created.date),
    });
  }),
);

router.delete(
  '/closures/:date',
  wrap(async (req, res) => {
    res.json(await removeClosure(req.params.date));
  }),
);

/* Vet Roster */

router.get('/roster', (_req, res) => {
  const t = todayString();
  const isClinicClosedToday = Boolean(getClosure(t)) || getHoursForDay(dayOfWeek(t)) === null;
  const vets = listStaff('veterinarian').map((vet) => {
    const r = getRoster(vet.id);
    return {
      ...vet,
      weekdays: r?.weekdays ?? [0, 1, 2, 3, 4, 5, 6],
      leaves: r?.leaves ?? [],
      onDutyToday: !isClinicClosedToday && isVetOnDuty(vet.id, t),
    };
  });
  res.json(vets);
});

router.put(
  '/roster/:staffId/weekdays',
  wrap(async (req, res) => {
    res.json(await setWeekdays(req.params.staffId, req.body?.weekdays));
  }),
);

router.post(
  '/roster/:staffId/leaves',
  wrap(async (req, res) => {
    const leave = await addLeave(req.params.staffId, req.body ?? {});
    const vetStaff = findStaffAnyById(req.params.staffId);
    const [bookings, visits] = await Promise.all([listAllBookings(), listVisits()]);
    const visitsMap = new Map(visits.map((v) => [v.bookingId, v]));

    const affectedBookings = bookings.filter((b) => {
      if (b.status !== 'confirmed') return false;
      if (b.date < leave.from || b.date > leave.to) return false;
      const v = visitsMap.get(b.id);
      if (!v) return false;
      if (v.vetId) return v.vetId === req.params.staffId;
      return vetStaff && v.vet === vetStaff.name;
    }).length;

    res.status(201).json({ ...leave, affectedBookings });
  }),
);

router.delete(
  '/roster/:staffId/leaves/:leaveId',
  wrap(async (req, res) => {
    res.json(await removeLeave(req.params.staffId, req.params.leaveId));
  }),
);

/* Overview & Reports */

router.get(
  '/overview',
  wrap(async (_req, res) => {
    const t = todayString();
    const limit3 = addDaysTo(t, 3);
    const [bookings, settings] = await Promise.all([
      listAllBookings(),
      Promise.resolve(getSettings()),
    ]);

    const todayBookings = bookings.filter((b) => b.date === t);
    const byStatus = {
      pending: 0,
      confirmed: 0,
      completed: 0,
      no_show: 0,
      rejected: 0,
      cancelled: 0,
    };
    for (const b of todayBookings) {
      byStatus[b.status] = (byStatus[b.status] ?? 0) + 1;
    }

    const upcomingClosures = settings.closures
      .filter((c) => c.date >= t && c.date <= limit3)
      .map((c) => ({
        ...c,
        affectedBookings: countBookingsOnDate(bookings, c.date),
      }));

    const bookableServices = listBookableServices();
    const activeVets = listStaff('veterinarian');
    const activeAssistants = listStaff('medical_assistant');

    res.json({
      date: t,
      todayTotal: todayBookings.length,
      byStatus,
      confirmedToday: byStatus.confirmed,
      completedToday: byStatus.completed,
      vetsOnDutyToday: vetsOnDuty(t).map(({ id, name }) => ({ id, name })),
      staffReady: {
        veterinarians: activeVets.length,
        assistants: activeAssistants.length,
        total: activeVets.length + activeAssistants.length,
      },
      onlineServices: bookableServices.length,
      upcomingClosures,
    });
  }),
);

const MAX_REPORT_DAYS = 366;
const dayNumber = (dateString) => Math.round(Date.parse(`${dateString}T00:00:00Z`) / 86400000);

router.get(
  '/reports',
  wrap(async (req, res) => {
    const to = req.query.to ?? todayString();
    const from = req.query.from ?? addDaysTo(to, -29);
    if (!isDateString(from) || !isDateString(to)) throw httpError(400, 'วันที่ไม่ถูกต้อง');
    if (from > to) throw httpError(400, 'วันเริ่มต้นต้องไม่หลังวันสิ้นสุด');
    const days = dayNumber(to) - dayNumber(from) + 1;
    if (days > MAX_REPORT_DAYS) {
      throw httpError(400, `เลือกช่วงเวลาได้ไม่เกิน ${MAX_REPORT_DAYS} วัน`);
    }

    const [bookings, visits, staff] = await Promise.all([
      listAllBookings(),
      listVisits(),
      listAllStaff(),
    ]);

    res.json(buildReport({ bookings, visits, staff, from, to }));
  }),
);

/* Errors from this module's routes become JSON responses. */
router.use((err, _req, res, _next) => {
  const status = err.status ?? 500;
  if (status >= 500) console.error('[clinic-admin]', err);
  res.status(status).json({ error: status >= 500 ? 'เกิดข้อผิดพลาดของเซิร์ฟเวอร์' : err.message });
});

export default router;
