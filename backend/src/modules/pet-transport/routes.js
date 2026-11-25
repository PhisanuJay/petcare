import { Router } from 'express';
<<<<<<< HEAD
import { openDatabase } from './db.js';
import { migrate } from './migrate.js';
import * as service from './service.js';

openDatabase();
migrate();

const router = Router();

function ok(res, payload) {
  res.json(payload);
}

function fail(res, error, status = 400) {
  res.status(status).json({ error: error.message || String(error) });
}

router.get('/', (_req, res) => {
  ok(res, { module: 'pet-transport', owner: 'โมเดล', status: 'ready', db: true });
});

router.get('/state', (_req, res) => {
  try {
    ok(res, service.getState());
  } catch (error) {
    fail(res, error, 500);
  }
});

router.post('/bookings', (req, res) => {
  try {
    ok(res, service.createBooking(req.body || {}));
  } catch (error) {
    fail(res, error);
  }
});

router.post('/bookings/:id/confirm-price', (req, res) => {
  try {
    ok(res, service.confirmPrice(req.params.id, req.body || {}));
  } catch (error) {
    fail(res, error);
  }
});

router.post('/bookings/:id/other-service', (req, res) => {
  try {
    ok(res, service.setBookingOtherService(req.params.id, req.body || {}));
  } catch (error) {
    fail(res, error);
  }
});

router.post('/bookings/:id/owner-confirm-payment', (req, res) => {
  try {
    ok(res, service.ownerConfirmPayment(req.params.id, req.body?.note || ''));
  } catch (error) {
    fail(res, error);
  }
});

router.post('/bookings/:id/admin-mark-paid', (req, res) => {
  try {
    ok(res, service.adminMarkPaid(req.params.id));
  } catch (error) {
    fail(res, error);
  }
});

router.post('/bookings/:id/request-cancel', (req, res) => {
  try {
    ok(res, service.requestCancel(req.params.id, req.body?.reason || ''));
  } catch (error) {
    fail(res, error);
  }
});

router.post('/bookings/:id/resolve-cancel', (req, res) => {
  try {
    ok(res, service.resolveCancel(req.params.id, Boolean(req.body?.approve), req.body?.adminNote || ''));
  } catch (error) {
    fail(res, error);
  }
});

router.post('/trips/:id/assign-driver', (req, res) => {
  try {
    ok(res, service.assignDriver(req.params.id, req.body?.driverId, req.body?.driverLabel || ''));
  } catch (error) {
    fail(res, error);
  }
});

router.post('/trips/:id/schedule', (req, res) => {
  try {
    ok(res, service.updateTripSchedule(req.params.id, req.body || {}));
  } catch (error) {
    fail(res, error);
  }
});

router.post('/trips/:id/advance-status', (req, res) => {
  try {
    ok(res, service.advanceTripStatus(req.params.id, req.body?.note || ''));
  } catch (error) {
    fail(res, error);
  }
});

router.post('/trips/:id/evidence', (req, res) => {
  try {
    ok(res, service.attachEvidence(req.params.id, req.body?.kind, req.body?.dataUrl));
  } catch (error) {
    fail(res, error);
  }
});

router.post('/issues', (req, res) => {
  try {
    ok(res, service.reportIssue(req.body || {}));
  } catch (error) {
    fail(res, error);
  }
});

router.get('/notifications', (req, res) => {
  try {
    ok(res, { notifications: service.notificationsForDriver(req.query.driverId || null) });
  } catch (error) {
    fail(res, error, 500);
  }
});

router.post('/notifications/:id/read', (req, res) => {
  try {
    ok(res, service.markNotificationRead(req.params.id));
  } catch (error) {
    fail(res, error);
  }
});

router.post('/notifications/read-all', (req, res) => {
  try {
    ok(res, service.markAllNotificationsRead(req.body?.driverId));
  } catch (error) {
    fail(res, error);
  }
});

router.post('/notifications/ensure-upcoming', (req, res) => {
  try {
    ok(res, service.ensureUpcomingReminders(req.body?.driverId));
  } catch (error) {
    fail(res, error);
  }
});

router.put('/zones', (req, res) => {
  try {
    ok(res, service.updateZones(req.body?.zones || req.body || []));
  } catch (error) {
    fail(res, error);
  }
});

router.post('/hotels', (req, res) => {
  try {
    ok(res, service.addHotel(req.body || {}));
  } catch (error) {
    fail(res, error);
  }
});

router.delete('/hotels/:id', (req, res) => {
  try {
    ok(res, service.removeHotel(req.params.id));
  } catch (error) {
    fail(res, error);
  }
});

router.post('/reset-demo', (_req, res) => {
  try {
    ok(res, service.resetDemo());
  } catch (error) {
    fail(res, error, 500);
  }
});

router.post('/purge-demo-jobs', (_req, res) => {
  try {
    ok(res, service.purgeDemoDriverJobs());
  } catch (error) {
    fail(res, error, 500);
  }
=======
import * as transport from './service.js';
import { initTransportDb } from './db.js';
import { quotePrice } from './pricing.js';
import { SERVICE_SUBDISTRICTS } from './constants.js';

/**
 * Pet Transport API — SQLite-backed
 * Base: /api/pet-transport
 */
const router = Router();

initTransportDb();

function handle(res, fn) {
  try {
    const data = fn();
    res.json({ ok: true, data });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message || 'เกิดข้อผิดพลาด' });
  }
}

router.get('/', (_req, res) => {
  handle(res, () => ({
    module: 'pet-transport',
    storage: 'sqlite',
    ...transport.getCatalog(),
  }));
});

router.get('/snapshot', (_req, res) => {
  handle(res, () => transport.getSnapshot());
});

router.get('/catalog', (_req, res) => {
  handle(res, () => ({
    ...transport.getCatalog(),
    subdistricts: SERVICE_SUBDISTRICTS,
  }));
});

router.post('/quote', (req, res) => {
  handle(res, () => {
    const catalog = transport.getCatalog();
    return quotePrice({ ...req.body, zones: catalog.zones });
  });
});

router.get('/bookings', (_req, res) => {
  handle(res, () => transport.listBookings());
});

router.get('/bookings/:bookingId', (req, res) => {
  handle(res, () => {
    const booking = transport.getBooking(req.params.bookingId);
    if (!booking) throw new Error('ไม่พบการจอง');
    return booking;
  });
});

router.post('/bookings', (req, res) => {
  handle(res, () => transport.createBooking(req.body || {}));
});

router.post('/bookings/:bookingId/confirm-price', (req, res) => {
  handle(res, () => transport.confirmPrice(req.params.bookingId, req.body || {}));
});

router.post('/bookings/:bookingId/owner-confirm-payment', (req, res) => {
  handle(res, () => transport.ownerConfirmPayment(req.params.bookingId, req.body?.note || ''));
});

router.post('/bookings/:bookingId/mark-paid', (req, res) => {
  handle(res, () => transport.adminMarkPaid(req.params.bookingId));
});

router.post('/bookings/:bookingId/request-cancel', (req, res) => {
  handle(res, () => transport.requestCancel(req.params.bookingId, req.body?.reason || ''));
});

router.post('/bookings/:bookingId/resolve-cancel', (req, res) => {
  handle(res, () => transport.resolveCancel(
    req.params.bookingId,
    Boolean(req.body?.approve),
    req.body?.adminNote || '',
  ));
});

router.put('/zones', (req, res) => {
  handle(res, () => transport.updateZones(req.body?.zones || req.body || []));
});

router.post('/hotels', (req, res) => {
  handle(res, () => transport.addHotel(req.body || {}));
});

router.delete('/hotels/:hotelId', (req, res) => {
  handle(res, () => {
    transport.removeHotel(req.params.hotelId);
    return { deleted: true };
  });
});

router.get('/trips', (req, res) => {
  handle(res, () => transport.listTrips({
    bookingId: req.query.bookingId,
    driverId: req.query.driverId,
  }));
});

router.get('/trips/:tripId', (req, res) => {
  handle(res, () => {
    const trip = transport.getTrip(req.params.tripId);
    if (!trip) throw new Error('ไม่พบทริป');
    return trip;
  });
});

router.post('/trips/:tripId/assign-driver', (req, res) => {
  handle(res, () => {
    const { driverId, driverLabel } = req.body || {};
    if (!driverId) throw new Error('ต้องระบุ driverId');
    return transport.assignDriver(req.params.tripId, driverId, driverLabel || '');
  });
});

router.post('/trips/:tripId/advance', (req, res) => {
  handle(res, () => transport.advanceTripStatus(req.params.tripId, req.body?.note || ''));
});

router.patch('/trips/:tripId/schedule', (req, res) => {
  handle(res, () => transport.updateTripSchedule(req.params.tripId, req.body || {}));
});

router.post('/trips/:tripId/evidence', (req, res) => {
  handle(res, () => {
    const { kind, dataUrl } = req.body || {};
    if (!kind || !dataUrl) throw new Error('ต้องระบุ kind และ dataUrl');
    return transport.attachEvidence(req.params.tripId, kind, dataUrl);
  });
});

router.post('/trips/:tripId/issues', (req, res) => {
  handle(res, () => transport.reportIssue({
    tripId: req.params.tripId,
    driverId: req.body?.driverId,
    reasonId: req.body?.reasonId,
    message: req.body?.message,
  }));
});

router.get('/drivers/:driverId/notifications', (req, res) => {
  handle(res, () => transport.listNotifications(req.params.driverId));
});

router.post('/notifications/:notificationId/read', (req, res) => {
  handle(res, () => {
    transport.markNotificationRead(req.params.notificationId);
    return { read: true };
  });
});

router.post('/drivers/:driverId/notifications/read-all', (req, res) => {
  handle(res, () => {
    transport.markAllNotificationsRead(req.params.driverId);
    return { read: true };
  });
>>>>>>> origin/Admin-transport
});

export default router;
