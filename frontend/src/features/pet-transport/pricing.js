import {
  SERVICE_SUBDISTRICTS,
  ZONES,
  isRoundTrip,
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
 * Round trip = sum of both legs, no discount.
 * outbound / inbound / one_way = single leg.
<<<<<<< HEAD
 * outbound / round_trip may include otherService (clinic/hotel) from Pet-Owner-Vet catalog.
 * inbound = transport only.
=======
>>>>>>> origin/Admin-transport
 */
export function quotePrice({
  fromZoneId,
  toZoneId,
  returnFromZoneId = null,
  returnToZoneId = null,
  serviceType,
  zones = ZONES,
  customPerTrip = null,
  fareZoneOverride = null,
<<<<<<< HEAD
  otherService = null,
=======
>>>>>>> origin/Admin-transport
}) {
  const outboundFareZone = fareZoneOverride || fareZoneId(fromZoneId, toZoneId);
  let outboundPerTrip = null;
  if (customPerTrip != null && customPerTrip !== '') {
    outboundPerTrip = Number(customPerTrip);
  } else if (fareZoneOverride) {
    outboundPerTrip = priceForZone(fareZoneOverride, zones);
  } else {
    outboundPerTrip = fareForZones(fromZoneId, toZoneId, zones);
  }

  const round = isRoundTrip(serviceType);
<<<<<<< HEAD
  const inboundOnly = serviceType === 'inbound';
=======
>>>>>>> origin/Admin-transport
  const retFrom = returnFromZoneId || toZoneId;
  const retTo = returnToZoneId || fromZoneId;
  const returnFareZone = round ? fareZoneId(retFrom, retTo) : null;
  const returnPerTrip = round ? fareForZones(retFrom, retTo, zones) : null;

<<<<<<< HEAD
  const addon = !inboundOnly && otherService?.amount != null ? otherService : null;
  const otherServicesTotal = addon ? Number(addon.amount) : 0;

=======
>>>>>>> origin/Admin-transport
  if (
    outboundPerTrip == null
    || !Number.isFinite(outboundPerTrip)
    || (round && (returnPerTrip == null || !Number.isFinite(returnPerTrip)))
  ) {
    return {
      fromZoneId,
      toZoneId,
      returnFromZoneId: round ? retFrom : null,
      returnToZoneId: round ? retTo : null,
      zoneId: outboundFareZone,
      fareZoneId: outboundFareZone,
      serviceType,
      trips: round ? 2 : 1,
      perTrip: outboundPerTrip,
      outboundPerTrip,
      returnPerTrip: round ? returnPerTrip : null,
      outboundFareZone,
      returnFareZone,
<<<<<<< HEAD
      transportTotal: null,
      otherServicesTotal: inboundOnly ? 0 : otherServicesTotal || null,
      otherService: inboundOnly ? null : addon,
      lines: [],
=======
>>>>>>> origin/Admin-transport
      subtotal: null,
      discount: 0,
      total: null,
      needsAdminReview: true,
    };
  }

  const trips = round ? 2 : 1;
<<<<<<< HEAD
  const transportTotal = round ? outboundPerTrip + returnPerTrip : outboundPerTrip;
  const lines = [
    {
      type: 'transport',
      label: round ? 'ค่ารถรับ–ส่ง (ไป–กลับ)' : 'ค่ารถรับ–ส่ง',
      amount: transportTotal,
    },
  ];
  if (addon && Number.isFinite(otherServicesTotal) && otherServicesTotal > 0) {
    lines.push({
      type: addon.kind || 'other',
      label: addon.label || 'ค่าบริการอื่น',
      amount: otherServicesTotal,
    });
  }

  const subtotal = transportTotal + (Number.isFinite(otherServicesTotal) ? otherServicesTotal : 0);
=======
  const subtotal = round ? outboundPerTrip + returnPerTrip : outboundPerTrip;
>>>>>>> origin/Admin-transport
  return {
    fromZoneId,
    toZoneId,
    returnFromZoneId: round ? retFrom : null,
    returnToZoneId: round ? retTo : null,
    zoneId: outboundFareZone,
    fareZoneId: outboundFareZone,
    serviceType,
    trips,
    perTrip: outboundPerTrip,
    outboundPerTrip,
    returnPerTrip: round ? returnPerTrip : null,
    outboundFareZone,
    returnFareZone,
<<<<<<< HEAD
    transportTotal,
    otherServicesTotal: inboundOnly ? 0 : otherServicesTotal,
    otherService: inboundOnly ? null : addon,
    lines,
=======
>>>>>>> origin/Admin-transport
    subtotal,
    discount: 0,
    total: subtotal,
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
