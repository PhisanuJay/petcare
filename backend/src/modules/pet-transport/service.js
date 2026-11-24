import { randomUUID } from 'node:crypto';
import { initTransportDb } from './db.js';
import { isRoundTrip, nextTripStatus, tripStatusMeta } from './constants.js';
import { quotePrice } from './pricing.js';

function db() {
  return initTransportDb();
}

function now() {
  return new Date().toISOString();
}

function id() {
  return randomUUID();
}

function parseJson(value, fallback = null) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function mapZone(row) {
  return { id: row.id, label: row.label, price: row.price };
}

function mapClinic(row) {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    districtId: row.district_id,
    subdistrictId: row.subdistrict_id,
    zoneId: row.zone_id,
    mapUrl: row.map_url || '',
  };
}

function mapHotel(row) {
  return mapClinic(row);
}

function mapBooking(row) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    ownerPhone: row.owner_phone,
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
    estimatedQuote: parseJson(row.estimated_quote_json),
    finalQuote: parseJson(row.final_quote_json),
    status: row.status,
    paymentStatus: row.payment_status,
    paymentNote: row.payment_note || '',
    cancelRequest: parseJson(row.cancel_request_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTrip(row, history = []) {
  return {
    id: row.id,
    bookingId: row.booking_id,
    type: row.type,
    driverId: row.driver_id,
    status: row.status,
    from: parseJson(row.from_json, {}),
    to: parseJson(row.to_json, {}),
    pickupTime: row.pickup_time,
    dropoffTime: row.dropoff_time,
    evidencePickup: parseJson(row.evidence_pickup_json),
    evidenceDropoff: parseJson(row.evidence_dropoff_json),
    statusHistory: history,
    createdAt: row.created_at,
  };
}

function tripHistory(tripId) {
  return db()
    .prepare('SELECT status, at, note FROM trip_status_history WHERE trip_id = ? ORDER BY id ASC')
    .all(tripId)
    .map((h) => ({ status: h.status, at: h.at, note: h.note || '' }));
}

function getZones() {
  return db().prepare('SELECT * FROM zones ORDER BY id').all().map(mapZone);
}

export function getCatalog() {
  const d = db();
  return {
    zones: getZones(),
    clinics: d.prepare('SELECT * FROM clinics ORDER BY name').all().map(mapClinic),
    hotels: d.prepare('SELECT * FROM hotels ORDER BY name').all().map(mapHotel),
  };
}

export function listBookings() {
  return db()
    .prepare('SELECT * FROM bookings ORDER BY created_at DESC')
    .all()
    .map(mapBooking);
}

export function getBooking(bookingId) {
  const row = db().prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
  if (!row) return null;
  const booking = mapBooking(row);
  const trips = listTrips({ bookingId });
  return { ...booking, trips };
}

export function listTrips({ bookingId, driverId } = {}) {
  const d = db();
  let rows;
  if (bookingId) {
    rows = d.prepare('SELECT * FROM trips WHERE booking_id = ? ORDER BY created_at ASC').all(bookingId);
  } else if (driverId) {
    rows = d.prepare('SELECT * FROM trips WHERE driver_id = ? ORDER BY pickup_time ASC').all(driverId);
  } else {
    rows = d.prepare('SELECT * FROM trips ORDER BY created_at DESC').all();
  }
  return rows.map((row) => mapTrip(row, tripHistory(row.id)));
}

export function getTrip(tripId) {
  const row = db().prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
  if (!row) return null;
  return mapTrip(row, tripHistory(row.id));
}

export function createBooking(input) {
  const from = { ...(input.from || {}) };
  const to = { ...(input.to || {}) };
  const returnFrom = input.returnFrom ? { ...input.returnFrom } : { ...to };
  const returnTo = input.returnTo ? { ...input.returnTo } : { ...from };

  if (!from.zoneId || !to.zoneId) {
    throw new Error('กรุณาเลือกจุดรับและจุดส่งให้ครบ (แขวงหรือสถานที่ในระบบ)');
  }
  if (isRoundTrip(input.serviceType) && (!returnFrom.zoneId || !returnTo.zoneId)) {
    throw new Error('กรุณาเลือกจุดรับ–ส่งเที่ยวกลับให้ครบ');
  }

  const zones = getZones();
  const estimate = quotePrice({
    fromZoneId: from.zoneId,
    toZoneId: to.zoneId,
    returnFromZoneId: returnFrom.zoneId,
    returnToZoneId: returnTo.zoneId,
    serviceType: input.serviceType,
    zones,
  });
  if (estimate.total == null) throw new Error('คำนวณราคาไม่สำเร็จ');

  const bookingId = id();
  const createdAt = now();
  const d = db();

  d.prepare(`
    INSERT INTO bookings (
      id, owner_id, owner_name, owner_phone, pet_id, pet_name, pet_notes, service_type,
      from_zone_id, to_zone_id, return_from_zone_id, return_to_zone_id, fare_zone_id,
      estimated_quote_json, final_quote_json, status, payment_status, payment_note,
      cancel_request_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'submitted', 'unpaid', '', NULL, ?, ?)
  `).run(
    bookingId,
    input.ownerId || null,
    input.ownerName || '',
    input.ownerPhone || '',
    input.petId || null,
    input.petName,
    input.petNotes || '',
    input.serviceType,
    from.zoneId,
    to.zoneId,
    isRoundTrip(input.serviceType) ? returnFrom.zoneId : null,
    isRoundTrip(input.serviceType) ? returnTo.zoneId : null,
    estimate.fareZoneId,
    JSON.stringify(estimate),
    createdAt,
    createdAt,
  );

  const trips = [];
  trips.push(insertTrip(d, {
    bookingId,
    type: 'pickup',
    from,
    to,
    pickupTime: input.outboundPickupTime || null,
    dropoffTime: input.outboundDropoffTime || null,
  }));

  if (isRoundTrip(input.serviceType)) {
    trips.push(insertTrip(d, {
      bookingId,
      type: 'dropoff',
      from: returnFrom,
      to: returnTo,
      pickupTime: input.returnPickupTime || null,
      dropoffTime: input.returnDropoffTime || null,
    }));
  }

  return { booking: getBooking(bookingId), trips };
}

function insertTrip(d, { bookingId, type, from, to, pickupTime, dropoffTime }) {
  const tripId = id();
  const createdAt = now();
  d.prepare(`
    INSERT INTO trips (
      id, booking_id, type, driver_id, status, from_json, to_json,
      pickup_time, dropoff_time, evidence_pickup_json, evidence_dropoff_json, created_at
    ) VALUES (?, ?, ?, NULL, 'assigned', ?, ?, ?, ?, NULL, NULL, ?)
  `).run(
    tripId,
    bookingId,
    type,
    JSON.stringify(from),
    JSON.stringify(to),
    pickupTime,
    dropoffTime,
    createdAt,
  );
  d.prepare(`
    INSERT INTO trip_status_history (trip_id, status, at, note)
    VALUES (?, 'assigned', ?, 'สร้างทริป')
  `).run(tripId, createdAt);
  return getTrip(tripId);
}

export function confirmPrice(bookingId, { fareZoneId, customPerTrip } = {}) {
  const booking = getBooking(bookingId);
  if (!booking) throw new Error('ไม่พบการจอง');
  const zones = getZones();
  const quote = quotePrice({
    fromZoneId: booking.fromZoneId,
    toZoneId: booking.toZoneId,
    returnFromZoneId: booking.returnFromZoneId,
    returnToZoneId: booking.returnToZoneId,
    serviceType: booking.serviceType,
    zones,
    fareZoneOverride: fareZoneId || booking.fareZoneId,
    customPerTrip: customPerTrip === '' || customPerTrip == null ? null : Number(customPerTrip),
  });
  if (quote.total == null) throw new Error('ต้องใส่ราคาก่อนยืนยัน');

  db().prepare(`
    UPDATE bookings
    SET fare_zone_id = ?, final_quote_json = ?, status = 'price_confirmed', updated_at = ?
    WHERE id = ?
  `).run(quote.fareZoneId, JSON.stringify(quote), now(), bookingId);

  return getBooking(bookingId);
}

export function assignDriver(tripId, driverId, driverLabel = '') {
  const d = db();
  const trip = d.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
  if (!trip) throw new Error('ไม่พบทริป');
  const booking = d.prepare('SELECT * FROM bookings WHERE id = ?').get(trip.booking_id);
  const prevDriverId = trip.driver_id;
  const petName = booking?.pet_name || 'สัตว์เลี้ยง';
  const at = now();

  if (prevDriverId && prevDriverId !== driverId) {
    pushNotification({
      driverId: prevDriverId,
      type: 'cancelled',
      title: 'งานถูกมอบหมายให้คนขับอื่น',
      body: `${petName} · เวลารับ ${formatWhen(trip.pickup_time)}`,
      tripId,
      bookingId: trip.booking_id,
    });
  }

  d.prepare('UPDATE trips SET driver_id = ?, status = ? WHERE id = ?')
    .run(driverId, 'assigned', tripId);
  d.prepare(`
    INSERT INTO trip_status_history (trip_id, status, at, note)
    VALUES (?, 'assigned', ?, ?)
  `).run(tripId, at, `มอบหมายคนขับ ${driverLabel || driverId}`);

  if (driverId && driverId !== prevDriverId) {
    pushNotification({
      driverId,
      type: 'assigned',
      title: 'มีงานใหม่ที่ Admin มอบหมาย',
      body: `${petName} · เวลารับ ${formatWhen(trip.pickup_time)}`,
      tripId,
      bookingId: trip.booking_id,
      dedupeKey: `assigned:${tripId}:${driverId}:${at.slice(0, 13)}`,
    });
  }

  if (booking) {
    const related = d.prepare('SELECT driver_id, status FROM trips WHERE booking_id = ?').all(booking.id);
    const allAssigned = related.every((t) => t.driver_id);
    let nextStatus = booking.status;
    if (allAssigned && ['price_confirmed', 'submitted', 'driver_assigned'].includes(booking.status)) {
      nextStatus = 'awaiting_payment';
    } else if (booking.status === 'price_confirmed' || booking.status === 'submitted') {
      nextStatus = 'driver_assigned';
    }
    d.prepare('UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?')
      .run(nextStatus, at, booking.id);
  }

  return getTrip(tripId);
}

export function adminMarkPaid(bookingId) {
  const row = db().prepare('SELECT id FROM bookings WHERE id = ?').get(bookingId);
  if (!row) throw new Error('ไม่พบการจอง');
  db().prepare(`
    UPDATE bookings SET payment_status = 'paid', status = 'paid', updated_at = ? WHERE id = ?
  `).run(now(), bookingId);
  return getBooking(bookingId);
}

export function ownerConfirmPayment(bookingId, note = '') {
  const row = db().prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
  if (!row) throw new Error('ไม่พบการจอง');
  if (!['awaiting_payment', 'driver_assigned', 'price_confirmed'].includes(row.status)) {
    throw new Error('ยังไม่ถึงขั้นตอนชำระเงิน');
  }
  db().prepare(`
    UPDATE bookings
    SET payment_status = 'owner_confirmed', payment_note = ?, status = 'awaiting_payment', updated_at = ?
    WHERE id = ?
  `).run(note, now(), bookingId);
  return getBooking(bookingId);
}

export function advanceTripStatus(tripId, note = '') {
  const d = db();
  const trip = d.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
  if (!trip) throw new Error('ไม่พบทริป');
  const booking = d.prepare('SELECT * FROM bookings WHERE id = ?').get(trip.booking_id);
  if (booking && booking.payment_status !== 'paid' && booking.status !== 'in_progress' && booking.status !== 'paid') {
    throw new Error('ต้องชำระเงินและ Admin ยืนยันก่อนเริ่มงาน');
  }
  const next = nextTripStatus(trip.status);
  if (!next) throw new Error('ทริปเสร็จแล้ว');
  if (trip.status === 'assigned' && booking?.payment_status !== 'paid') {
    throw new Error('รอ Admin Mark as Paid ก่อน');
  }

  const at = now();
  d.prepare('UPDATE trips SET status = ? WHERE id = ?').run(next.id, tripId);
  d.prepare(`
    INSERT INTO trip_status_history (trip_id, status, at, note) VALUES (?, ?, ?, ?)
  `).run(tripId, next.id, at, note || next.label);

  if (booking) {
    const related = d.prepare('SELECT status FROM trips WHERE booking_id = ?').all(booking.id);
    const allDone = related.every((t) => t.status === 'completed');
    const bookingStatus = allDone ? 'completed' : 'in_progress';
    d.prepare('UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?')
      .run(bookingStatus, at, booking.id);
  }

  return getTrip(tripId);
}

export function updateTripSchedule(tripId, { pickupTime, dropoffTime } = {}) {
  const d = db();
  const trip = d.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
  if (!trip) throw new Error('ไม่พบทริป');
  const booking = d.prepare('SELECT * FROM bookings WHERE id = ?').get(trip.booking_id);
  const prevPickup = trip.pickup_time;
  const nextPickup = pickupTime != null ? pickupTime : trip.pickup_time;
  const nextDropoff = dropoffTime != null ? dropoffTime : trip.dropoff_time;
  const at = now();

  d.prepare('UPDATE trips SET pickup_time = ?, dropoff_time = ? WHERE id = ?')
    .run(nextPickup, nextDropoff, tripId);
  d.prepare(`
    INSERT INTO trip_status_history (trip_id, status, at, note)
    VALUES (?, ?, ?, ?)
  `).run(tripId, trip.status, at, `เปลี่ยนเวลานัดรับเป็น ${formatWhen(nextPickup)}`);

  if (booking) {
    d.prepare('UPDATE bookings SET updated_at = ? WHERE id = ?').run(at, booking.id);
  }
  if (trip.driver_id && prevPickup !== nextPickup) {
    pushNotification({
      driverId: trip.driver_id,
      type: 'time_changed',
      title: 'มีการเปลี่ยนแปลงเวลานัดรับ',
      body: `${booking?.pet_name || 'สัตว์เลี้ยง'} · จาก ${formatWhen(prevPickup)} เป็น ${formatWhen(nextPickup)}`,
      tripId,
      bookingId: trip.booking_id,
    });
  }
  return getTrip(tripId);
}

export function attachEvidence(tripId, kind, dataUrl) {
  const trip = db().prepare('SELECT id FROM trips WHERE id = ?').get(tripId);
  if (!trip) throw new Error('ไม่พบทริป');
  const payload = JSON.stringify({ url: dataUrl, at: now() });
  if (kind === 'pickup') {
    db().prepare('UPDATE trips SET evidence_pickup_json = ? WHERE id = ?').run(payload, tripId);
  } else {
    db().prepare('UPDATE trips SET evidence_dropoff_json = ? WHERE id = ?').run(payload, tripId);
  }
  return getTrip(tripId);
}

export function reportIssue({ tripId, driverId, reasonId, message }) {
  const trip = db().prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
  if (!trip) throw new Error('ไม่พบทริป');
  const issueId = id();
  db().prepare(`
    INSERT INTO issues (id, trip_id, booking_id, driver_id, reason_id, message, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(issueId, tripId, trip.booking_id, driverId || trip.driver_id, reasonId || '', message || '', now());
  return { id: issueId };
}

export function listNotifications(driverId) {
  return db()
    .prepare('SELECT * FROM notifications WHERE driver_id = ? ORDER BY created_at DESC LIMIT 120')
    .all(driverId)
    .map(mapNotification);
}

export function markNotificationRead(notificationId) {
  db().prepare('UPDATE notifications SET read_at = ? WHERE id = ? AND read_at IS NULL')
    .run(now(), notificationId);
}

export function markAllNotificationsRead(driverId) {
  db().prepare('UPDATE notifications SET read_at = ? WHERE driver_id = ? AND read_at IS NULL')
    .run(now(), driverId);
}

function pushNotification({ driverId, type, title, body = '', tripId = null, bookingId = null, dedupeKey = null }) {
  if (!driverId) return;
  if (dedupeKey) {
    const exists = db().prepare('SELECT id FROM notifications WHERE dedupe_key = ?').get(dedupeKey);
    if (exists) return;
  }
  db().prepare(`
    INSERT INTO notifications (
      id, driver_id, type, title, body, trip_id, booking_id, dedupe_key, read_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
  `).run(id(), driverId, type, title, body, tripId, bookingId, dedupeKey, now());
}

function formatWhen(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function updateZones(zones) {
  const d = db();
  const upsert = d.prepare(`
    INSERT INTO zones (id, label, price) VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET label = excluded.label, price = excluded.price
  `);
  for (const z of zones || []) {
    upsert.run(String(z.id), z.label || `Zone ${z.id}`, Number(z.price) || 0);
  }
  return getZones();
}

export function addHotel({ name, address, districtId = 'chatuchak', subdistrictId = 'latyao', zoneId = '2', mapUrl = '' }) {
  const hotelId = id();
  db().prepare(`
    INSERT INTO hotels (id, name, address, district_id, subdistrict_id, zone_id, map_url)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(hotelId, name.trim(), address.trim(), districtId, subdistrictId, zoneId, mapUrl || null);
  return getCatalog().hotels.find((h) => h.id === hotelId);
}

export function removeHotel(hotelId) {
  db().prepare('DELETE FROM hotels WHERE id = ?').run(hotelId);
}

export function requestCancel(bookingId, reason) {
  const row = db().prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
  if (!row) throw new Error('ไม่พบการจอง');
  if (['cancelled', 'completed'].includes(row.status)) {
    throw new Error('ยกเลิกเองไม่ได้แล้ว ต้องติดต่อ Admin');
  }
  if (row.status === 'cancel_requested') throw new Error('มีคำขอยกเลิกอยู่แล้ว');
  const related = db().prepare('SELECT status FROM trips WHERE booking_id = ?').all(bookingId);
  const canCancel = related.every((t) => tripStatusMeta(t.status).step < 4);
  if (!canCancel) throw new Error('ยกเลิกเองไม่ได้แล้ว ต้องติดต่อ Admin');

  const cancelRequest = {
    reason,
    at: now(),
    status: 'pending',
  };
  db().prepare(`
    UPDATE bookings
    SET cancel_request_json = ?, status = 'cancel_requested', updated_at = ?
    WHERE id = ?
  `).run(JSON.stringify(cancelRequest), now(), bookingId);
  return getBooking(bookingId);
}

export function resolveCancel(bookingId, approve, adminNote = '') {
  const row = db().prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
  if (!row) throw new Error('ไม่พบการจอง');
  const cancelRequest = parseJson(row.cancel_request_json);
  if (!cancelRequest) throw new Error('ไม่มีคำขอยกเลิก');
  const at = now();
  cancelRequest.status = approve ? 'approved' : 'rejected';
  cancelRequest.adminNote = adminNote;
  cancelRequest.resolvedAt = at;
  db().prepare(`
    UPDATE bookings
    SET cancel_request_json = ?, status = ?, updated_at = ?
    WHERE id = ?
  `).run(JSON.stringify(cancelRequest), approve ? 'cancelled' : 'paid', at, bookingId);

  if (approve) {
    const related = db().prepare('SELECT * FROM trips WHERE booking_id = ? AND driver_id IS NOT NULL').all(bookingId);
    related.forEach((trip) => {
      pushNotification({
        driverId: trip.driver_id,
        type: 'cancelled',
        title: 'งานถูกยกเลิก',
        body: `${row.pet_name || 'สัตว์เลี้ยง'} · เวลารับ ${formatWhen(trip.pickup_time)}${adminNote ? ` — ${adminNote}` : ''}`,
        tripId: trip.id,
        bookingId,
        dedupeKey: `cancelled:${bookingId}:${trip.driver_id}:${at}`,
      });
    });
  }
  return getBooking(bookingId);
}

function mapNotification(n) {
  return {
    id: n.id,
    driverId: n.driver_id,
    type: n.type,
    title: n.title,
    body: n.body || '',
    tripId: n.trip_id,
    bookingId: n.booking_id,
    dedupeKey: n.dedupe_key,
    readAt: n.read_at,
    read: Boolean(n.read_at),
    createdAt: n.created_at,
  };
}

export function getSnapshot() {
  const catalog = getCatalog();
  const notifications = db()
    .prepare('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 200')
    .all()
    .map(mapNotification);
  return {
    ...catalog,
    bookings: listBookings(),
    trips: listTrips(),
    notifications,
    issues: db().prepare('SELECT * FROM issues ORDER BY created_at DESC').all().map((i) => ({
      id: i.id,
      tripId: i.trip_id,
      bookingId: i.booking_id,
      driverId: i.driver_id,
      reasonId: i.reason_id,
      message: i.message,
      createdAt: i.created_at,
      status: 'open',
    })),
  };
}

export { tripStatusMeta };
