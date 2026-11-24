import { readStaffSession } from '../auth/staffSession.js';

const VET_NAME_KEY = 'petcare_vet_name';

/**
 * The name used to pre-fill the "vet" field: the logged-in veterinarian's name, otherwise the name
 * typed last time (remembered in this browser only).
 */
export function readVetName() {
  const loggedIn = readStaffSession()?.staff?.name;
  if (loggedIn) return loggedIn;
  try {
    return localStorage.getItem(VET_NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveVetName(name) {
  try {
    localStorage.setItem(VET_NAME_KEY, name);
  } catch {
    /* remembering the name is only a convenience */
  }
}

export const DEFAULT_CLINIC = 'PetCare';
