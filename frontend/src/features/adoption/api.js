import { API_BASE_URL } from '../../shared/api.js';
import { ownerAuthHeaders } from '../../shared/ownerAuthHeaders.js';

export const ADOPTION_API_URL = `${API_BASE_URL}/api/adoption`;
export const ADOPTION_STAFF_TOKEN_KEY = 'petcare.adoption.staff-token';

/** Headers สำหรับสมาชิกที่ล็อกอิน (Bearer + x-owner-id) */
export function adoptionCustomerHeaders(ownerId, extra = {}) {
  return ownerAuthHeaders(ownerId, extra);
}

/** Auth ของแอดมินโรงแรมตอนทำงานหาบ้านใน /admin/adoption */
let adoptionOpsBearer = '';
let adoptionOpsActorId = '';

export function setAdoptionOpsBearer(token) {
  adoptionOpsBearer = typeof token === 'string' ? token : '';
}

export function setAdoptionOpsActorId(actorId) {
  adoptionOpsActorId = typeof actorId === 'string' ? actorId : '';
}

export function getAdoptionOpsBearer() {
  return adoptionOpsBearer || sessionStorage.getItem(ADOPTION_STAFF_TOKEN_KEY) || '';
}

export function adoptionStaffFetch(path, options = {}) {
  const token = getAdoptionOpsBearer();
  const actorId = adoptionOpsActorId;
  return fetch(`${ADOPTION_API_URL}/staff${path}`, {
    ...options,
    headers: {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(actorId ? { 'x-owner-id': actorId } : {}),
    },
  });
}

export async function readAdoptionResponse(response, fallback = 'ดำเนินการไม่สำเร็จ') {
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || fallback);
  return result;
}

export async function updateAdoptionAnimalStatus(animalId, status) {
  const response = await adoptionStaffFetch(
    `/animals/${encodeURIComponent(animalId)}/status`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    },
  );
  return readAdoptionResponse(response, 'เปลี่ยนสถานะไม่สำเร็จ');
}

export async function moderateAdoptionAnimal(animalId, action, note = '') {
  const response = await adoptionStaffFetch(
    `/animals/${encodeURIComponent(animalId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, note }),
    },
  );
  return readAdoptionResponse(response, 'บันทึกไม่สำเร็จ');
}
