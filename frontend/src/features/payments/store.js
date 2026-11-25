import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { STORAGE_KEYS, newId, readJSON, writeJSON } from '../../shared/utils/storage.js';
import { adminMarkPaid } from '../pet-transport/store.js';
import { depositOf } from './promptpay.js';

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
};

export const PAY_STATUS_LABEL = {
  awaiting_slip: 'ยังไม่อนุมัติ',
  pending_review: 'ยังไม่อนุมัติ',
  approved: 'อนุมัติแล้ว',
  rejected: 'ยังไม่อนุมัติ',
};

const listeners = new Set();
let cache = null;

function emit() {
  listeners.forEach((listener) => listener());
}

function read() {
  if (cache === null) cache = readJSON(STORAGE_KEYS.payments, []);
  return cache;
}

function write(next) {
  cache = next;
  writeJSON(STORAGE_KEYS.payments, next);
  emit();
}

function subscribe(listener) {
  listeners.add(listener);
  const onStorage = (event) => {
    if (event.key === STORAGE_KEYS.payments) {
      cache = null;
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function listPayments() {
  return read();
}

export function getPayment(id) {
  return read().find((row) => row.id === id) || null;
}

export function paymentFor(kind, refId) {
  return read().find((row) => row.kind === kind && row.refId === refId) || null;
}

/**
 * Shared deposit for hotel, transport, and clinic.
 * The booking itself stays in its own store. This record is only the money.
 */
export function createPayment(input) {
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
  write([payment, ...read()]);
  return payment;
}

export function submitSlip(id, ownerId, slip) {
  const row = read().find((item) => item.id === id && item.ownerId === ownerId);
  if (!row) throw new Error('ไม่พบรายการชำระเงิน');
  if (row.status === PAY_STATUS.approved) throw new Error('รายการนี้อนุมัติแล้ว');
  if (!slip) throw new Error('กรุณาแนบสลิป');
  const next = {
    ...row,
    slip,
    status: PAY_STATUS.review,
    note: '',
    submittedAt: new Date().toISOString(),
  };
  write(read().map((item) => (item.id === id ? next : item)));
  return next;
}

export function reviewPayment(id, decision, note = '') {
  const row = read().find((item) => item.id === id);
  if (!row) throw new Error('ไม่พบรายการชำระเงิน');
  if (row.status !== PAY_STATUS.review) throw new Error('รายการนี้ไม่ได้อยู่ระหว่างตรวจสลิป');
  if (decision !== PAY_STATUS.approved && decision !== PAY_STATUS.rejected) {
    throw new Error('คำตัดสินไม่ถูกต้อง');
  }
  const next = {
    ...row,
    status: decision,
    note: String(note || '').trim(),
    reviewedAt: new Date().toISOString(),
  };
  write(read().map((item) => (item.id === id ? next : item)));
  if (decision === PAY_STATUS.approved && row.kind === PAY_KIND.transport) {
    try {
      adminMarkPaid(row.refId);
    } catch {
      /* transport row may already be paid */
    }
  }
  return next;
}

export function usePayments() {
  const all = useSyncExternalStore(subscribe, read);
  const mine = useCallback((ownerId) => all.filter((row) => row.ownerId === ownerId), [all]);
  const pending = useMemo(
    () => all.filter((row) => row.status === PAY_STATUS.review),
    [all],
  );
  return { all, mine, pending };
}
