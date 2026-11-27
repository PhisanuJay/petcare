import { STORAGE_KEYS, readJSON } from './utils/storage.js';

/** อ่าน Bearer ของสมาชิกจาก local/session storage */
export function readOwnerAuthToken() {
  const remembered = readJSON(STORAGE_KEYS.session, null, localStorage);
  const temporary = readJSON(STORAGE_KEYS.session, null, sessionStorage);
  if (remembered?.authToken) return remembered.authToken;
  if (temporary?.authToken) return temporary.authToken;
  return '';
}

/**
 * Headers สำหรับ API เจ้าของสัตว์: ส่ง Bearer (ถ้ามี) และ x-owner-id เสมอเมื่อมี ownerId
 * เพื่อให้ยังใช้ได้หลัง backend รีสตาร์ทแล้ว in-memory session หาย
 */
export function ownerAuthHeaders(ownerId, extra = {}) {
  const headers = { ...extra };
  if (!headers.Authorization) {
    const token = readOwnerAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  if (ownerId) {
    headers['x-owner-id'] = ownerId;
  }
  return headers;
}
