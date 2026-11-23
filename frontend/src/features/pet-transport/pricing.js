import {
  ROUND_TRIP_DISCOUNT,
  SERVICE_SUBDISTRICTS,
  ZONES,
} from './constants.js';

export function zoneIdFromSubdistrict(subdistrictId) {
  const sub = SERVICE_SUBDISTRICTS.find((s) => s.id === subdistrictId);
  return sub?.zoneId ?? null;
}

export function subdistrictById(subdistrictId) {
  return SERVICE_SUBDISTRICTS.find((s) => s.id === subdistrictId) ?? null;
}

export function districtLabel(districtId) {
  if (districtId === 'chatuchak') return 'เขตจตุจักร';
  return districtId || '';
}

/**
 * Fare matrix (one-way):
 * Z1–Z1 → Zone 1 price
 * any leg involving Z2 → Zone 2 price
 */
export function fareZoneId(fromZoneId, toZoneId) {
  if (!fromZoneId || !toZoneId) return null;
  if (fromZoneId === '1' && toZoneId === '1') return '1';
  return '2';
}

export function fareForZones(fromZoneId, toZoneId, zones = ZONES) {
  const fareId = fareZoneId(fromZoneId, toZoneId);
  if (!fareId) return null;
  const zone = zones.find((z) => z.id === fareId);
  return zone?.price ?? null;
}

export function priceForZone(zoneId, zones = ZONES) {
  const z = zones.find((x) => x.id === zoneId);
  if (!z) return null;
  return z.price;
}

/**
 * Quote from pickup/dropoff zones.
 * Round trip = 2 legs, 10% off total fare.
 */
export function quotePrice({
  fromZoneId,
  toZoneId,
  serviceType,
  zones = ZONES,
  customPerTrip = null,
  fareZoneOverride = null,
}) {
  const resolvedFareZone = fareZoneOverride || fareZoneId(fromZoneId, toZoneId);
  let perTrip = null;
  if (customPerTrip != null && customPerTrip !== '') {
    perTrip = Number(customPerTrip);
  } else if (fareZoneOverride) {
    perTrip = priceForZone(fareZoneOverride, zones);
  } else {
    perTrip = fareForZones(fromZoneId, toZoneId, zones);
  }

  const trips = serviceType === 'round_trip' ? 2 : 1;

  if (perTrip == null || !Number.isFinite(perTrip)) {
    return {
      fromZoneId,
      toZoneId,
      zoneId: resolvedFareZone,
      fareZoneId: resolvedFareZone,
      serviceType,
      trips,
      perTrip: null,
      subtotal: null,
      discount: 0,
      total: null,
      needsAdminReview: true,
    };
  }

  const subtotal = perTrip * trips;
  const discount = serviceType === 'round_trip' ? Math.round(subtotal * ROUND_TRIP_DISCOUNT) : 0;
  return {
    fromZoneId,
    toZoneId,
    zoneId: resolvedFareZone,
    fareZoneId: resolvedFareZone,
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

/** Preview matrix rows for admin pricing page */
export function fareMatrixPreview(zones = ZONES) {
  const pairs = [
    { from: '1', to: '1', label: 'Zone 1 → Zone 1' },
    { from: '1', to: '2', label: 'Zone 1 → Zone 2' },
    { from: '2', to: '1', label: 'Zone 2 → Zone 1' },
    { from: '2', to: '2', label: 'Zone 2 → Zone 2' },
  ];
  return pairs.map((p) => ({
    ...p,
    price: fareForZones(p.from, p.to, zones),
  }));
}
