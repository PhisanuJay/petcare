export function isRoundTrip(serviceType) {
  return serviceType === 'round_trip';
}

export function fareZoneId(fromZoneId, toZoneId) {
  if (!fromZoneId || !toZoneId) return null;
  if (fromZoneId === '1' && toZoneId === '1') return '1';
  return '2';
}

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
}

export function quotePrice({
  fromZoneId,
  toZoneId,
  returnFromZoneId = null,
  returnToZoneId = null,
  serviceType,
  zones = [],
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
      subtotal: null,
      discount: 0,
      total: null,
      needsAdminReview: true,
    };
  }

  const trips = round ? 2 : 1;
  const subtotal = round ? outboundPerTrip + returnPerTrip : outboundPerTrip;
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
    subtotal,
    discount: 0,
    total: subtotal,
    needsAdminReview: false,
  };
}
