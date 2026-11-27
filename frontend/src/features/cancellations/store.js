import { useEffect, useSyncExternalStore } from 'react';
import {
  createOwnerCancellation,
  decideStaffCancellation,
  finishStaffRefund,
  listOwnerCancellations,
  listStaffCancellations,
  removeOwnerCancellation,
} from '../payments/api.js';

export const CANCELLATION_STATUS = {
  pendingAdmin: 'pending_admin',
  awaitingRefund: 'awaiting_refund',
  rejected: 'rejected',
  refunded: 'refunded',
  noRefund: 'no_refund',
};

export const CANCELLATION_STATUS_LABEL = {
  [CANCELLATION_STATUS.pendingAdmin]: 'รอแอดมินพิจารณา',
  [CANCELLATION_STATUS.awaitingRefund]: 'รอฝ่ายบัญชีคืนเงิน',
  [CANCELLATION_STATUS.rejected]: 'ไม่อนุมัติคำขอยกเลิก',
  [CANCELLATION_STATUS.refunded]: 'คืนเงินแล้ว',
  [CANCELLATION_STATUS.noRefund]: 'ปิดรายการ · ไม่มีเงินที่ยืนยันแล้วให้คืน',
};

const EMPTY = [];
const listeners = new Set();
const caches = new Map();
const loads = new Map();

function scopeKey(scope) {
  return scope === 'accountant' || scope === 'clinic_admin'
    ? `staff:${scope}`
    : `owner:${scope || ''}`;
}

function readCache(key) {
  return caches.get(key) || EMPTY;
}

function replaceCache(key, rows) {
  caches.set(key, rows);
  listeners.forEach((listener) => listener());
}

function replaceRecord(request) {
  for (const [key, rows] of caches) {
    const index = rows.findIndex((item) => item.id === request.id);
    if (index >= 0) {
      const next = rows.slice();
      next[index] = request;
      caches.set(key, next);
    }
  }
  const ownerKey = scopeKey(request.ownerId);
  const ownerRows = readCache(ownerKey);
  if (!ownerRows.some((item) => item.id === request.id)) {
    caches.set(ownerKey, [request, ...ownerRows]);
  }
  listeners.forEach((listener) => listener());
}

function removeRecord(id) {
  for (const [key, rows] of caches) {
    if (rows.some((item) => item.id === id)) {
      caches.set(key, rows.filter((item) => item.id !== id));
    }
  }
  listeners.forEach((listener) => listener());
}

async function load(scope) {
  if (!scope) return EMPTY;
  const key = scopeKey(scope);
  if (loads.has(key)) return loads.get(key);
  const operation = (scope === 'accountant' || scope === 'clinic_admin'
    ? listStaffCancellations(scope)
    : listOwnerCancellations(scope))
    .then((rows) => {
      replaceCache(key, Array.isArray(rows) ? rows : []);
      return readCache(key);
    })
    .finally(() => loads.delete(key));
  loads.set(key, operation);
  return operation;
}

export function listCancellationRequests(scope) {
  if (scope) return readCache(scopeKey(scope));
  return [...caches.values()].flat();
}

export function getCancellationRequest(id, scope) {
  return listCancellationRequests(scope).find((item) => item.id === id) || null;
}

export function cancellationFor(kind, refId, requests = listCancellationRequests()) {
  return requests
    .filter((item) => item.kind === kind && item.refId === refId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0] || null;
}

export function hasOpenCancellation(kind, refId, requests = listCancellationRequests()) {
  const current = cancellationFor(kind, refId, requests);
  return current?.status === CANCELLATION_STATUS.pendingAdmin
    || current?.status === CANCELLATION_STATUS.awaitingRefund;
}

export async function createCancellationRequest(input) {
  const reason = String(input.reason || '').trim();
  const bankAccount = String(input.bankAccount || '').replace(/[\s-]/g, '');
  const contactPhone = String(input.contactPhone || '').replace(/[\s-]/g, '');

  if (!['hotel', 'transport', 'clinic'].includes(input.kind)) throw new Error('ประเภทการจองไม่ถูกต้อง');
  if (!input.refId || !input.ownerId) throw new Error('ไม่พบข้อมูลการจองหรือเจ้าของ');
  if (reason.length < 3 || reason.length > 500) throw new Error('กรุณาระบุเหตุผล 3 ถึง 500 ตัวอักษร');
  if (typeof input.bankName !== 'string' || !input.bankName.trim()) throw new Error('กรุณาเลือกธนาคาร');
  if (!/^\d{10,16}$/.test(bankAccount)) throw new Error('เลขบัญชีต้องเป็นตัวเลข 10 ถึง 16 หลัก');
  if (!/^0\d{8,9}$/.test(contactPhone)) throw new Error('เบอร์ติดต่อ 9 ถึง 10 หลักและขึ้นต้นด้วย 0');
  if (hasOpenCancellation(input.kind, input.refId, listCancellationRequests(input.ownerId))) {
    throw new Error('รายการนี้มีคำขอยกเลิกที่กำลังดำเนินการอยู่');
  }

  const request = await createOwnerCancellation(input.ownerId, {
    ...input,
    reason,
    bankName: input.bankName.trim(),
    bankAccount,
    contactPhone,
  });
  replaceRecord(request);
  return request;
}

export async function removeCancellationRequest(id, ownerId) {
  const request = getCancellationRequest(id, ownerId);
  if (!request || request.status !== CANCELLATION_STATUS.pendingAdmin) return;
  await removeOwnerCancellation(ownerId || request.ownerId, id);
  removeRecord(id);
}

export async function resolveCancellationRequest(id, { approve, adminNote = '', refundAmount = 0 }) {
  const updated = await decideStaffCancellation(id, {
    approve: Boolean(approve),
    adminNote: String(adminNote || '').trim().slice(0, 500),
    refundAmount: approve ? Math.max(0, Number(refundAmount) || 0) : 0,
  });
  replaceRecord(updated);
  return updated;
}

export async function completeCancellationRefund(id, { receipt = '', accountantNote = '' } = {}) {
  const updated = await finishStaffRefund(id, {
    receipt,
    accountantNote: String(accountantNote || '').trim().slice(0, 500),
  });
  replaceRecord(updated);
  return updated;
}

export function useCancellationRequests(scope) {
  const key = scopeKey(scope);
  const rows = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => readCache(key),
    () => EMPTY,
  );
  useEffect(() => {
    if (scope) load(scope).catch(() => {});
  }, [scope]);
  return rows;
}
