import { API_BASE } from '../pet-owner/api.js';
import { STORAGE_KEYS } from '../../shared/utils/storage.js';

function readStoredToken() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.session)
      || sessionStorage.getItem(STORAGE_KEYS.session);
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    return parsed?.authToken || '';
  } catch {
    return '';
  }
}

export async function saRequest(path, { token, ...options } = {}) {
  const authToken = token || readStoredToken();
  let res;
  try {
    res = await fetch(`${API_BASE}/api/super-admin${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
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

export function fetchOverview(token) {
  return saRequest('/overview', { token });
}

export function fetchUsers(token) {
  return saRequest('/users', { token });
}

export function fetchReports(token) {
  return saRequest('/reports', { token });
}
