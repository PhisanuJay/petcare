import { Router } from 'express';
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
});

export default router;
