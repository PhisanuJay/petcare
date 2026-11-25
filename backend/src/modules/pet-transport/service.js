import { newId, queryAll, queryOne, run, transaction } from './db.js';
import {
  mapBooking,
  mapClinic,
  mapHotel,
  mapIssue,
  mapNotification,
  mapTrip,
  mapZone,
  stringifyJson,
} from './mappers.js';
import { isRoundTrip, quotePrice } from './pricing.js';
import { resolveOtherService } from './serviceCatalog.js';
import { reseedsCatalog } from './migrate.js';

const UPCOMING_WINDOW_MS = 2 * 60 * 60 * 1000;
const MAX_NOTIFICATIONS = 120;

const TRIP_STATUSES = [
  { id: 'assigned', label: 'มอบหมายแล้ว', step: 1 },
  { id: 'en_route_pickup', label: 'กำลังไปรับ', step: 2 },
  { id: 'arrived_pickup', label: 'ถึงจุดรับ', step: 3 },
  { id: 'picked_up', label: 'รับสัตว์แล้ว', step: 4 },
  { id: 'in_transit', label: 'กำลังเดินทาง', step: 5 },
  { id: 'arrived_dropoff', label: 'ถึงจุดส่ง', step: 6 },
  { id: 'completed', label: 'ส่งสำเร็จ', step: 7 },
];

function tripStatusMeta(id) {
  return TRIP_STATUSES.find((s) => s.id === id) ?? TRIP_STATUSES[0];
}

function nextTripStatus(currentId) {
  const i = TRIP_STATUSES.findIndex((s) => s.id === currentId);
  if (i < 0 || i >= TRIP_STATUSES.length - 1) return null;
  return TRIP_STATUSES[i + 1];
}

function canOwnerRequestCancel(booking, trips) {
  if (!booking) return false;
  if (['cancelled', 'completed'].includes(booking.status)) return false;
  if (booking.status === 'cancel_requested') return false;
  const related = trips.filter((t) => t.bookingId === booking.id);
  return related.every((t) => tripStatusMeta(t.status).step < 4);
}

function formatNotifyWhen(iso) {
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

function listZones() {
  return queryAll('SELECT * FROM zones ORDER BY id').map(mapZone);
}

function listClinics() {
  return queryAll('SELECT * FROM clinics ORDER BY name').map(mapClinic);
}

function listHotels() {
  return queryAll('SELECT * FROM hotels ORDER BY name').map(mapHotel);
}

function listBookings() {
  return queryAll('SELECT * FROM bookings ORDER BY created_at DESC').map(mapBooking);
}

function historyForTrip(tripId) {
  return queryAll(
    'SELECT status, at, note FROM trip_status_history WHERE trip_id = ? ORDER BY id ASC',
    [tripId],
  );
}

function listTrips() {
  return queryAll('SELECT * FROM trips ORDER BY created_at ASC').map((row) =>
    mapTrip(row, historyForTrip(row.id)),
  );
}

function listIssues() {
  return queryAll('SELECT * FROM issues ORDER BY created_at DESC').map(mapIssue);
}

function listNotifications(driverId = null) {
  const rows = driverId
    ? queryAll(
      'SELECT * FROM notifications WHERE driver_id = ? ORDER BY created_at DESC',
      [driverId],
    )
    : queryAll('SELECT * FROM notifications ORDER BY created_at DESC');
  return rows.map(mapNotification);
}

function getBookingRow(id) {
  return queryOne('SELECT * FROM bookings WHERE id = ?', [id]);
}

function getTripRow(id) {
  return queryOne('SELECT * FROM trips WHERE id = ?', [id]);
}

function tripsForBooking(bookingId) {
  return queryAll('SELECT * FROM trips WHERE booking_id = ?', [bookingId]).map((row) =>
    mapTrip(row, historyForTrip(row.id)),
  );
}

function insertHistory(tripId, status, note = '') {
  run(
    'INSERT INTO trip_status_history (trip_id, status, at, note) VALUES (?, ?, ?, ?)',
    [tripId, status, new Date().toISOString(), note],
  );
}

function pushDriverNotification({
  driverId,
  type,
  title,
  body = '',
  tripId = null,
  bookingId = null,
  dedupeKey = null,
}) {
  if (!driverId) return;
  if (dedupeKey) {
    const existing = queryOne(
      'SELECT id FROM notifications WHERE dedupe_key = ? LIMIT 1',
      [dedupeKey],
    );
    if (existing) return;
  }
  run(
    `INSERT INTO notifications
      (id, driver_id, type, title, body, trip_id, booking_id, dedupe_key, read_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
    [newId(), driverId, type, title, body, tripId, bookingId, dedupeKey, new Date().toISOString()],
  );
  const count = queryOne('SELECT COUNT(*) AS c FROM notifications')?.c ?? 0;
  if (count > MAX_NOTIFICATIONS) {
    const overflow = count - MAX_NOTIFICATIONS;
    run(
      `DELETE FROM notifications WHERE id IN (
         SELECT id FROM notifications ORDER BY created_at ASC LIMIT ?
       )`,
      [overflow],
    );
  }
}

function insertTrip({ bookingId, type, from, to, pickupTime, dropoffTime }) {
  const id = newId();
  const now = new Date().toISOString();
  run(
    `INSERT INTO trips
      (id, booking_id, type, driver_id, status, from_json, to_json, pickup_time, dropoff_time,
       evidence_pickup_json, evidence_dropoff_json, created_at)
     VALUES (?, ?, ?, NULL, 'assigned', ?, ?, ?, ?, NULL, NULL, ?)`,
    [
      id,
      bookingId,
      type,
      stringifyJson(from),
      stringifyJson(to),
      pickupTime || null,
      dropoffTime || null,
      now,
    ],
  );
  insertHistory(id, 'assigned', 'สร้างทริป');
  return id;
}

export function getState() {
  return {
    zones: listZones(),
    clinics: listClinics(),
    hotels: listHotels(),
    bookings: listBookings(),
    trips: listTrips(),
    issues: listIssues(),
    notifications: listNotifications(),
    seeded: true,
  };
}

export function createBooking(input) {
  const zones = listZones();
  const from = { ...input.from };
  const to = { ...input.to };
  const returnFrom = input.returnFrom ? { ...input.returnFrom } : { ...to };
  const returnTo = input.returnTo ? { ...input.returnTo } : { ...from };

  if (!from.zoneId || !to.zoneId) {
    throw new Error('กรุณาเลือกจุดรับและจุดส่งให้ครบ (แขวงหรือสถานที่ในระบบ)');
  }
  if (isRoundTrip(input.serviceType) && (!returnFrom.zoneId || !returnTo.zoneId)) {
    throw new Error('กรุณาเลือกจุดรับ–ส่งเที่ยวกลับให้ครบ');
  }

  const estimate = quotePrice({
    fromZoneId: from.zoneId,
    toZoneId: to.zoneId,
    returnFromZoneId: returnFrom.zoneId,
    returnToZoneId: returnTo.zoneId,
    serviceType: input.serviceType,
    zones,
    otherService: null,
  });
  if (estimate.total == null) {
    throw new Error('คำนวณราคาไม่สำเร็จ');
  }

  const bookingId = newId();
  const now = new Date().toISOString();

  return transaction(() => {
    run(
      `INSERT INTO bookings (
         id, owner_id, owner_name, owner_phone, pet_id, pet_name, pet_notes, service_type,
         from_zone_id, to_zone_id, return_from_zone_id, return_to_zone_id, fare_zone_id,
         estimated_quote_json, final_quote_json, status, payment_status, payment_note,
         cancel_request_json, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'submitted', 'unpaid', '', NULL, ?, ?)`,
      [
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
        stringifyJson(estimate),
        now,
        now,
      ],
    );

    const tripIds = [
      insertTrip({
        bookingId,
        type: 'pickup',
        from,
        to,
        pickupTime: input.outboundPickupTime,
        dropoffTime: input.outboundDropoffTime,
      }),
    ];

    if (isRoundTrip(input.serviceType)) {
      tripIds.push(
        insertTrip({
          bookingId,
          type: 'dropoff',
          from: returnFrom,
          to: returnTo,
          pickupTime: input.returnPickupTime,
          dropoffTime: input.returnDropoffTime,
        }),
      );
    }

    const booking = mapBooking(getBookingRow(bookingId));
    const trips = tripIds.map((id) => mapTrip(getTripRow(id), historyForTrip(id)));
    return { booking, trips, state: getState() };
  });
}

export function setBookingOtherService(bookingId, { otherServiceId = null, hotelNights = 1 } = {}) {
  return transaction(() => {
    const row = getBookingRow(bookingId);
    if (!row) throw new Error('ไม่พบการจอง');
    const booking = mapBooking(row);
    if (['cancelled', 'completed'].includes(booking.status)) {
      throw new Error('ไม่สามารถเพิ่มบริการในสถานะนี้');
    }
    if (booking.paymentStatus === 'paid') {
      throw new Error('ชำระเงินแล้ว แก้บริการไม่ได้');
    }
    if (booking.serviceType === 'inbound') {
      throw new Error('รับกลับคิดเฉพาะค่ารถ ไม่เพิ่มบริการอื่น');
    }

    const trips = tripsForBooking(bookingId);
    const pickup = trips.find((t) => t.type === 'pickup') || trips[0];
    const facilityPlace = pickup?.to || null;
    const otherService = otherServiceId
      ? resolveOtherService({
        serviceType: booking.serviceType,
        place: facilityPlace,
        otherServiceId,
        hotelNights,
      })
      : null;
    if (otherServiceId && !otherService) {
      throw new Error('ไม่พบบริการที่เลือก');
    }

    const zones = listZones();
    const estimate = quotePrice({
      fromZoneId: booking.fromZoneId,
      toZoneId: booking.toZoneId,
      returnFromZoneId: booking.returnFromZoneId,
      returnToZoneId: booking.returnToZoneId,
      serviceType: booking.serviceType,
      zones,
      otherService,
    });
    if (estimate.total == null) throw new Error('คำนวณราคาไม่สำเร็จ');

    const now = new Date().toISOString();
    const nextStatus = ['submitted', 'price_confirmed', 'driver_assigned'].includes(booking.status)
      ? 'awaiting_payment'
      : booking.status;

    run(
      `UPDATE bookings SET estimated_quote_json = ?, final_quote_json = NULL, status = ?, updated_at = ?
       WHERE id = ?`,
      [stringifyJson(estimate), nextStatus, now, bookingId],
    );
    return { booking: mapBooking(getBookingRow(bookingId)), state: getState() };
  });
}

export function confirmPrice(bookingId, { fareZoneId, customPerTrip } = {}) {
  return transaction(() => {
    const row = getBookingRow(bookingId);
    if (!row) throw new Error('ไม่พบการจอง');
    const b = mapBooking(row);
    const zones = listZones();
    const override = fareZoneId || b.fareZoneId || b.zoneId;
    const quote = quotePrice({
      fromZoneId: b.fromZoneId || b.estimatedQuote?.fromZoneId,
      toZoneId: b.toZoneId || b.estimatedQuote?.toZoneId,
      returnFromZoneId: b.returnFromZoneId || b.estimatedQuote?.returnFromZoneId,
      returnToZoneId: b.returnToZoneId || b.estimatedQuote?.returnToZoneId,
      serviceType: b.serviceType,
      zones,
      fareZoneOverride: override,
      customPerTrip: customPerTrip === '' || customPerTrip == null ? null : Number(customPerTrip),
      otherService: b.estimatedQuote?.otherService || null,
    });
    if (quote.total == null) throw new Error('ต้องใส่ราคาก่อนยืนยัน');
    const now = new Date().toISOString();
    run(
      `UPDATE bookings SET fare_zone_id = ?, final_quote_json = ?, status = 'price_confirmed', updated_at = ?
       WHERE id = ?`,
      [quote.fareZoneId, stringifyJson(quote), now, bookingId],
    );
    return { state: getState() };
  });
}

export function assignDriver(tripId, driverId, driverLabel = '') {
  return transaction(() => {
    const tripRow = getTripRow(tripId);
    if (!tripRow) throw new Error('ไม่พบทริป');
    const trip = mapTrip(tripRow, historyForTrip(tripId));
    const bookingRow = getBookingRow(trip.bookingId);
    const booking = mapBooking(bookingRow);
    const prevDriverId = trip.driverId;
    const petName = booking?.petName || 'สัตว์เลี้ยง';

    if (prevDriverId && prevDriverId !== driverId) {
      pushDriverNotification({
        driverId: prevDriverId,
        type: 'cancelled',
        title: 'งานถูกมอบหมายให้คนขับอื่น',
        body: `${petName} · เวลารับ ${formatNotifyWhen(trip.pickupTime)}`,
        tripId: trip.id,
        bookingId: trip.bookingId,
      });
    }

    run(`UPDATE trips SET driver_id = ?, status = 'assigned' WHERE id = ?`, [driverId, tripId]);
    insertHistory(tripId, 'assigned', `มอบหมายคนขับ ${driverLabel || driverId}`);

    if (driverId && driverId !== prevDriverId) {
      pushDriverNotification({
        driverId,
        type: 'assigned',
        title: 'มีงานใหม่ที่ Admin มอบหมาย',
        body: `${petName} · เวลารับ ${formatNotifyWhen(trip.pickupTime)}`,
        tripId: trip.id,
        bookingId: trip.bookingId,
        dedupeKey: `assigned:${trip.id}:${driverId}:${new Date().toISOString().slice(0, 13)}`,
      });
    }

    if (booking) {
      const related = tripsForBooking(booking.id);
      const allAssigned = related.every((t) => (t.id === tripId ? driverId : t.driverId));
      let nextStatus = booking.status;
      if (allAssigned && ['price_confirmed', 'submitted', 'driver_assigned'].includes(booking.status)) {
        nextStatus = 'awaiting_payment';
      } else if (booking.status === 'price_confirmed' || booking.status === 'submitted') {
        nextStatus = 'driver_assigned';
      }
      run('UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?', [
        nextStatus,
        new Date().toISOString(),
        booking.id,
      ]);
    }

    return { state: getState() };
  });
}

export function updateTripSchedule(tripId, { pickupTime, dropoffTime } = {}) {
  return transaction(() => {
    const tripRow = getTripRow(tripId);
    if (!tripRow) throw new Error('ไม่พบทริป');
    const trip = mapTrip(tripRow, historyForTrip(tripId));
    const booking = mapBooking(getBookingRow(trip.bookingId));
    const prevPickup = trip.pickupTime;
    const nextPickup = pickupTime != null ? pickupTime : trip.pickupTime;
    const nextDropoff = dropoffTime != null ? dropoffTime : trip.dropoffTime;

    run('UPDATE trips SET pickup_time = ?, dropoff_time = ? WHERE id = ?', [
      nextPickup,
      nextDropoff,
      tripId,
    ]);
    insertHistory(tripId, trip.status, `เปลี่ยนเวลานัดรับเป็น ${formatNotifyWhen(nextPickup)}`);
    if (booking) {
      run('UPDATE bookings SET updated_at = ? WHERE id = ?', [new Date().toISOString(), booking.id]);
    }
    if (trip.driverId && prevPickup !== nextPickup) {
      pushDriverNotification({
        driverId: trip.driverId,
        type: 'time_changed',
        title: 'มีการเปลี่ยนแปลงเวลานัดรับ',
        body: `${booking?.petName || 'สัตว์เลี้ยง'} · จาก ${formatNotifyWhen(prevPickup)} เป็น ${formatNotifyWhen(nextPickup)}`,
        tripId: trip.id,
        bookingId: trip.bookingId,
      });
    }
    return { state: getState() };
  });
}

export function ownerConfirmPayment(bookingId, note = '') {
  return transaction(() => {
    const row = getBookingRow(bookingId);
    if (!row) throw new Error('ไม่พบการจอง');
    const b = mapBooking(row);
    if (!['submitted', 'awaiting_payment', 'driver_assigned', 'price_confirmed'].includes(b.status)) {
      throw new Error('ยังไม่ถึงขั้นตอนชำระเงิน');
    }
    run(
      `UPDATE bookings SET payment_status = 'owner_confirmed', payment_note = ?,
         status = 'awaiting_payment', updated_at = ? WHERE id = ?`,
      [note || '', new Date().toISOString(), bookingId],
    );
    return { state: getState() };
  });
}

export function adminMarkPaid(bookingId) {
  return transaction(() => {
    const row = getBookingRow(bookingId);
    if (!row) throw new Error('ไม่พบการจอง');
    run(
      `UPDATE bookings SET payment_status = 'paid', status = 'paid', updated_at = ? WHERE id = ?`,
      [new Date().toISOString(), bookingId],
    );
    return { state: getState() };
  });
}

export function advanceTripStatus(tripId, note = '') {
  return transaction(() => {
    const tripRow = getTripRow(tripId);
    if (!tripRow) throw new Error('ไม่พบทริป');
    const trip = mapTrip(tripRow, historyForTrip(tripId));
    const booking = mapBooking(getBookingRow(trip.bookingId));
    if (
      booking
      && booking.paymentStatus !== 'paid'
      && booking.status !== 'in_progress'
      && booking.status !== 'paid'
    ) {
      throw new Error('ต้องชำระเงินและ Admin ยืนยันก่อนเริ่มงาน');
    }
    const next = nextTripStatus(trip.status);
    if (!next) throw new Error('ทริปเสร็จแล้ว');
    if (trip.status === 'assigned' && booking?.paymentStatus !== 'paid') {
      throw new Error('รอ Admin Mark as Paid ก่อน');
    }

    run('UPDATE trips SET status = ? WHERE id = ?', [next.id, tripId]);
    insertHistory(tripId, next.id, note || next.label);

    if (booking) {
      let bookingStatus = next.id === 'completed' ? booking.status : 'in_progress';
      const related = tripsForBooking(booking.id).map((t) =>
        (t.id === tripId ? { ...t, status: next.id } : t),
      );
      if (related.every((t) => t.status === 'completed')) bookingStatus = 'completed';
      run('UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?', [
        bookingStatus,
        new Date().toISOString(),
        booking.id,
      ]);
    }

    return { state: getState() };
  });
}

export function attachEvidence(tripId, kind, dataUrl) {
  return transaction(() => {
    const tripRow = getTripRow(tripId);
    if (!tripRow) throw new Error('ไม่พบทริป');
    const payload = stringifyJson({ url: dataUrl, at: new Date().toISOString() });
    if (kind === 'pickup') {
      run('UPDATE trips SET evidence_pickup_json = ? WHERE id = ?', [payload, tripId]);
    } else {
      run('UPDATE trips SET evidence_dropoff_json = ? WHERE id = ?', [payload, tripId]);
    }
    return { state: getState() };
  });
}

export function requestCancel(bookingId, reason) {
  return transaction(() => {
    const row = getBookingRow(bookingId);
    if (!row) throw new Error('ไม่พบการจอง');
    const booking = mapBooking(row);
    const trips = tripsForBooking(bookingId);
    if (!canOwnerRequestCancel(booking, trips)) {
      throw new Error('ยกเลิกเองไม่ได้แล้ว ต้องติดต่อ Admin');
    }
    const cancelRequest = { reason, at: new Date().toISOString(), status: 'pending' };
    run(
      `UPDATE bookings SET cancel_request_json = ?, status = 'cancel_requested', updated_at = ?
       WHERE id = ?`,
      [stringifyJson(cancelRequest), new Date().toISOString(), bookingId],
    );
    return { state: getState() };
  });
}

export function resolveCancel(bookingId, approve, adminNote = '') {
  return transaction(() => {
    const row = getBookingRow(bookingId);
    if (!row) throw new Error('ไม่พบการจอง');
    const booking = mapBooking(row);
    if (!booking.cancelRequest) throw new Error('ไม่มีคำขอยกเลิก');
    const cancelRequest = {
      ...booking.cancelRequest,
      status: approve ? 'approved' : 'rejected',
      adminNote,
      resolvedAt: new Date().toISOString(),
    };
    run(
      `UPDATE bookings SET cancel_request_json = ?, status = ?, updated_at = ? WHERE id = ?`,
      [
        stringifyJson(cancelRequest),
        approve ? 'cancelled' : 'paid',
        new Date().toISOString(),
        bookingId,
      ],
    );
    if (approve) {
      tripsForBooking(bookingId)
        .filter((t) => t.driverId)
        .forEach((trip) => {
          pushDriverNotification({
            driverId: trip.driverId,
            type: 'cancelled',
            title: 'งานถูกยกเลิก',
            body: `${booking.petName || 'สัตว์เลี้ยง'} · เวลารับ ${formatNotifyWhen(trip.pickupTime)}${adminNote ? ` — ${adminNote}` : ''}`,
            tripId: trip.id,
            bookingId,
            dedupeKey: `cancelled:${bookingId}:${trip.driverId}:${cancelRequest.resolvedAt}`,
          });
        });
    }
    return { state: getState() };
  });
}

export function reportIssue({ tripId, driverId, reasonId, message }) {
  return transaction(() => {
    const trip = getTripRow(tripId);
    if (!trip) throw new Error('ไม่พบทริป');
    run(
      `INSERT INTO issues (id, trip_id, booking_id, driver_id, reason_id, message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        newId(),
        tripId,
        trip.booking_id,
        driverId || null,
        reasonId || null,
        message || '',
        new Date().toISOString(),
      ],
    );
    return { state: getState() };
  });
}

export function updateZones(zones) {
  return transaction(() => {
    for (const z of zones || []) {
      run(
        `INSERT INTO zones (id, label, price) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET label = excluded.label, price = excluded.price`,
        [z.id, z.label, Number(z.price)],
      );
    }
    return { state: getState() };
  });
}

export function addHotel({ name, address }) {
  return transaction(() => {
    const id = newId();
    run(
      `INSERT INTO hotels (id, name, address, district_id, subdistrict_id, zone_id, map_url)
       VALUES (?, ?, ?, NULL, NULL, NULL, NULL)`,
      [id, String(name || '').trim(), String(address || '').trim()],
    );
    return { state: getState() };
  });
}

export function removeHotel(id) {
  return transaction(() => {
    run('DELETE FROM hotels WHERE id = ?', [id]);
    return { state: getState() };
  });
}

export function markNotificationRead(notificationId) {
  run('UPDATE notifications SET read_at = ? WHERE id = ? AND read_at IS NULL', [
    new Date().toISOString(),
    notificationId,
  ]);
  return { state: getState() };
}

export function markAllNotificationsRead(driverId) {
  run('UPDATE notifications SET read_at = ? WHERE driver_id = ? AND read_at IS NULL', [
    new Date().toISOString(),
    driverId,
  ]);
  return { state: getState() };
}

export function ensureUpcomingReminders(driverId) {
  if (!driverId) return { state: getState() };
  const now = Date.now();
  const trips = listTrips().filter((t) => t.driverId === driverId && t.status !== 'completed');
  const bookings = listBookings();
  const notifications = listNotifications(driverId);

  return transaction(() => {
    trips.forEach((trip) => {
      const booking = bookings.find((b) => b.id === trip.bookingId);
      if (!booking || booking.status === 'cancelled') return;
      const at = new Date(trip.pickupTime).getTime();
      if (Number.isNaN(at)) return;
      const delta = at - now;
      if (delta <= 0 || delta > UPCOMING_WINDOW_MS) return;
      const hourKey = new Date(trip.pickupTime).toISOString().slice(0, 13);
      const dedupeKey = `upcoming:${trip.id}:${hourKey}`;
      if (notifications.some((n) => n.dedupeKey === dedupeKey)) return;
      pushDriverNotification({
        driverId,
        type: 'upcoming',
        title: 'แจ้งเตือนงานที่กำลังจะถึง',
        body: `${booking.petName || 'สัตว์เลี้ยง'} · นัดรับ ${formatNotifyWhen(trip.pickupTime)}`,
        tripId: trip.id,
        bookingId: trip.bookingId,
        dedupeKey,
      });
    });
    return { state: getState() };
  });
}

export function resetDemo() {
  return transaction(() => {
    execSafe('DELETE FROM trip_status_history');
    execSafe('DELETE FROM notifications');
    execSafe('DELETE FROM issues');
    execSafe('DELETE FROM trips');
    execSafe('DELETE FROM bookings');
    reseedsCatalog();
    return { state: getState() };
  });
}

function execSafe(sql) {
  run(sql);
}

export function purgeDemoDriverJobs() {
  return transaction(() => {
    const demoBookings = queryAll(
      `SELECT id FROM bookings WHERE id LIKE 'demo-booking-%'`,
    ).map((r) => r.id);
    const demoTrips = queryAll(`SELECT id FROM trips WHERE id LIKE 'demo-trip-%'`).map((r) => r.id);
    for (const id of demoTrips) {
      run('DELETE FROM trip_status_history WHERE trip_id = ?', [id]);
      run('DELETE FROM issues WHERE trip_id = ?', [id]);
      run('DELETE FROM notifications WHERE trip_id = ?', [id]);
      run('DELETE FROM trips WHERE id = ?', [id]);
    }
    for (const id of demoBookings) {
      run('DELETE FROM notifications WHERE booking_id = ?', [id]);
      run('DELETE FROM bookings WHERE id = ?', [id]);
    }
    return { state: getState() };
  });
}

export function notificationsForDriver(driverId) {
  return listNotifications(driverId);
}
