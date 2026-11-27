import { readJSON, writeJSON } from '../../shared/utils/storage.js';

/**
 * Authenticated staff session: `{ token, staff }` from POST /api/auth/staff/login.
 * Kept apart from the customer session, which the customer login code owns.
 */
const STAFF_SESSION_KEY = 'petcare_staff_session';
export const STAFF_SESSION_CHANGED = 'petcare:staff-session-changed';

function removeSavedSession() {
  try {
    localStorage.removeItem(STAFF_SESSION_KEY);
    sessionStorage.removeItem(STAFF_SESSION_KEY);
  } catch {
    /* storage unavailable: nothing to clear */
  }
}

function notifySessionChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(STAFF_SESSION_CHANGED));
  }
}

export function readStaffSession() {
  const session = readJSON(STAFF_SESSION_KEY, null) ?? readJSON(STAFF_SESSION_KEY, null, sessionStorage);
  return session?.token && session?.staff ? session : null;
}

export function saveStaffSession(session, remember) {
  removeSavedSession();
  writeJSON(STAFF_SESSION_KEY, session, remember ? localStorage : sessionStorage);
  notifySessionChanged();
}

export function clearStaffSession() {
  removeSavedSession();
  notifySessionChanged();
}

/** Window event: the backend rejected the saved session (expired or the backend restarted). */
export const STAFF_SESSION_EXPIRED = 'petcare:staff-session-expired';

/** Where each staff role starts after logging in. */
export const STAFF_HOME = {
  veterinarian: '/veterinarian',
  medical_assistant: '/clinic-admin',
  clinic_admin: '/clinic-admin',
};
