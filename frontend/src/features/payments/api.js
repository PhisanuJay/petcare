import { readJSON, STORAGE_KEYS } from '../../shared/utils/storage.js';
import { ownerAuthHeaders } from '../../shared/ownerAuthHeaders.js';
import { readStaffSession } from '../auth/staffSession.js';

const API_BASE = (
  import.meta.env.VITE_API_URL
  || import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.DEV ? '' : 'http://localhost:3001')
).replace(/\/$/, '');
const IMPORT_MARKER = 'petcare_payments_imported_owner:';

async function request(path, options = {}, headers = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}/api/payments${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
        ...headers,
      },
    });
  } catch {
    throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบว่า backend ทำงานอยู่');
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || 'ดำเนินการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
  return body;
}

function ownerHeaders(ownerId) {
  if (!ownerId) throw new Error('กรุณาเข้าสู่ระบบ');
  return ownerAuthHeaders(ownerId);
}

function staffHeaders(role) {
  const session = readStaffSession();
  if (!session?.token || session.staff?.role !== role) {
    throw new Error('กรุณาเข้าสู่ระบบด้วยบัญชีเจ้าหน้าที่ที่มีสิทธิ์');
  }
  return { Authorization: `Bearer ${session.token}` };
}

async function importBrowserData(ownerId) {
  if (localStorage.getItem(`${IMPORT_MARKER}${ownerId}`)) return;
  const payments = readJSON(STORAGE_KEYS.payments, [])
    .filter((item) => item?.ownerId === ownerId);
  const cancellations = readJSON(STORAGE_KEYS.cancellations, [])
    .filter((item) => item?.ownerId === ownerId);
  await request('/import', {
    method: 'POST',
    body: JSON.stringify({ payments, cancellations }),
  }, ownerHeaders(ownerId));
  localStorage.setItem(`${IMPORT_MARKER}${ownerId}`, '1');
}

export async function listOwnerPayments(ownerId) {
  await importBrowserData(ownerId);
  return request('/', {}, ownerHeaders(ownerId));
}

export async function createOwnerPayment(ownerId, payment) {
  return request('/', { method: 'POST', body: JSON.stringify(payment) }, ownerHeaders(ownerId));
}

export async function submitOwnerPayment(ownerId, id, slip) {
  return request(`/${encodeURIComponent(id)}/slip`, {
    method: 'POST',
    body: JSON.stringify({ slip }),
  }, ownerHeaders(ownerId));
}

export async function listOwnerCancellations(ownerId) {
  await importBrowserData(ownerId);
  return request('/cancellations', {}, ownerHeaders(ownerId));
}

export async function createOwnerCancellation(ownerId, input) {
  return request('/cancellations', {
    method: 'POST',
    body: JSON.stringify(input),
  }, ownerHeaders(ownerId));
}

export async function removeOwnerCancellation(ownerId, id) {
  return request(`/cancellations/${encodeURIComponent(id)}`, { method: 'DELETE' }, ownerHeaders(ownerId));
}

export async function listStaffPayments(role = 'accountant') {
  const path = role === 'clinic_admin' ? '/staff/admin-payments' : '/staff/payments';
  return request(path, {}, staffHeaders(role));
}

export async function reviewStaffPayment(id, decision, note) {
  return request(`/staff/payments/${encodeURIComponent(id)}/review`, {
    method: 'POST',
    body: JSON.stringify({ decision, note }),
  }, staffHeaders('accountant'));
}

export async function cancelStaffPayment(id) {
  return request(`/staff/payments/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({}),
  }, staffHeaders('clinic_admin'));
}

export async function listStaffCancellations(role) {
  const path = role === 'accountant' ? '/staff/refunds' : '/staff/cancellations';
  return request(path, {}, staffHeaders(role));
}

export async function decideStaffCancellation(id, decision) {
  return request(`/staff/cancellations/${encodeURIComponent(id)}/decision`, {
    method: 'POST',
    body: JSON.stringify(decision),
  }, staffHeaders('clinic_admin'));
}

export async function finishStaffRefund(id, details) {
  return request(`/staff/refunds/${encodeURIComponent(id)}/complete`, {
    method: 'POST',
    body: JSON.stringify(details),
  }, staffHeaders('accountant'));
}
