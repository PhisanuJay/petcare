import { ROUND_TRIP_DISCOUNT, ZONES } from './constants.js';

/** Resolve zone from distance (km). Admin may override later. */
export function zoneFromDistance(km) {
  const n = Number(km);
  if (!Number.isFinite(n) || n < 0) return null;
  // Zone A includes 0; others use (min, max]
  if (n <= 5) return ZONES.find((z) => z.id === 'A');
  return ZONES.find((z) => n > z.minKm && n <= z.maxKm) ?? ZONES[ZONES.length - 1];
}

export function priceForZone(zoneId, zones = ZONES) {
  const z = zones.find((x) => x.id === zoneId);
  if (!z) return null;
  return z.price;
}

/**
 * Quote for one trip or round trip.
 * Round trip = 2 legs, 10% off total fare.
 */
export function quotePrice({ zoneId, serviceType, zones = ZONES, customPerTrip = null }) {
  const zone = zones.find((z) => z.id === zoneId);
  const perTrip = customPerTrip ?? zone?.price ?? null;
  if (perTrip == null) {
    return {
      zoneId,
      serviceType,
      trips: serviceType === 'round_trip' ? 2 : 1,
      perTrip: null,
      subtotal: null,
      discount: 0,
      total: null,
      needsAdminReview: true,
    };
  }

  const trips = serviceType === 'round_trip' ? 2 : 1;
  const subtotal = perTrip * trips;
  const discount = serviceType === 'round_trip' ? Math.round(subtotal * ROUND_TRIP_DISCOUNT) : 0;
  return {
    zoneId,
    serviceType,
    trips,
    perTrip,
    subtotal,
    discount,
    total: subtotal - discount,
    needsAdminReview: false,
  };
}

export function formatBaht(n) {
  if (n == null || Number.isNaN(n)) return 'รอ Admin พิจารณา';
  return `฿${Number(n).toLocaleString('th-TH')}`;
}
