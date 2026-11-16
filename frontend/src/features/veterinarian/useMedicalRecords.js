import { vetRequest } from './vetApi.js';

/** Save a medical record for a patient (`/api/veterinarian/medical-records`). */
export const createMedicalRecord = (petId, data) =>
  vetRequest('/medical-records', { method: 'POST', body: JSON.stringify({ ...data, petId }) });

/** Change a record that the clinic wrote earlier. */
export const updateMedicalRecord = (petId, recordId, data) =>
  vetRequest(`/medical-records/${petId}/${recordId}`, { method: 'PUT', body: JSON.stringify(data) });
