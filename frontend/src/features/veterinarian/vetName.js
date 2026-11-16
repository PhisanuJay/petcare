const VET_NAME_KEY = 'petcare_vet_name';

/** The vet name typed last time (no staff login yet, so it is remembered in this browser only). */
export function readVetName() {
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
