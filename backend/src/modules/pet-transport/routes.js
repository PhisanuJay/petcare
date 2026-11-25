import { Router } from 'express';
<<<<<<< Updated upstream

/**
 * Pet Transport API module
 * Owner: โมเดล
 * Placeholder routes — implement later.
 */
const router = Router();

router.get('/', (_req, res) => {
  res.json({ module: 'pet-transport', owner: 'โมเดล', status: 'placeholder' });
});

router.get('/assigned-jobs', (_req, res) => {
  res.json({ module: 'pet-transport', page: 'assigned-jobs', status: 'placeholder' });
});

router.get('/job-detail', (_req, res) => {
  res.json({ module: 'pet-transport', page: 'job-detail', status: 'placeholder' });
});

router.get('/tracking', (_req, res) => {
  res.json({ module: 'pet-transport', page: 'tracking', status: 'placeholder' });
});

router.get('/history', (_req, res) => {
  res.json({ module: 'pet-transport', page: 'history', status: 'placeholder' });
});
=======
import { connectionLabel, openDatabase } from './db.js';
import { migrate } from './migrate.js';
import * as service from './service.js';
import { bearerToken, requireStaff } from '../auth/middleware.js';
import { findStaffById } from '../auth/staffAccounts.js';
import { sessionStaffId } from '../auth/sessions.js';

const router = Router();

let readyPromise = null;

export function ensurePetTransportReady() {
  if (!readyPromise) {
    readyPromise = (async () => {
      const label = await openDatabase();
      await migrate();
      return label;
    })();
  }
  return readyPromise;
}

function ok(res, payload) {
  res.json(payload);
}

function fail(res, error, status = 400) {
  res.status(status).json({ error: error.message || String(error) });
}

async function handle(res, fn, status = 400) {
  try {
    await ensurePetTransportReady();
    ok(res, await fn());
  } catch (error) {
    fail(res, error, error.status || status);
  }
}

router.get('/', async (_req, res) => {
  try {
    const label = await ensurePetTransportReady();
    ok(res, { module: 'pet-transport', owner: 'โมเดล', status: 'ready', db: label });
  } catch (error) {
    fail(res, error, 500);
  }
});

router.get('/state', (req, res) => handle(res, async () => {
  const token = bearerToken(req);
  const staff = token ? findStaffById(sessionStaffId(token)) : null;
  if (token && !staff) {
    const err = new Error('กรุณาเข้าสู่ระบบพนักงานใหม่');
    err.status = 401;
    throw err;
  }
  return service.getState({ includePaymentDetails: staff?.role === 'accountant' });
}, 500));

router.get('/pricing', (_req, res) => handle(res, () => service.getPricing(), 500));

router.post('/bookings', (req, res) => handle(res, () => service.createBooking(req.body || {})));

router.post('/bookings/:id/confirm-price', (req, res) =>
  handle(res, () => service.confirmPrice(req.params.id, req.body || {})));

router.post('/bookings/:id/other-service', (req, res) =>
  handle(res, () => service.setBookingOtherService(req.params.id, req.body || {})));

router.post('/bookings/:id/owner-confirm-payment', (req, res) =>
  handle(res, () => service.ownerConfirmPayment(req.params.id, req.body?.slip || '')));

router.post('/bookings/:id/approve-payment', requireStaff('accountant'), (req, res) =>
  handle(res, () => service.approveTransportPayment(req.params.id)));

router.post('/bookings/:id/reject-payment', requireStaff('accountant'), (req, res) =>
  handle(res, () => service.rejectTransportPayment(req.params.id, req.body?.note || '')));

router.post('/bookings/:id/request-cancel', (req, res) =>
  handle(res, () => service.requestCancel(
    req.params.id,
    req.body?.ownerId,
    req.body?.cancellationId,
    req.body?.reason || '',
  )));

router.post('/bookings/:id/resolve-cancel', (req, res) =>
  handle(res, () => service.resolveCancel(
    req.params.id,
    req.body?.cancellationId,
    Boolean(req.body?.approve),
    req.body?.adminNote || '',
  )));

router.post('/trips/:id/assign-driver', (req, res) =>
  handle(res, () => service.assignDriver(req.params.id, req.body?.driverId, req.body?.driverLabel || '')));

router.post('/trips/:id/schedule', (req, res) =>
  handle(res, () => service.updateTripSchedule(req.params.id, req.body || {})));

router.post('/trips/:id/advance-status', (req, res) =>
  handle(res, () => service.advanceTripStatus(req.params.id, req.body?.note || '')));

router.post('/trips/:id/evidence', (req, res) =>
  handle(res, () => service.attachEvidence(req.params.id, req.body?.kind, req.body?.dataUrl)));

router.post('/issues', (req, res) => handle(res, () => service.reportIssue(req.body || {})));

router.get('/notifications', (req, res) =>
  handle(res, async () => ({ notifications: await service.notificationsForDriver(req.query.driverId || null) }), 500));

router.post('/notifications/:id/read', (req, res) =>
  handle(res, () => service.markNotificationRead(req.params.id)));

router.post('/notifications/read-all', (req, res) =>
  handle(res, () => service.markAllNotificationsRead(req.body?.driverId)));

router.post('/notifications/ensure-upcoming', (req, res) =>
  handle(res, () => service.ensureUpcomingReminders(req.body?.driverId)));

router.put('/zones', (req, res) =>
  handle(res, () => service.updateZones(req.body?.zones || req.body || [])));

router.put('/hotel-room-prices', (req, res) =>
  handle(res, () => service.updateHotelRoomPrices(req.body?.rooms)));
>>>>>>> Stashed changes

export default router;
