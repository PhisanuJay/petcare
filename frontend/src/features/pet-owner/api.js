import { STORAGE_KEYS, readJSON } from '../../shared/utils/storage.js';

export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

function ownerAuthHeaders(ownerId, extra = {}) {
  const remembered = readJSON(STORAGE_KEYS.session, null);
  const temporary = readJSON(STORAGE_KEYS.session, null, sessionStorage);
  const session = remembered?.authToken ? remembered : temporary;
  const headers = { ...extra };
  if (session?.authToken) {
    headers.Authorization = `Bearer ${session.authToken}`;
  } else if (ownerId) {
    headers['x-owner-id'] = ownerId;
  }
  return headers;
}

/**
 * Call the Pet Owner API for the logged-in owner (Bearer session, or x-owner-id fallback).
 */
export async function ownerRequest(ownerId, url, options = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}/api/pet-owner${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
        ...ownerAuthHeaders(ownerId, {}),
      },
    });
  } catch {
    throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบว่า backend ทำงานอยู่');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
  return body;
}

export async function petOwnerAdminRequest(url, options = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}/api/pet-owner/admin${url}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
  } catch {
    throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบว่า backend ทำงานอยู่');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
  return body;
}

export function resolveClinicCancellation(id, cancellationId, approve, adminNote = '') {
  return petOwnerAdminRequest(`/bookings/${id}/resolve-cancel`, {
    method: 'POST',
    body: JSON.stringify({ cancellationId, approve, adminNote }),
  });
}

export function resolveHotelReservationCancellation(id, cancellationId, approve, adminNote = '') {
  return petOwnerAdminRequest(`/cat-hotel/reservations/${id}/resolve-cancel`, {
    method: 'POST',
    body: JSON.stringify({ cancellationId, approve, adminNote }),
  });
}
