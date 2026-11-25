<<<<<<< HEAD
export function isRoundTrip(serviceType) {
  return serviceType === 'round_trip';
}
=======
import { ZONES, isRoundTrip } from './constants.js';
>>>>>>> origin/Admin-transport

export function fareZoneId(fromZoneId, toZoneId) {
  if (!fromZoneId || !toZoneId) return null;
  if (fromZoneId === '1' && toZoneId === '1') return '1';
  return '2';
}

<<<<<<< HEAD
export function fareForZones(fromZoneId, toZoneId, zones = []) {
  const fareId = fareZoneId(fromZoneId, toZoneId);
  if (!fareId) return null;
  const zone = zones.find((z) => z.id === fareId);
  return zone?.price ?? null;
}

export function priceForZone(zoneId, zones = []) {
  const z = zones.find((x) => x.id === zoneId);
  if (!z) return null;
  return z.price;
=======
export function priceForZone(zoneId, zones = ZONES) {
  const z = zones.find((x) => x.id === zoneId);
  return z?.price ?? null;
}

export function fareForZones(fromZoneId, toZoneId, zones = ZONES) {
  const fareId = fareZoneId(fromZoneId, toZoneId);
  if (!fareId) return null;
  return priceForZone(fareId, zones);
>>>>>>> origin/Admin-transport
}

export function quotePrice({
  fromZoneId,
  toZoneId,
  returnFromZoneId = null,
  returnToZoneId = null,
  serviceType,
<<<<<<< HEAD
  zones = [],
  customPerTrip = null,
  fareZoneOverride = null,
  otherService = null,
=======
  zones = ZONES,
  customPerTrip = null,
  fareZoneOverride = null,
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
<<<<<<< HEAD
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
      transportTotal: null,
      otherServicesTotal: inboundOnly ? 0 : otherServicesTotal || null,
      otherService: inboundOnly ? null : addon,
      lines: [],
      subtotal: null,
      discount: 0,
      total: null,
      needsAdminReview: true,
=======
      fareZoneId: outboundFareZone,
      perTrip: null,
      trips: round ? 2 : 1,
      total: null,
      outbound: { fareZoneId: outboundFareZone, perTrip: outboundPerTrip },
      returnLeg: round ? { fareZoneId: returnFareZone, perTrip: returnPerTrip } : null,
>>>>>>> origin/Admin-transport
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
    transportTotal,
    otherServicesTotal: inboundOnly ? 0 : otherServicesTotal,
    otherService: inboundOnly ? null : addon,
    lines,
    subtotal,
    discount: 0,
    total: subtotal,
    needsAdminReview: false,
=======
  const total = round ? outboundPerTrip + returnPerTrip : outboundPerTrip;

  return {
    fareZoneId: outboundFareZone,
    perTrip: outboundPerTrip,
    trips,
    total,
    outbound: { fareZoneId: outboundFareZone, perTrip: outboundPerTrip },
    returnLeg: round ? { fareZoneId: returnFareZone, perTrip: returnPerTrip } : null,
>>>>>>> origin/Admin-transport
  };
}
