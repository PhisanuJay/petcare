import { API_BASE } from '../pet-owner/api.js';
import { STAFF_SESSION_EXPIRED, clearStaffSession, readStaffSession } from '../auth/staffSession.js';

/**
 * Call the Veterinarian API as the logged-in veterinarian (token from the staff login).
 * When the backend says the login is no longer valid (401), the saved session is cleared and the
 * app returns to the login page.
 */
export async function vetRequest(url, options = {}) {
  const token = readStaffSession()?.token;
  let res;
  try {
    res = await fetch(`${API_BASE}/api/veterinarian${url}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
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
