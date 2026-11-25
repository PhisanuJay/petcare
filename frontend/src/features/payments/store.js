import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { newId } from '../../shared/utils/storage.js';
import {
  cancelStaffPayment,
  createOwnerPayment,
  listOwnerPayments,
  listStaffPayments,
  reviewStaffPayment,
  submitOwnerPayment,
} from './api.js';
import { approveTransportPayment } from '../pet-transport/store.js';
import { depositOf } from './promptpay.js';
import { CANCELLATION_STATUS, cancellationFor, listCancellationRequests } from '../cancellations/store.js';

export const PAY_KIND = {
  hotel: 'hotel',
  transport: 'transport',
  clinic: 'clinic',
};

export const PAY_KIND_LABEL = {
  hotel: 'โรงแรม',
  transport: 'รับส่ง',
  clinic: 'จองคิวคลินิก',
};

export const PAY_STATUS = {
  awaiting: 'awaiting_slip',
  review: 'pending_review',
  approved: 'approved',
  rejected: 'rejected',
  cancelled: 'cancelled',
};

export const PAY_STATUS_LABEL = {
  awaiting_slip: 'ยังไม่อนุมัติ',
  pending_review: 'ยังไม่อนุมัติ',
  approved: 'อนุมัติแล้ว',
  rejected: 'ยังไม่อนุมัติ',
  cancelled: 'ยกเลิกการชำระ',
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

function replaceRecord(row) {
  for (const [key, rows] of caches) {
    const index = rows.findIndex((item) => item.id === row.id);
    if (index >= 0) {
      const next = rows.slice();
      next[index] = row;
      caches.set(key, next);
    }
  }
  const ownerKey = scopeKey(row.ownerId);
  const ownerRows = readCache(ownerKey);
  if (!ownerRows.some((item) => item.id === row.id)) {
    caches.set(ownerKey, [row, ...ownerRows]);
  }
  listeners.forEach((listener) => listener());
}

async function load(scope) {
  if (!scope) return EMPTY;
  const key = scopeKey(scope);
  if (loads.has(key)) return loads.get(key);
  const operation = (scope === 'accountant' || scope === 'clinic_admin'
    ? listStaffPayments(scope)
    : listOwnerPayments(scope))
    .then((rows) => {
      replaceCache(key, Array.isArray(rows) ? rows : []);
      return readCache(key);
    })
    .finally(() => loads.delete(key));
  loads.set(key, operation);
  return operation;
}

export function listPayments(scope) {
  return readCache(scopeKey(scope));
}

export function getPayment(id, ownerId) {
  const rows = ownerId ? readCache(scopeKey(ownerId)) : [...caches.values()].flat();
  return rows.find((row) => row.id === id && (!ownerId || row.ownerId === ownerId)) || null;
}

export function paymentFor(kind, refId, ownerId) {
  const rows = ownerId ? readCache(scopeKey(ownerId)) : [...caches.values()].flat();
  return rows.find((row) => row.kind === kind && row.refId === refId
    && (!ownerId || row.ownerId === ownerId)) || null;
}

/** Shared deposit for hotel, transport, and clinic. The booking itself stays in its own store. */
export async function createPayment(input) {
  const total = Number(input.total);
  const payment = {
    id: newId(),
    kind: input.kind,
    refId: input.refId,
    ownerId: input.ownerId,
    ownerName: input.ownerName || '',
    email: input.email || '',
    title: input.title || '',
    detail: input.detail || '',
    total: Number.isFinite(total) ? total : null,
    deposit: depositOf(total),
    status: PAY_STATUS.awaiting,
    slip: '',
    note: '',
    createdAt: new Date().toISOString(),
    submittedAt: '',
    reviewedAt: '',
  };
  const saved = await createOwnerPayment(input.ownerId, payment);
  replaceRecord(saved);
  return saved;
}

export async function submitSlip(id, ownerId, slip) {
  await load(ownerId);
  const row = getPayment(id, ownerId);
  if (!row) throw new Error('ไม่พบรายการชำระเงิน');
  const cancellation = cancellationFor(row.kind, row.refId, listCancellationRequests(ownerId));
  if (cancellation && cancellation.status !== CANCELLATION_STATUS.rejected) {
    throw new Error('รายการนี้มีคำขอยกเลิกที่กำลังดำเนินการ ไม่สามารถส่งสลิปได้');
  }
  if (row.status === PAY_STATUS.cancelled) throw new Error('รายการชำระเงินนี้ถูกยกเลิกแล้ว');
  if (row.status === PAY_STATUS.approved) throw new Error('รายการนี้อนุมัติแล้ว');
  if (!slip) throw new Error('กรุณาแนบสลิป');
  const updated = await submitOwnerPayment(ownerId, id, slip);
  replaceRecord(updated);
  return updated;
}

export async function reviewPayment(id, decision, note = '') {
  await load('accountant');
  const row = getPayment(id);
  if (!row) throw new Error('ไม่พบรายการชำระเงิน');
  if (row.status !== PAY_STATUS.review) throw new Error('รายการนี้ไม่ได้อยู่ระหว่างตรวจสลิป');
  const cancellation = cancellationFor(
    row.kind,
    row.refId,
    listCancellationRequests('accountant'),
  );
  if (
    cancellation
    && cancellation.status !== CANCELLATION_STATUS.pendingAdmin
    && cancellation.status !== CANCELLATION_STATUS.rejected
  ) throw new Error('รายการนี้ยกเลิกแล้ว ไม่สามารถอนุมัติสลิปได้');
  if (decision !== PAY_STATUS.approved && decision !== PAY_STATUS.rejected) {
    throw new Error('คำตัดสินไม่ถูกต้อง');
  }
  if (decision === PAY_STATUS.approved && row.kind === PAY_KIND.transport) {
    await approveTransportPayment(row.refId);
  }
  const updated = await reviewStaffPayment(id, decision, note);
  replaceRecord(updated);
  return updated;
}

export async function cancelPendingPayment(kind, refId) {
  await load('clinic_admin');
  const row = paymentFor(kind, refId);
  if (!row || [PAY_STATUS.approved, PAY_STATUS.cancelled].includes(row.status)) return row;
  const updated = await cancelStaffPayment(row.id);
  replaceRecord(updated);
  return updated;
}

export function usePayments(scope) {
  const key = scopeKey(scope);
  const all = useSyncExternalStore(
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
  const mine = useCallback((ownerId) => all.filter((row) => row.ownerId === ownerId), [all]);
  const pending = useMemo(() => all.filter((row) => row.status === PAY_STATUS.review), [all]);
  return { all, mine, pending };
}
