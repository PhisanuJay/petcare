import { API_BASE } from '../../pet-owner/api.js';
import {
  STAFF_SESSION_EXPIRED,
  clearStaffSession,
  readStaffSession,
} from '../../auth/staffSession.js';

/**
 * Call the Clinic Admin API as the logged-in `clinic_admin`.
 * When the backend answers 401, clear the staff session and notify AuthContext to return to login.
 */
export async function caRequest(url, options = {}) {
  const token = readStaffSession()?.token;
  let res;
  try {
    res = await fetch(`${API_BASE}/api/clinic-admin${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบว่า backend ทำงานอยู่');
  }
  const body = await res.json().catch(() => null);
  if (res.status === 401) {
    clearStaffSession();
    window.dispatchEvent(new Event(STAFF_SESSION_EXPIRED));
  }
  if (!res.ok) throw new Error(body?.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
  return body;
}
