export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

/**
 * Call the Pet Owner API as `ownerId` (sent in the x-owner-id header until the backend has real auth).
 * Resolves with the parsed JSON body; rejects with an Error carrying a Thai message.
 */
export async function ownerRequest(ownerId, url, options = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}/api/pet-owner${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
        'x-owner-id': ownerId,
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
