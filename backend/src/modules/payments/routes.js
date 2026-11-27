import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { queryAll, queryOne, run, transaction } from '../../db/mssql.js';
import { requireStaff } from '../auth/middleware.js';
import { resolveCustomerIdentity } from '../auth/store.js';
import { ensurePetTransportReady } from '../pet-transport/routes.js';
import { approveTransportPayment, ownerConfirmPayment } from '../pet-transport/service.js';

const router = Router();
const KINDS = new Set(['hotel', 'transport', 'clinic', 'hub']);
const OPEN_CANCELLATION_STATUSES = ['pending_admin', 'awaiting_refund'];

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function parseRecord(row) {
  return JSON.parse(row.data);
}

async function loadPayments(ownerId) {
  const rows = await queryAll(
    'SELECT data FROM dbo.payments WHERE owner_id = ? ORDER BY created_at DESC',
    [ownerId],
  );
  return rows.map(parseRecord);
}

async function loadCancellations(ownerId) {
  const rows = await queryAll(
    'SELECT data FROM dbo.cancellations WHERE owner_id = ? ORDER BY created_at DESC',
    [ownerId],
  );
  return rows.map(parseRecord);
}

async function transportIdsFromPayment(payment) {
  const ids = new Set();
  if (payment.kind === 'transport' && payment.refId) ids.add(payment.refId);
  if (payment.kind === 'hub' && Array.isArray(payment.lines)) {
    for (const line of payment.lines) {
      if (line.kind === 'transport' && line.refId) ids.add(line.refId);
    }
  }
  return [...ids];
}

/** Instant pay: mark transport legs paid after slip (no accountant queue). */
async function applyPaymentApprovalEffects(payment, slip = '') {
  for (const bookingId of await transportIdsFromPayment(payment)) {
    try {
      if (slip) await ownerConfirmPayment(bookingId, slip);
      await approveTransportPayment(bookingId);
    } catch {
      /* booking may already be paid or not in payable state */
    }
  }
}

async function savePayment(payment) {
  await run(
    `MERGE dbo.payments AS t
     USING (SELECT ? AS id, ? AS owner_id, ? AS kind, ? AS ref_id, ? AS status, ? AS created_at, ? AS data) AS s
     ON t.id = s.id
     WHEN MATCHED THEN UPDATE SET status = s.status, data = s.data
     WHEN NOT MATCHED THEN INSERT (id, owner_id, kind, ref_id, status, created_at, data)
       VALUES (s.id, s.owner_id, s.kind, s.ref_id, s.status, s.created_at, s.data);`,
    [
      payment.id,
      payment.ownerId,
      payment.kind,
      payment.refId,
      payment.status,
      payment.createdAt || new Date().toISOString(),
      JSON.stringify(payment),
    ],
  );
}

async function saveCancellation(request) {
  await run(
    `MERGE dbo.cancellations AS t
     USING (SELECT ? AS id, ? AS owner_id, ? AS kind, ? AS ref_id, ? AS status, ? AS created_at, ? AS data) AS s
     ON t.id = s.id
     WHEN MATCHED THEN UPDATE SET status = s.status, data = s.data
     WHEN NOT MATCHED THEN INSERT (id, owner_id, kind, ref_id, status, created_at, data)
       VALUES (s.id, s.owner_id, s.kind, s.ref_id, s.status, s.created_at, s.data);`,
    [
      request.id,
      request.ownerId,
      request.kind,
      request.refId,
      request.status,
      request.createdAt || new Date().toISOString(),
      JSON.stringify(request),
    ],
  );
}

async function findPayment(id) {
  const row = await queryOne('SELECT data FROM dbo.payments WHERE id = ?', [id]);
  return row ? parseRecord(row) : null;
}

async function findCancellation(id) {
  const row = await queryOne('SELECT data FROM dbo.cancellations WHERE id = ?', [id]);
  return row ? parseRecord(row) : null;
}

async function latestCancellation(kind, refId, ownerId) {
  const row = await queryOne(
    `SELECT TOP 1 data FROM dbo.cancellations
     WHERE kind = ? AND ref_id = ? AND owner_id = ?
     ORDER BY created_at DESC`,
    [kind, refId, ownerId],
  );
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

async function httpOwner(req, _res, next) {
  try {
    const identity = await resolveCustomerIdentity(req);
    if (identity?.user?.id) {
      req.ownerId = identity.user.id;
      return next();
    }
    return next(httpError(401, 'กรุณาเข้าสู่ระบบ'));
  } catch (error) {
    return next(error);
  }
}

const wrap = (fn) => (req, res, next) => {
  Promise.resolve()
    .then(() => ensurePetTransportReady())
    .then(() => fn(req, res))
    .catch(next);
};

router.post('/import', httpOwner, wrap(async (req, res) => {
  const done = await queryOne(
    'SELECT 1 AS ok FROM dbo.payment_legacy_imports WHERE owner_id = ?',
    [req.ownerId],
  );
  if (done) return res.json({ imported: false });

  const payments = Array.isArray(req.body?.payments) ? req.body.payments : [];
  const cancellations = Array.isArray(req.body?.cancellations) ? req.body.cancellations : [];

  await transaction(async () => {
    for (const payment of payments) {
      if (
        payment?.ownerId !== req.ownerId
        || typeof payment.id !== 'string'
        || !payment.id
        || !KINDS.has(payment.kind)
        || typeof payment.refId !== 'string'
      ) continue;
      await run(
        `IF NOT EXISTS (SELECT 1 FROM dbo.payments WHERE id = ?)
           INSERT INTO dbo.payments (id, owner_id, kind, ref_id, status, created_at, data)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          payment.id,
          payment.id,
          req.ownerId,
          payment.kind,
          payment.refId,
          String(payment.status || 'awaiting_slip'),
          String(payment.createdAt || new Date().toISOString()),
          JSON.stringify(payment),
        ],
      );
    }

    for (const request of cancellations) {
      if (
        request?.ownerId !== req.ownerId
        || typeof request.id !== 'string'
        || !request.id
        || !KINDS.has(request.kind)
        || typeof request.refId !== 'string'
      ) continue;
      await run(
        `IF NOT EXISTS (SELECT 1 FROM dbo.cancellations WHERE id = ?)
           INSERT INTO dbo.cancellations (id, owner_id, kind, ref_id, status, created_at, data)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          request.id,
          request.id,
          req.ownerId,
          request.kind,
          request.refId,
          String(request.status || 'pending_admin'),
          String(request.createdAt || new Date().toISOString()),
          JSON.stringify(request),
        ],
      );
    }

    await run(
      'INSERT INTO dbo.payment_legacy_imports (owner_id, imported_at) VALUES (?, ?)',
      [req.ownerId, new Date().toISOString()],
    );
  });

  res.json({ imported: true });
}));

router.get('/', httpOwner, wrap(async (req, res) => res.json(await loadPayments(req.ownerId))));

router.post('/', httpOwner, wrap(async (req, res) => {
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
  if (await findPayment(payment.id)) throw httpError(409, 'รายการชำระเงินนี้มีอยู่แล้ว');
  await savePayment(payment);
  res.status(201).json(payment);
}));

router.post('/:id/slip', httpOwner, wrap(async (req, res) => {
  const payment = await findPayment(req.params.id);
  if (!payment || payment.ownerId !== req.ownerId) throw httpError(404, 'ไม่พบรายการชำระเงิน');
  const cancellation = await latestCancellation(payment.kind, payment.refId, req.ownerId);
  if (cancellation && cancellation.status !== 'rejected') {
    throw httpError(409, 'รายการนี้มีคำขอยกเลิกที่กำลังดำเนินการ ไม่สามารถส่งสลิปได้');
  }
  if (payment.status === 'cancelled') throw httpError(409, 'รายการชำระเงินนี้ถูกยกเลิกแล้ว');
  if (payment.status === 'approved') throw httpError(409, 'รายการนี้อนุมัติแล้ว');
  if (typeof req.body?.slip !== 'string' || !req.body.slip) throw httpError(400, 'กรุณาแนบสลิป');
  const now = new Date().toISOString();
  const updated = {
    ...payment,
    slip: req.body.slip,
    status: 'approved',
    note: '',
    submittedAt: now,
    reviewedAt: now,
  };
  await savePayment(updated);
  await applyPaymentApprovalEffects(updated, req.body.slip);
  res.json(updated);
}));

router.get('/cancellations', httpOwner, wrap(async (req, res) =>
  res.json(await loadCancellations(req.ownerId))));

router.post('/cancellations', httpOwner, wrap(async (req, res) => {
  const input = req.body;
  const clean = validateCancellation(input, req.ownerId);
  const open = await queryOne(
    `SELECT TOP 1 1 AS ok FROM dbo.cancellations
     WHERE owner_id = ? AND kind = ? AND ref_id = ? AND status IN (?, ?)`,
    [req.ownerId, input.kind, input.refId, ...OPEN_CANCELLATION_STATUSES],
  );
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
  if (await findCancellation(request.id)) throw httpError(409, 'คำขอนี้มีอยู่แล้ว');
  await saveCancellation(request);
  res.status(201).json(request);
}));

router.delete('/cancellations/:id', httpOwner, wrap(async (req, res) => {
  const request = await findCancellation(req.params.id);
  if (!request || request.ownerId !== req.ownerId) throw httpError(404, 'ไม่พบคำขอยกเลิก');
  if (request.status !== 'pending_admin') throw httpError(409, 'คำขอนี้ไม่สามารถยกเลิกได้แล้ว');
  await run('DELETE FROM dbo.cancellations WHERE id = ? AND owner_id = ?', [request.id, req.ownerId]);
  res.json({ ok: true });
}));

router.get('/staff/payments', requireStaff('accountant'), wrap(async (_req, res) => {
  const rows = await queryAll('SELECT data FROM dbo.payments ORDER BY created_at DESC');
  res.json(rows.map(parseRecord));
}));

router.get('/staff/admin-payments', requireStaff('clinic_admin'), wrap(async (_req, res) => {
  const rows = await queryAll('SELECT data FROM dbo.payments ORDER BY created_at DESC');
  res.json(rows.map(parseRecord));
}));

router.post('/staff/payments/:id/review', requireStaff('accountant'), wrap(async (req, res) => {
  const payment = await findPayment(req.params.id);
  if (!payment) throw httpError(404, 'ไม่พบรายการชำระเงิน');
  if (payment.status !== 'pending_review') throw httpError(409, 'รายการนี้ไม่ได้อยู่ระหว่างตรวจสลิป');
  const decision = req.body?.decision;
  if (!['approved', 'rejected'].includes(decision)) throw httpError(400, 'คำตัดสินไม่ถูกต้อง');
  const cancellation = await latestCancellation(payment.kind, payment.refId, payment.ownerId);
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
  await savePayment(updated);
  if (decision === 'approved') {
    await applyPaymentApprovalEffects(payment, payment.slip);
  }
  res.json(updated);
}));

router.post('/staff/payments/:id/cancel', requireStaff('clinic_admin'), wrap(async (req, res) => {
  const payment = await findPayment(req.params.id);
  if (!payment) throw httpError(404, 'ไม่พบรายการชำระเงิน');
  if (['approved', 'cancelled'].includes(payment.status)) return res.json(payment);
  const updated = {
    ...payment,
    status: 'cancelled',
    note: 'ยกเลิกตามคำขอยกเลิกที่แอดมินอนุมัติ',
    reviewedAt: new Date().toISOString(),
  };
  await savePayment(updated);
  res.json(updated);
}));

router.get('/staff/cancellations', requireStaff('clinic_admin'), wrap(async (_req, res) => {
  const rows = await queryAll('SELECT data FROM dbo.cancellations ORDER BY created_at DESC');
  res.json(rows.map(parseRecord));
}));

router.post('/staff/cancellations/:id/decision', requireStaff('clinic_admin'), wrap(async (req, res) => {
  const request = await findCancellation(req.params.id);
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
  await saveCancellation(updated);
  res.json(updated);
}));

router.get('/staff/refunds', requireStaff('accountant'), wrap(async (_req, res) => {
  const rows = await queryAll('SELECT data FROM dbo.cancellations ORDER BY created_at DESC');
  res.json(rows.map(parseRecord));
}));

router.post('/staff/refunds/:id/complete', requireStaff('accountant'), wrap(async (req, res) => {
  const request = await findCancellation(req.params.id);
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
  await saveCancellation(updated);
  res.json(updated);
}));

router.use((err, _req, res, _next) => {
  const status = err.status ?? 500;
  if (status >= 500) console.error('[payments]', err);
  res.status(status).json({ error: status >= 500 ? 'เกิดข้อผิดพลาดของเซิร์ฟเวอร์' : err.message });
});

export default router;
