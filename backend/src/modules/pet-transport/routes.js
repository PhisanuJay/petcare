import { Router } from 'express';
import { openDatabase } from './db.js';
import { migrate } from './migrate.js';
import * as service from './service.js';
import { bearerToken, requireStaff } from '../auth/middleware.js';
import { findStaffById } from '../auth/staffAccounts.js';
import { sessionStaffId } from '../auth/sessions.js';

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

router.get('/state', (req, res) => {
  try {
    const token = bearerToken(req);
    const staff = token ? findStaffById(sessionStaffId(token)) : null;
    if (token && !staff) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบพนักงานใหม่' });
    ok(res, service.getState({ includePaymentDetails: staff?.role === 'accountant' }));
  } catch (error) {
    fail(res, error, 500);
  }
});

router.get('/pricing', (_req, res) => {
  try {
    ok(res, service.getPricing());
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
    ok(res, service.ownerConfirmPayment(req.params.id, req.body?.slip || ''));
  } catch (error) {
    fail(res, error);
  }
});

router.post('/bookings/:id/approve-payment', requireStaff('accountant'), (req, res) => {
  try {
    ok(res, service.approveTransportPayment(req.params.id));
  } catch (error) {
    fail(res, error);
  }
});

router.post('/bookings/:id/reject-payment', requireStaff('accountant'), (req, res) => {
  try {
    ok(res, service.rejectTransportPayment(req.params.id, req.body?.note || ''));
  } catch (error) {
    fail(res, error);
  }
});

router.post('/bookings/:id/request-cancel', (req, res) => {
  try {
    ok(res, service.requestCancel(
      req.params.id,
      req.body?.ownerId,
      req.body?.cancellationId,
      req.body?.reason || '',
    ));
  } catch (error) {
    fail(res, error);
  }
});

router.post('/bookings/:id/resolve-cancel', (req, res) => {
  try {
    ok(res, service.resolveCancel(
      req.params.id,
      req.body?.cancellationId,
      Boolean(req.body?.approve),
      req.body?.adminNote || '',
    ));
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

router.put('/hotel-room-prices', (req, res) => {
  try {
    ok(res, service.updateHotelRoomPrices(req.body?.rooms));
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
});

export default router;
