import { serviceLabel } from '../clinic-admin/clinicSettings.js';

const LEGACY_CODES = {
  vaccine: 'vaccine_combo',
  parasite: 'deworming',
  followup: 'checkup',
  other: 'checkup',
};

export function normalizeBookingServiceCode(code) {
  if (!code || typeof code !== 'string') return 'checkup';
  return LEGACY_CODES[code] || code;
}

/** Species-aware label stored on clinic bookings. */
export function bookingServiceLabel(code, species) {
  const normalized = normalizeBookingServiceCode(code);
  return serviceLabel(normalized, species) || normalized;
}
