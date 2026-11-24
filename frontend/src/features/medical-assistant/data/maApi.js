import { API_BASE } from '../../pet-owner/api.js';

/**
 * Call the Medical Assistant API.
 * PLACEHOLDER access: the `x-staff-role` header is not real security (there is no staff login yet).
 * Replace it with real authentication when staff accounts exist.
 */
export async function maRequest(url, options = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}/api/medical-assistant${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-staff-role': 'medical-assistant',
        ...options.headers,
      },
    });
  } catch {
    throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบว่า backend ทำงานอยู่');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
  return body;
}
