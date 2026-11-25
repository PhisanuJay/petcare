function parseJson(value, fallback = null) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function mapZone(row) {
  if (!row) return null;
  return {
    id: row.id,
    label: row.label,
    price: Number(row.price),
  };
}

export function mapClinic(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    address: row.address || '',
    districtId: row.district_id || '',
    subdistrictId: row.subdistrict_id || '',
    zoneId: row.zone_id || '',
    mapUrl: row.map_url || '',
  };
}

export function mapHotel(row) {
  return mapClinic(row);
}

export function mapBooking(row) {
  if (!row) return null;
  return {
    id: row.id,
    ownerId: row.owner_id,
    ownerName: row.owner_name || '',
    ownerPhone: row.owner_phone || '',
    petId: row.pet_id,
    petName: row.pet_name,
    petNotes: row.pet_notes || '',
    serviceType: row.service_type,
    fromZoneId: row.from_zone_id,
    toZoneId: row.to_zone_id,
    returnFromZoneId: row.return_from_zone_id,
    returnToZoneId: row.return_to_zone_id,
    fareZoneId: row.fare_zone_id,
    zoneId: row.fare_zone_id,
    estimatedQuote: parseJson(row.estimated_quote_json, null),
    finalQuote: parseJson(row.final_quote_json, null),
    status: row.status,
    paymentStatus: row.payment_status,
    paymentNote: row.payment_note || '',
    cancelRequest: parseJson(row.cancel_request_json, null),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapHistoryRow(row) {
  return {
    status: row.status,
    at: row.at,
    note: row.note || '',
  };
}

export function mapTrip(row, history = []) {
  if (!row) return null;
  return {
    id: row.id,
    bookingId: row.booking_id,
    type: row.type,
    driverId: row.driver_id,
    status: row.status,
    from: parseJson(row.from_json, null),
    to: parseJson(row.to_json, null),
    pickupTime: row.pickup_time,
    dropoffTime: row.dropoff_time,
    evidencePickup: parseJson(row.evidence_pickup_json, null),
    evidenceDropoff: parseJson(row.evidence_dropoff_json, null),
    statusHistory: history.map(mapHistoryRow),
    createdAt: row.created_at,
  };
}

export function mapNotification(row) {
  if (!row) return null;
  return {
    id: row.id,
    driverId: row.driver_id,
    type: row.type,
    title: row.title,
    body: row.body || '',
    tripId: row.trip_id,
    bookingId: row.booking_id,
    dedupeKey: row.dedupe_key,
    read: Boolean(row.read_at),
    createdAt: row.created_at,
  };
}

export function mapIssue(row) {
  if (!row) return null;
  return {
    id: row.id,
    tripId: row.trip_id,
    bookingId: row.booking_id || null,
    driverId: row.driver_id,
    reasonId: row.reason_id,
    message: row.message || '',
    status: 'open',
    createdAt: row.created_at,
  };
}

export function stringifyJson(value) {
  if (value == null) return null;
  return JSON.stringify(value);
}
