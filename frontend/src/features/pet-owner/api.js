import { API_BASE_URL } from '../../shared/api.js';
import { ownerAuthHeaders } from '../../shared/ownerAuthHeaders.js';

/** dev ใช้ path ว่างผ่าน Vite proxy · production / env ชี้ backend โดยตรง */
export const API_BASE = (
  import.meta.env.VITE_API_URL
  || import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.DEV ? '' : API_BASE_URL)
).replace(/\/$/, '');

/**
 * Call the Pet Owner API for the logged-in owner (Bearer session, or x-owner-id fallback).
 */
export async function ownerRequest(ownerId, url, options = {}) {
  if (!ownerId) {
    throw new Error('กรุณาเข้าสู่ระบบ');
  }
  let res;
  try {
    res = await fetch(`${API_BASE}/api/pet-owner${url}`, {
      ...options,
      headers: ownerAuthHeaders(ownerId, {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      }),
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
