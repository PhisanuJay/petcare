import { readJSON, writeJSON } from '../../shared/utils/storage.js';

/**
 * Staff (veterinarian) login session: `{ token, staff }` from POST /api/auth/staff/login.
 * Kept apart from the customer session, which the customer login code owns.
 */
const STAFF_SESSION_KEY = 'petcare_staff_session';

export function readStaffSession() {
  const session = readJSON(STAFF_SESSION_KEY, null) ?? readJSON(STAFF_SESSION_KEY, null, sessionStorage);
  return session?.token && session?.staff ? session : null;
}

export function saveStaffSession(session, remember) {
  clearStaffSession();
  writeJSON(STAFF_SESSION_KEY, session, remember ? localStorage : sessionStorage);
}

export function clearStaffSession() {
  try {
    localStorage.removeItem(STAFF_SESSION_KEY);
    sessionStorage.removeItem(STAFF_SESSION_KEY);
  } catch {
    /* storage unavailable: nothing to clear */
  }
}

/** Window event: the backend rejected the saved session (expired or the backend restarted). */
export const STAFF_SESSION_EXPIRED = 'petcare:staff-session-expired';

/** Where each staff role starts after logging in. */
export const STAFF_HOME = {
  veterinarian: '/veterinarian',
  medical_assistant: '/medical-assistant',
  clinic_admin: '/clinic-admin',
};
