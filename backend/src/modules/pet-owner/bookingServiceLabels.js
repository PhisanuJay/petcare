import { DEFAULT_SERVICES } from '../clinic-admin/clinicSettings.js';

const LEGACY_CODES = {
  vaccine: 'vaccine_combo',
  parasite: 'deworming',
  followup: 'checkup',
  other: 'checkup',
};

const SPECIES_LABELS = {
  vaccine_combo: {
    dog: 'ฉีดวัคซีนรวม 5–6 โรค',
    cat: 'ฉีดวัคซีนรวม 3–4 โรค',
  },
};

function priceGroup(species) {
  return String(species || '').toLowerCase() === 'cat' ? 'cat' : 'dog';
}

export function normalizeBookingServiceCode(code) {
  if (!code || typeof code !== 'string') return 'checkup';
  return LEGACY_CODES[code] || code;
}

/** Species-aware label stored on clinic bookings. */
export function bookingServiceLabel(code, species) {
  const normalized = normalizeBookingServiceCode(code);
  const group = priceGroup(species);
  const bySpecies = SPECIES_LABELS[normalized];
  if (bySpecies?.[group]) return bySpecies[group];
  return DEFAULT_SERVICES[normalized] ?? DEFAULT_SERVICES[code] ?? code;
}