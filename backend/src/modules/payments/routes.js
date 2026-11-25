import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { getDb } from '../../db/sqlite.js';
import { requireStaff } from '../auth/middleware.js';

const router = Router();
const KINDS = new Set(['hotel', 'transport', 'clinic']);
const OPEN_CANCELLATION_STATUSES = ['pending_admin', 'awaiting_refund'];

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function initialize() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      ref_id TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      data TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS payments_owner_idx ON payments(owner_id, created_at);
    CREATE INDEX IF NOT EXISTS payments_status_idx ON payments(status, created_at);
    CREATE TABLE IF NOT EXISTS cancellations (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      ref_id TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      data TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS cancellations_owner_idx ON cancellations(owner_id, created_at);
    CREATE INDEX IF NOT EXISTS cancellations_status_idx ON cancellations(status, created_at);
    CREATE TABLE IF NOT EXISTS payment_legacy_imports (
      owner_id TEXT PRIMARY KEY,
      imported_at TEXT NOT NULL
    );
  `);
}

initialize();

function parseRecord(row) {
  return JSON.parse(row.data);
}

function loadPayments(ownerId) {
  return getDb()
    .prepare('SELECT data FROM payments WHERE owner_id = ? ORDER BY created_at DESC')
    .all(ownerId)
    .map(parseRecord);
}

function loadCancellations(ownerId) {
  return getDb()
    .prepare('SELECT data FROM cancellations WHERE owner_id = ? ORDER BY created_at DESC')
    .all(ownerId)
    .map(parseRecord);
}

function savePayment(payment) {
  getDb().prepare(`
    INSERT INTO payments (id, owner_id, kind, ref_id, status, created_at, data)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      data = excluded.data
  `).run(
    payment.id,
    payment.ownerId,
    payment.kind,
    payment.refId,
    payment.status,
    payment.createdAt || new Date().toISOString(),
    JSON.stringify(payment),
  );
}

function saveCancellation(request) {
  getDb().prepare(`
    INSERT INTO cancellations (id, owner_id, kind, ref_id, status, created_at, data)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      data = excluded.data
  `).run(
    request.id,
    request.ownerId,
    request.kind,
    request.refId,
    request.status,
    request.createdAt || new Date().toISOString(),
    JSON.stringify(request),
  );
}

function findPayment(id) {
  const row = getDb().prepare('SELECT data FROM payments WHERE id = ?').get(id);
  return row ? parseRecord(row) : null;
}

function findCancellation(id) {
  const row = getDb().prepare('SELECT data FROM cancellations WHERE id = ?').get(id);
  return row ? parseRecord(row) : null;
}

function latestCancellation(kind, refId, ownerId) {
  const row = getDb().prepare(`
    SELECT data FROM cancellations
    WHERE kind = ? AND ref_id = ? AND owner_id = ?
    ORDER BY created_at DESC LIMIT 1
  `).get(kind, refId, ownerId);
  return row ? parseRecord(row) : null;
}

function validateRecordIdentity(body, ownerId) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw httpError(400, 'ข้อมูลไม่ถูกต้อง');
  if (!KINDS.has(body.kind)) throw httpError(400, 'ประเภทการจองไม่ถูกต้อง');
  if (typeof body.refId !== 'string' || !body.refId.trim()) throw httpError(400, 'ไม่พบข้อมูลการจอง');
  if (body.ownerId !== ownerId) throw httpError(403, 'ไม่สามารถแก้ไขรายการของเจ้าของอื่น');
}

function validateCancellation(input, ownerId) {
  validateRecordIdentity(input, ownerId);
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  const bankName = typeof input.bankName === 'string' ? input.bankName.trim() : '';
  const bankAccount = typeof input.bankAccount === 'string'
    ? input.bankAccount.replace(/[\s-]/g, '')
    : '';
  const contactPhone = typeof input.contactPhone === 'string'
    ? input.contactPhone.replace(/[\s-]/g, '')
    : '';
  if (reason.length < 3 || reason.length > 500) throw httpError(400, 'กรุณาระบุเหตุผล 3 ถึง 500 ตัวอักษร');
  if (!bankName) throw httpError(400, 'กรุณาเลือกธนาคาร');
  if (!/^\d{10,16}$/.test(bankAccount)) throw httpError(400, 'เลขบัญชีต้องเป็นตัวเลข 10 ถึง 16 หลัก');
  if (!/^0\d{8,9}$/.test(contactPhone)) throw httpError(400, 'เบอร์ติดต่อ 9 ถึง 10 หลักและขึ้นต้นด้วย 0');
  return { reason, bankName, bankAccount, contactPhone };
}

function httpOwner(req, _res, next) {
  const ownerId = req.get('x-owner-id');
  if (!ownerId || !ownerId.trim()) return next(httpError(401, 'กรุณาเข้าสู่ระบบ'));
  req.ownerId = ownerId.trim();
  next();
}

const wrap = (fn) => (req, res, next) => {
  try {
    const result = fn(req, res);
    if (result && typeof result.then === 'function') result.catch(next);
  } catch (error) {
    next(error);
  }
};

router.post('/import', httpOwner, wrap((req, res) => {
  const db = getDb();
  const done = db.prepare('SELECT 1 FROM payment_legacy_imports WHERE owner_id = ?').get(req.ownerId);
  if (done) return res.json({ imported: false });

  const payments = Array.isArray(req.body?.payments) ? req.body.payments : [];
  const cancellations = Array.isArray(req.body?.cancellations) ? req.body.cancellations : [];
  db.exec('BEGIN IMMEDIATE');
  try {
    const addPayment = db.prepare(`
      INSERT OR IGNORE INTO payments (id, owner_id, kind, ref_id, status, created_at, data)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const payment of payments) {
      if (
        payment?.ownerId !== req.ownerId
        || typeof payment.id !== 'string'
        || !payment.id
        || !KINDS.has(payment.kind)
        || typeof payment.refId !== 'string'
      ) continue;
      addPayment.run(
        payment.id,
        req.ownerId,
        payment.kind,
        payment.refId,
        String(payment.status || 'awaiting_slip'),
        String(payment.createdAt || new Date().toISOString()),
        JSON.stringify(payment),
      );
    }

    const addCancellation = db.prepare(`
      INSERT OR IGNORE INTO cancellations (id, owner_id, kind, ref_id, status, created_at, data)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const request of cancellations) {
      if (
        request?.ownerId !== req.ownerId
        || typeof request.id !== 'string'
        || !request.id
        || !KINDS.has(request.kind)
        || typeof request.refId !== 'string'
      ) continue;
      addCancellation.run(
        request.id,
        req.ownerId,
        request.kind,
        request.refId,
        String(request.status || 'pending_admin'),
        String(request.createdAt || new Date().toISOString()),
        JSON.stringify(request),
      );
    }
    db.prepare('INSERT INTO payment_legacy_imports (owner_id, imported_at) VALUES (?, ?)')
      .run(req.ownerId, new Date().toISOString());
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  res.json({ imported: true });
}));

router.get('/', httpOwner, wrap((req, res) => res.json(loadPayments(req.ownerId))));

router.post('/', httpOwner, wrap((req, res) => {
  const body = req.body;
  validateRecordIdentity(body, req.ownerId);
  const total = Number(body.total);
  const payment = {
    ...body,
    id: typeof body.id === 'string' && body.id ? body.id : randomUUID(),
    total: Number.isFinite(total) ? total : null,
    ownerId: req.ownerId,
    status: 'awaiting_slip',
    slip: '',
    note: '',
    createdAt: body.createdAt || new Date().toISOString(),
    submittedAt: '',
    reviewedAt: '',
  };
  if (findPayment(payment.id)) throw httpError(409, 'รายการชำระเงินนี้มีอยู่แล้ว');
  savePayment(payment);
  res.status(201).json(payment);
}));

router.post('/:id/slip', httpOwner, wrap((req, res) => {
  const payment = findPayment(req.params.id);
  if (!payment || payment.ownerId !== req.ownerId) throw httpError(404, 'ไม่พบรายการชำระเงิน');
  const cancellation = latestCancellation(payment.kind, payment.refId, req.ownerId);
  if (cancellation && cancellation.status !== 'rejected') {
    throw httpError(409, 'รายการนี้มีคำขอยกเลิกที่กำลังดำเนินการ ไม่สามารถส่งสลิปได้');
  }
  if (payment.status === 'cancelled') throw httpError(409, 'รายการชำระเงินนี้ถูกยกเลิกแล้ว');
  if (payment.status === 'approved') throw httpError(409, 'รายการนี้อนุมัติแล้ว');
  if (typeof req.body?.slip !== 'string' || !req.body.slip) throw httpError(400, 'กรุณาแนบสลิป');
  const updated = {
    ...payment,
    slip: req.body.slip,
    status: 'pending_review',
    note: '',
    submittedAt: new Date().toISOString(),
  };
  savePayment(updated);
  res.json(updated);
}));

router.get('/cancellations', httpOwner, wrap((req, res) => res.json(loadCancellations(req.ownerId))));

router.post('/cancellations', httpOwner, wrap((req, res) => {
  const input = req.body;
  const clean = validateCancellation(input, req.ownerId);
  const open = getDb().prepare(`
    SELECT 1 FROM cancellations
    WHERE owner_id = ? AND kind = ? AND ref_id = ? AND status IN (?, ?)
    LIMIT 1
  `).get(req.ownerId, input.kind, input.refId, ...OPEN_CANCELLATION_STATUSES);
  if (open) throw httpError(409, 'รายการนี้มีคำขอยกเลิกที่กำลังดำเนินการอยู่');

  const request = {
    ...input,
    ...clean,
    id: typeof input.id === 'string' && input.id ? input.id : randomUUID(),
    status: 'pending_admin',
    createdAt: input.createdAt || new Date().toISOString(),
    adminNote: '',
    refundAmount: null,
    refundReceipt: '',
    accountantNote: '',
  };
  if (findCancellation(request.id)) throw httpError(409, 'คำขอนี้มีอยู่แล้ว');
  saveCancellation(request);
  res.status(201).json(request);
}));

router.delete('/cancellations/:id', httpOwner, wrap((req, res) => {
  const request = findCancellation(req.params.id);
  if (!request || request.ownerId !== req.ownerId) throw httpError(404, 'ไม่พบคำขอยกเลิก');
  if (request.status !== 'pending_admin') throw httpError(409, 'คำขอนี้ไม่สามารถยกเลิกได้แล้ว');
  getDb().prepare('DELETE FROM cancellations WHERE id = ? AND owner_id = ?').run(request.id, req.ownerId);
  res.json({ ok: true });
}));

router.get('/staff/payments', requireStaff('accountant'), wrap((_req, res) => {
  res.json(getDb().prepare('SELECT data FROM payments ORDER BY created_at DESC').all().map(parseRecord));
}));

router.get('/staff/admin-payments', requireStaff('clinic_admin'), wrap((_req, res) => {
  res.json(getDb().prepare('SELECT data FROM payments ORDER BY created_at DESC').all().map(parseRecord));
}));

router.post('/staff/payments/:id/review', requireStaff('accountant'), wrap((req, res) => {
  const payment = findPayment(req.params.id);
  if (!payment) throw httpError(404, 'ไม่พบรายการชำระเงิน');
  if (payment.status !== 'pending_review') throw httpError(409, 'รายการนี้ไม่ได้อยู่ระหว่างตรวจสลิป');
  const decision = req.body?.decision;
  if (!['approved', 'rejected'].includes(decision)) throw httpError(400, 'คำตัดสินไม่ถูกต้อง');
  const cancellation = latestCancellation(payment.kind, payment.refId, payment.ownerId);
  if (
    cancellation
    && cancellation.status !== 'pending_admin'
    && cancellation.status !== 'rejected'
  ) throw httpError(409, 'รายการนี้ยกเลิกแล้ว ไม่สามารถอนุมัติสลิปได้');
  const updated = {
    ...payment,
    status: decision,
    note: String(req.body?.note || '').trim().slice(0, 500),
    reviewedAt: new Date().toISOString(),
  };
  savePayment(updated);
  res.json(updated);
}));

router.post('/staff/payments/:id/cancel', requireStaff('clinic_admin'), wrap((req, res) => {
  const payment = findPayment(req.params.id);
  if (!payment) throw httpError(404, 'ไม่พบรายการชำระเงิน');
  if (['approved', 'cancelled'].includes(payment.status)) return res.json(payment);
  const updated = {
    ...payment,
    status: 'cancelled',
    note: 'ยกเลิกตามคำขอยกเลิกที่แอดมินอนุมัติ',
    reviewedAt: new Date().toISOString(),
  };
  savePayment(updated);
  res.json(updated);
}));

router.get('/staff/cancellations', requireStaff('clinic_admin'), wrap((_req, res) => {
  res.json(getDb().prepare('SELECT data FROM cancellations ORDER BY created_at DESC').all().map(parseRecord));
}));

router.post('/staff/cancellations/:id/decision', requireStaff('clinic_admin'), wrap((req, res) => {
  const request = findCancellation(req.params.id);
  if (!request || request.status !== 'pending_admin') {
    throw httpError(409, 'คำขอนี้ไม่อยู่ในสถานะรอแอดมินพิจารณา');
  }
  const approve = Boolean(req.body?.approve);
  const now = new Date().toISOString();
  const updated = {
    ...request,
    status: approve ? 'awaiting_refund' : 'rejected',
    adminNote: String(req.body?.adminNote || '').trim().slice(0, 500),
    refundAmount: approve ? Math.max(0, Number(req.body?.refundAmount) || 0) : null,
    resolvedAt: now,
    approvedAt: approve ? now : '',
  };
  saveCancellation(updated);
  res.json(updated);
}));

router.get('/staff/refunds', requireStaff('accountant'), wrap((_req, res) => {
  res.json(getDb().prepare(
    'SELECT data FROM cancellations ORDER BY created_at DESC',
  ).all().map(parseRecord));
}));

router.post('/staff/refunds/:id/complete', requireStaff('accountant'), wrap((req, res) => {
  const request = findCancellation(req.params.id);
  if (!request || request.status !== 'awaiting_refund') {
    throw httpError(409, 'คำขอนี้ไม่อยู่ในคิวคืนเงิน');
  }
  const refundAmount = Number(request.refundAmount) || 0;
  const receipt = typeof req.body?.receipt === 'string' ? req.body.receipt : '';
  if (refundAmount > 0 && !/^data:image\/(?:jpeg|png|webp);base64,/.test(receipt)) {
    throw httpError(400, 'กรุณาแนบรูปหลักฐานการโอนคืน');
  }
  const updated = {
    ...request,
    status: refundAmount > 0 ? 'refunded' : 'no_refund',
    refundReceipt: refundAmount > 0 ? receipt : '',
    accountantNote: String(req.body?.accountantNote || '').trim().slice(0, 500),
    refundedAt: new Date().toISOString(),
  };
  saveCancellation(updated);
  res.json(updated);
}));

router.use((err, _req, res, _next) => {
  const status = err.status ?? 500;
  if (status >= 500) console.error('[payments]', err);
  res.status(status).json({ error: status >= 500 ? 'เกิดข้อผิดพลาดของเซิร์ฟเวอร์' : err.message });
});

export default router;
