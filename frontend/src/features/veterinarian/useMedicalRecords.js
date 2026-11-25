import { vetRequest } from './vetApi.js';

/** Save a medical record for a patient (`/api/veterinarian/medical-records`). */
export const createMedicalRecord = (petId, data) =>
  vetRequest('/medical-records', { method: 'POST', body: JSON.stringify({ ...data, petId }) });

/** Change a record that the clinic wrote earlier. */
export const updateMedicalRecord = (petId, recordId, data) =>
  vetRequest(`/medical-records/${petId}/${recordId}`, { method: 'PUT', body: JSON.stringify(data) });

/**
 * Save a parasite treatment / prevention that was given (`/api/veterinarian/parasite`).
 * It is stored in the pet's parasite list, shown to the owner under "ถ่ายพยาธิ / เห็บหมัด".
 */
export const createParasiteRecord = (petId, data) =>
  vetRequest('/parasite', { method: 'POST', body: JSON.stringify({ ...data, petId }) });

/** Change a parasite record that the clinic wrote earlier. */
export const updateParasiteRecord = (petId, recordId, data) =>
  vetRequest(`/parasite/${petId}/${recordId}`, { method: 'PUT', body: JSON.stringify(data) });
