import { ZONES, isRoundTrip } from './constants.js';

export function fareZoneId(fromZoneId, toZoneId) {
  if (!fromZoneId || !toZoneId) return null;
  if (fromZoneId === '1' && toZoneId === '1') return '1';
  return '2';
}

export function priceForZone(zoneId, zones = ZONES) {
  const z = zones.find((x) => x.id === zoneId);
  return z?.price ?? null;
}

export function fareForZones(fromZoneId, toZoneId, zones = ZONES) {
  const fareId = fareZoneId(fromZoneId, toZoneId);
  if (!fareId) return null;
  return priceForZone(fareId, zones);
}

export function quotePrice({
  fromZoneId,
  toZoneId,
  returnFromZoneId = null,
  returnToZoneId = null,
  serviceType,
  zones = ZONES,
  customPerTrip = null,
  fareZoneOverride = null,
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
  const retFrom = returnFromZoneId || toZoneId;
  const retTo = returnToZoneId || fromZoneId;
  const returnFareZone = round ? fareZoneId(retFrom, retTo) : null;
  const returnPerTrip = round ? fareForZones(retFrom, retTo, zones) : null;

  if (
    outboundPerTrip == null
    || !Number.isFinite(outboundPerTrip)
    || (round && (returnPerTrip == null || !Number.isFinite(returnPerTrip)))
  ) {
    return {
      fareZoneId: outboundFareZone,
      perTrip: null,
      trips: round ? 2 : 1,
      total: null,
      outbound: { fareZoneId: outboundFareZone, perTrip: outboundPerTrip },
      returnLeg: round ? { fareZoneId: returnFareZone, perTrip: returnPerTrip } : null,
    };
  }

  const trips = round ? 2 : 1;
  const total = round ? outboundPerTrip + returnPerTrip : outboundPerTrip;

  return {
    fareZoneId: outboundFareZone,
    perTrip: outboundPerTrip,
    trips,
    total,
    outbound: { fareZoneId: outboundFareZone, perTrip: outboundPerTrip },
    returnLeg: round ? { fareZoneId: returnFareZone, perTrip: returnPerTrip } : null,
  };
}
