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
import { SEED_HOTEL_ROOM_PRICES, upsertHotelRoom, upsertZone } from './migrate.js';

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

async function notifyCancelledDrivers(bookingId, booking, adminNote, resolvedAt) {
  const trips = await tripsForBooking(bookingId);
  for (const trip of trips.filter((t) => t.driverId)) {
    await pushDriverNotification({
      driverId: trip.driverId,
      type: 'cancelled',
      title: 'งานถูกยกเลิก',
      body: `${booking.petName || 'สัตว์เลี้ยง'} · เวลารับ ${formatNotifyWhen(trip.pickupTime)}${adminNote ? ` — ${adminNote}` : ''}`,
      tripId: trip.id,
      bookingId,
      dedupeKey: `cancelled:${bookingId}:${trip.driverId}:${resolvedAt}`,
    });
  }
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

async function listZones() {
  return (await queryAll('SELECT * FROM dbo.zones ORDER BY id')).map(mapZone);
}

async function listClinics() {
  return (await queryAll('SELECT * FROM dbo.clinics ORDER BY name')).map(mapClinic);
}

async function listHotels() {
  return (await queryAll('SELECT * FROM dbo.hotels ORDER BY name')).map(mapHotel);
}

export async function getHotelRoomPrices() {
  return (await queryAll(
    'SELECT room_id AS id, label, price FROM dbo.hotel_room_prices ORDER BY sort_order',
  )).map((room) => ({ ...room, price: Number(room.price) }));
}

async function listBookings() {
  return (await queryAll('SELECT * FROM dbo.bookings ORDER BY created_at DESC')).map(mapBooking);
}

async function historyForTrip(tripId) {
  return queryAll(
    'SELECT status, at, note FROM dbo.trip_status_history WHERE trip_id = ? ORDER BY id ASC',
    [tripId],
  );
}

async function listTrips() {
  const rows = await queryAll('SELECT * FROM dbo.trips ORDER BY created_at ASC');
  const trips = [];
  for (const row of rows) {
    trips.push(mapTrip(row, await historyForTrip(row.id)));
  }
  return trips;
}

async function listIssues() {
  return (await queryAll('SELECT * FROM dbo.issues ORDER BY created_at DESC')).map(mapIssue);
}

async function listNotifications(driverId = null) {
  const rows = driverId
    ? await queryAll(
      'SELECT * FROM dbo.notifications WHERE driver_id = ? ORDER BY created_at DESC',
      [driverId],
    )
    : await queryAll('SELECT * FROM dbo.notifications ORDER BY created_at DESC');
  return rows.map(mapNotification);
}

async function getBookingRow(id) {
  return queryOne('SELECT * FROM dbo.bookings WHERE id = ?', [id]);
}

async function getTripRow(id) {
  return queryOne('SELECT * FROM dbo.trips WHERE id = ?', [id]);
}

async function tripsForBooking(bookingId) {
  const rows = await queryAll('SELECT * FROM dbo.trips WHERE booking_id = ?', [bookingId]);
  const trips = [];
  for (const row of rows) {
    trips.push(mapTrip(row, await historyForTrip(row.id)));
  }
  return trips;
}

async function insertHistory(tripId, status, note = '') {
  await run(
    'INSERT INTO dbo.trip_status_history (trip_id, status, at, note) VALUES (?, ?, ?, ?)',
    [tripId, status, new Date().toISOString(), note],
  );
}

async function pushDriverNotification({
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
    const existing = await queryOne(
      'SELECT TOP 1 id FROM dbo.notifications WHERE dedupe_key = ?',
      [dedupeKey],
    );
    if (existing) return;
  }
  await run(
    `INSERT INTO dbo.notifications
      (id, driver_id, type, title, body, trip_id, booking_id, dedupe_key, read_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
    [newId(), driverId, type, title, body, tripId, bookingId, dedupeKey, new Date().toISOString()],
  );
  const count = Number((await queryOne('SELECT COUNT(*) AS c FROM dbo.notifications'))?.c ?? 0);
  if (count > MAX_NOTIFICATIONS) {
    const overflow = count - MAX_NOTIFICATIONS;
    await run(
      `DELETE FROM dbo.notifications WHERE id IN (
         SELECT TOP (${overflow}) id FROM dbo.notifications ORDER BY created_at ASC
       )`,
    );
  }
}

async function insertTrip({ bookingId, type, from, to, pickupTime, dropoffTime }) {
  const id = newId();
  const now = new Date().toISOString();
  await run(
    `INSERT INTO dbo.trips
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
  await insertHistory(id, 'assigned', 'สร้างทริป');
  return id;
}

export async function getState({ includePaymentDetails = false } = {}) {
  const bookings = await listBookings();
  return {
    zones: await listZones(),
    hotelRoomPrices: await getHotelRoomPrices(),
    clinics: await listClinics(),
    hotels: await listHotels(),
    bookings: includePaymentDetails
      ? bookings
      : bookings.map((booking) => ({ ...booking, paymentSlip: '' })),
    trips: await listTrips(),
    issues: await listIssues(),
    notifications: await listNotifications(),
    seeded: true,
  };
}

export async function getPricing() {
  return {
    zones: await listZones(),
    hotelRoomPrices: await getHotelRoomPrices(),
  };
}

export async function createBooking(input) {
  const zones = await listZones();
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

  return transaction(async () => {
    await run(
      `INSERT INTO dbo.bookings (
         id, owner_id, owner_name, owner_phone, pet_id, pet_name, pet_species, pet_notes, service_type,
         from_zone_id, to_zone_id, return_from_zone_id, return_to_zone_id, fare_zone_id,
         estimated_quote_json, final_quote_json, status, payment_status, payment_note,
         cancel_request_json, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'submitted', 'unpaid', '', NULL, ?, ?)`,
      [
        bookingId,
        input.ownerId || null,
        input.ownerName || '',
        input.ownerPhone || '',
        input.petId || null,
        input.petName,
        input.petSpecies || '',
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
      await insertTrip({
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
        await insertTrip({
          bookingId,
          type: 'dropoff',
          from: returnFrom,
          to: returnTo,
          pickupTime: input.returnPickupTime,
          dropoffTime: input.returnDropoffTime,
        }),
      );
    }

    const booking = mapBooking(await getBookingRow(bookingId));
    const trips = [];
    for (const id of tripIds) {
      trips.push(mapTrip(await getTripRow(id), await historyForTrip(id)));
    }
    return { booking, trips, state: await getState() };
  });
}

export async function setBookingOtherService(bookingId, { otherServiceId = null, hotelNights = 1 } = {}) {
  return transaction(async () => {
    const row = await getBookingRow(bookingId);
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

    const trips = await tripsForBooking(bookingId);
    const pickup = trips.find((t) => t.type === 'pickup') || trips[0];
    const facilityPlace = pickup?.to || null;
    const otherService = otherServiceId
      ? resolveOtherService({
        serviceType: booking.serviceType,
        place: facilityPlace,
        otherServiceId,
        hotelNights,
        hotelRooms: await getHotelRoomPrices(),
      })
      : null;
    if (otherServiceId && !otherService) {
      throw new Error('ไม่พบบริการที่เลือก');
    }

    const zones = await listZones();
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

    await run(
      `UPDATE dbo.bookings SET estimated_quote_json = ?, final_quote_json = NULL, status = ?, updated_at = ?
       WHERE id = ?`,
      [stringifyJson(estimate), nextStatus, now, bookingId],
    );
    return { booking: mapBooking(await getBookingRow(bookingId)), state: await getState() };
  });
}

export async function confirmPrice(bookingId, { fareZoneId, customPerTrip } = {}) {
  return transaction(async () => {
    const row = await getBookingRow(bookingId);
    if (!row) throw new Error('ไม่พบการจอง');
    const b = mapBooking(row);
    const zones = await listZones();
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
    await run(
      `UPDATE dbo.bookings SET fare_zone_id = ?, final_quote_json = ?, status = 'price_confirmed', updated_at = ?
       WHERE id = ?`,
      [quote.fareZoneId, stringifyJson(quote), now, bookingId],
    );
    return { state: await getState() };
  });
}

export async function assignDriver(tripId, driverId, driverLabel = '') {
  return transaction(async () => {
    const tripRow = await getTripRow(tripId);
    if (!tripRow) throw new Error('ไม่พบทริป');
    const trip = mapTrip(tripRow, await historyForTrip(tripId));
    const bookingRow = await getBookingRow(trip.bookingId);
    const booking = mapBooking(bookingRow);
    if (booking?.paymentStatus !== 'paid') {
      throw new Error('รอฝ่ายบัญชียืนยันการชำระเงินก่อนมอบหมายคนขับ');
    }
    const prevDriverId = trip.driverId;
    const petName = booking?.petName || 'สัตว์เลี้ยง';

    if (prevDriverId && prevDriverId !== driverId) {
      await pushDriverNotification({
        driverId: prevDriverId,
        type: 'cancelled',
        title: 'งานถูกมอบหมายให้คนขับอื่น',
        body: `${petName} · เวลารับ ${formatNotifyWhen(trip.pickupTime)}`,
        tripId: trip.id,
        bookingId: trip.bookingId,
      });
    }

    await run(`UPDATE dbo.trips SET driver_id = ?, status = 'assigned' WHERE id = ?`, [driverId, tripId]);
    await insertHistory(tripId, 'assigned', `มอบหมายคนขับ ${driverLabel || driverId}`);

    if (driverId && driverId !== prevDriverId) {
      await pushDriverNotification({
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
      const related = await tripsForBooking(booking.id);
      const allAssigned = related.every((t) => (t.id === tripId ? driverId : t.driverId));
      let nextStatus = booking.status;
      if (allAssigned && ['price_confirmed', 'submitted', 'driver_assigned'].includes(booking.status)) {
        nextStatus = 'awaiting_payment';
      } else if (booking.status === 'price_confirmed' || booking.status === 'submitted') {
        nextStatus = 'driver_assigned';
      }
      await run('UPDATE dbo.bookings SET status = ?, updated_at = ? WHERE id = ?', [
        nextStatus,
        new Date().toISOString(),
        booking.id,
      ]);
    }

    return { state: await getState() };
  });
}

export async function updateTripSchedule(tripId, { pickupTime, dropoffTime } = {}) {
  return transaction(async () => {
    const tripRow = await getTripRow(tripId);
    if (!tripRow) throw new Error('ไม่พบทริป');
    const trip = mapTrip(tripRow, await historyForTrip(tripId));
    const booking = mapBooking(await getBookingRow(trip.bookingId));
    const prevPickup = trip.pickupTime;
    const nextPickup = pickupTime != null ? pickupTime : trip.pickupTime;
    const nextDropoff = dropoffTime != null ? dropoffTime : trip.dropoffTime;

    await run('UPDATE dbo.trips SET pickup_time = ?, dropoff_time = ? WHERE id = ?', [
      nextPickup,
      nextDropoff,
      tripId,
    ]);
    await insertHistory(tripId, trip.status, `เปลี่ยนเวลานัดรับเป็น ${formatNotifyWhen(nextPickup)}`);
    if (booking) {
      await run('UPDATE dbo.bookings SET updated_at = ? WHERE id = ?', [new Date().toISOString(), booking.id]);
    }
    if (trip.driverId && prevPickup !== nextPickup) {
      await pushDriverNotification({
        driverId: trip.driverId,
        type: 'time_changed',
        title: 'มีการเปลี่ยนแปลงเวลานัดรับ',
        body: `${booking?.petName || 'สัตว์เลี้ยง'} · จาก ${formatNotifyWhen(prevPickup)} เป็น ${formatNotifyWhen(nextPickup)}`,
        tripId: trip.id,
        bookingId: trip.bookingId,
      });
    }
    return { state: await getState() };
  });
}

export async function ownerConfirmPayment(bookingId, slip) {
  return transaction(async () => {
    const row = await getBookingRow(bookingId);
    if (!row) throw new Error('ไม่พบการจอง');
    const b = mapBooking(row);
    if (!['submitted', 'awaiting_payment', 'driver_assigned', 'price_confirmed'].includes(b.status)) {
      throw new Error('ยังไม่ถึงขั้นตอนชำระเงิน');
    }
    if (b.paymentStatus === 'owner_confirmed') {
      throw new Error('ส่งสลิปแล้ว กรุณารอฝ่ายบัญชีตรวจสอบ');
    }
    if (typeof slip !== 'string' || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(slip)) {
      throw new Error('กรุณาแนบสลิปเป็นไฟล์รูปภาพ');
    }
    if (slip.length > 8 * 1024 * 1024) {
      throw new Error('ไฟล์สลิปมีขนาดใหญ่เกินไป กรุณาเลือกรูปที่เล็กลง');
    }
    await run(
      `UPDATE dbo.bookings SET payment_status = 'owner_confirmed', payment_note = '', payment_slip = ?,
         status = 'awaiting_payment', updated_at = ? WHERE id = ?`,
      [slip, new Date().toISOString(), bookingId],
    );
    return { state: await getState() };
  });
}

export async function approveTransportPayment(bookingId) {
  return transaction(async () => {
    const row = await getBookingRow(bookingId);
    if (!row) throw new Error('ไม่พบการจอง');
    const booking = mapBooking(row);
    if (booking.status === 'cancelled') throw new Error('รายการนี้ถูกยกเลิกแล้ว');
    if (booking.paymentStatus !== 'owner_confirmed' || !booking.paymentSlip) {
      throw new Error('ยังไม่มีสลิปที่รอตรวจสอบ');
    }
    await run(
      `UPDATE dbo.bookings SET payment_status = 'paid', status = 'paid', updated_at = ? WHERE id = ?`,
      [new Date().toISOString(), bookingId],
    );
    return { state: await getState({ includePaymentDetails: true }) };
  });
}

export async function rejectTransportPayment(bookingId, note = '') {
  return transaction(async () => {
    const row = await getBookingRow(bookingId);
    if (!row) throw new Error('ไม่พบการจอง');
    const booking = mapBooking(row);
    if (booking.status === 'cancelled') throw new Error('รายการนี้ถูกยกเลิกแล้ว');
    if (booking.paymentStatus !== 'owner_confirmed' || !booking.paymentSlip) {
      throw new Error('ยังไม่มีสลิปที่รอตรวจสอบ');
    }
    await run(
      `UPDATE dbo.bookings SET payment_status = 'unpaid', payment_note = ?, status = 'awaiting_payment',
         updated_at = ? WHERE id = ?`,
      [String(note || '').trim().slice(0, 500), new Date().toISOString(), bookingId],
    );
    return { state: await getState({ includePaymentDetails: true }) };
  });
}

export async function advanceTripStatus(tripId, note = '') {
  return transaction(async () => {
    const tripRow = await getTripRow(tripId);
    if (!tripRow) throw new Error('ไม่พบทริป');
    const trip = mapTrip(tripRow, await historyForTrip(tripId));
    const booking = mapBooking(await getBookingRow(trip.bookingId));
    if (
      booking
      && booking.paymentStatus !== 'paid'
      && booking.status !== 'in_progress'
      && booking.status !== 'paid'
    ) {
      throw new Error('ต้องชำระเงินและฝ่ายบัญชียืนยันก่อนเริ่มงาน');
    }
    const next = nextTripStatus(trip.status);
    if (!next) throw new Error('ทริปเสร็จแล้ว');
    if (trip.status === 'assigned' && booking?.paymentStatus !== 'paid') {
      throw new Error('รอฝ่ายบัญชียืนยันชำระเงินก่อน');
    }

    await run('UPDATE dbo.trips SET status = ? WHERE id = ?', [next.id, tripId]);
    await insertHistory(tripId, next.id, note || next.label);

    if (booking) {
      let bookingStatus = next.id === 'completed' ? booking.status : 'in_progress';
      const related = (await tripsForBooking(booking.id)).map((t) =>
        (t.id === tripId ? { ...t, status: next.id } : t),
      );
      if (related.every((t) => t.status === 'completed')) bookingStatus = 'completed';
      await run('UPDATE dbo.bookings SET status = ?, updated_at = ? WHERE id = ?', [
        bookingStatus,
        new Date().toISOString(),
        booking.id,
      ]);
    }

    return { state: await getState() };
  });
}

export async function attachEvidence(tripId, kind, dataUrl) {
  return transaction(async () => {
    const tripRow = await getTripRow(tripId);
    if (!tripRow) throw new Error('ไม่พบทริป');
    const payload = stringifyJson({ url: dataUrl, at: new Date().toISOString() });
    if (kind === 'pickup') {
      await run('UPDATE dbo.trips SET evidence_pickup_json = ? WHERE id = ?', [payload, tripId]);
    } else {
      await run('UPDATE dbo.trips SET evidence_dropoff_json = ? WHERE id = ?', [payload, tripId]);
    }
    return { state: await getState() };
  });
}

export async function requestCancel(bookingId, ownerId, cancellationId, reason) {
  return transaction(async () => {
    const row = await getBookingRow(bookingId);
    if (!row) throw new Error('ไม่พบการจอง');
    const booking = mapBooking(row);
    if (!ownerId || booking.ownerId !== ownerId) {
      throw new Error('ไม่สามารถยกเลิกรายการนี้ได้');
    }
    const text = String(reason || '').trim();
    if (text.length < 3 || text.length > 500) throw new Error('กรุณาระบุเหตุผล 3 ถึง 500 ตัวอักษร');
    if (!cancellationId) throw new Error('ข้อมูลคำขอยกเลิกไม่ถูกต้อง');
    const trips = await tripsForBooking(bookingId);
    if (!canOwnerRequestCancel(booking, trips)) {
      throw new Error('ยกเลิกเองไม่ได้แล้ว ต้องติดต่อ Admin');
    }
    const cancelRequest = {
      id: cancellationId,
      reason: text,
      requestedAt: new Date().toISOString(),
      status: 'pending',
      previousStatus: booking.status,
    };
    await run(
      `UPDATE dbo.bookings SET cancel_request_json = ?, status = 'cancel_requested', updated_at = ?
       WHERE id = ?`,
      [stringifyJson(cancelRequest), new Date().toISOString(), bookingId],
    );
    return { state: await getState() };
  });
}

export async function resolveCancel(bookingId, cancellationId, approve, adminNote = '') {
  return transaction(async () => {
    const row = await getBookingRow(bookingId);
    if (!row) throw new Error('ไม่พบการจอง');
    const booking = mapBooking(row);
    if (
      booking.status !== 'cancel_requested'
      || !booking.cancelRequest
      || booking.cancelRequest.status !== 'pending'
      || booking.cancelRequest.id !== cancellationId
    ) {
      throw new Error('คำขอนี้ไม่อยู่ในสถานะรอพิจารณา');
    }
    const resolvedAt = new Date().toISOString();
    const cancelRequest = {
      ...booking.cancelRequest,
      status: approve ? 'approved' : 'rejected',
      adminNote: String(adminNote || '').trim().slice(0, 500),
      resolvedAt,
    };
    const previousStatus = booking.cancelRequest.previousStatus
      || (booking.paymentStatus === 'paid' ? 'paid' : 'awaiting_payment');
    await run(
      `UPDATE dbo.bookings SET cancel_request_json = ?, status = ?, updated_at = ? WHERE id = ?`,
      [
        stringifyJson(cancelRequest),
        approve ? 'cancelled' : previousStatus,
        resolvedAt,
        bookingId,
      ],
    );
    if (approve) await notifyCancelledDrivers(bookingId, booking, adminNote, cancelRequest.resolvedAt);
    return { state: await getState() };
  });
}

export async function reportIssue({ tripId, driverId, reasonId, message }) {
  return transaction(async () => {
    const trip = await getTripRow(tripId);
    if (!trip) throw new Error('ไม่พบทริป');
    await run(
      `INSERT INTO dbo.issues (id, trip_id, booking_id, driver_id, reason_id, message, created_at)
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
    return { state: await getState() };
  });
}

export async function updateZones(zones) {
  return transaction(async () => {
    for (const z of zones || []) {
      await upsertZone({ id: z.id, label: z.label, price: Number(z.price) });
    }
    return { state: await getState() };
  });
}

export async function updateHotelRoomPrices(rooms) {
  if (!Array.isArray(rooms) || rooms.length !== SEED_HOTEL_ROOM_PRICES.length) {
    throw new Error('กรุณาระบุราคาห้องพักให้ครบทุกประเภท');
  }

  const expectedRooms = new Map(SEED_HOTEL_ROOM_PRICES.map((room) => [room.id, room]));
  const normalized = rooms.map((room) => {
    const definition = expectedRooms.get(room?.id);
    const price = Number(room?.price);
    if (!definition || !Number.isSafeInteger(price) || price < 1 || price > 1000000) {
      throw new Error('ราคาห้องพักต้องเป็นจำนวนเต็มตั้งแต่ 1 ถึง 1,000,000 บาท');
    }
    expectedRooms.delete(room.id);
    return { ...definition, price };
  });
  if (expectedRooms.size) throw new Error('กรุณาระบุราคาห้องพักให้ครบทุกประเภท');

  return transaction(async () => {
    for (const room of normalized) {
      await upsertHotelRoom(room);
    }
    return { state: await getState() };
  });
}

export async function markNotificationRead(notificationId) {
  await run('UPDATE dbo.notifications SET read_at = ? WHERE id = ? AND read_at IS NULL', [
    new Date().toISOString(),
    notificationId,
  ]);
  return { state: await getState() };
}

export async function markAllNotificationsRead(driverId) {
  await run('UPDATE dbo.notifications SET read_at = ? WHERE driver_id = ? AND read_at IS NULL', [
    new Date().toISOString(),
    driverId,
  ]);
  return { state: await getState() };
}

export async function ensureUpcomingReminders(driverId) {
  if (!driverId) return { state: await getState() };
  const now = Date.now();
  const trips = (await listTrips()).filter((t) => t.driverId === driverId && t.status !== 'completed');
  const bookings = await listBookings();
  const notifications = await listNotifications(driverId);

  return transaction(async () => {
    for (const trip of trips) {
      const booking = bookings.find((b) => b.id === trip.bookingId);
      if (!booking || booking.status === 'cancelled') continue;
      const at = new Date(trip.pickupTime).getTime();
      if (Number.isNaN(at)) continue;
      const delta = at - now;
      if (delta <= 0 || delta > UPCOMING_WINDOW_MS) continue;
      const hourKey = new Date(trip.pickupTime).toISOString().slice(0, 13);
      const dedupeKey = `upcoming:${trip.id}:${hourKey}`;
      if (notifications.some((n) => n.dedupeKey === dedupeKey)) continue;
      await pushDriverNotification({
        driverId,
        type: 'upcoming',
        title: 'แจ้งเตือนงานที่กำลังจะถึง',
        body: `${booking.petName || 'สัตว์เลี้ยง'} · นัดรับ ${formatNotifyWhen(trip.pickupTime)}`,
        tripId: trip.id,
        bookingId: trip.bookingId,
        dedupeKey,
      });
    }
    return { state: await getState() };
  });
}

export async function notificationsForDriver(driverId) {
  return listNotifications(driverId);
}
