import { STORAGE_KEYS, newId, readJSON, writeJSON } from '../../shared/utils/storage.js';
import {
  DEMO_CLINICS,
  DEMO_DRIVERS,
  DEMO_HOTELS,
  ZONES,
  bookingStatusMeta,
  canOwnerRequestCancel,
  nextTripStatus,
} from './constants.js';
import { quotePrice, zoneFromDistance } from './pricing.js';

const listeners = new Set();
let cache = null;

function defaultState() {
  return {
    zones: ZONES.map((z) => ({ ...z })),
    drivers: DEMO_DRIVERS.map((d) => ({ ...d })),
    clinics: DEMO_CLINICS.map((c) => ({ ...c })),
    hotels: DEMO_HOTELS.map((h) => ({ ...h })),
    bookings: [],
    trips: [],
    issues: [],
    seeded: true,
  };
}

function getState() {
  if (cache === null) {
    const raw = readJSON(STORAGE_KEYS.transport, null);
    cache = raw?.seeded ? raw : defaultState();
    if (!raw?.seeded) persist(cache);
  }
  return cache;
}

function persist(next) {
  writeJSON(STORAGE_KEYS.transport, next);
  cache = next;
  listeners.forEach((l) => l());
}

function update(mutator) {
  const prev = getState();
  const draft = structuredClone(prev);
  mutator(draft);
  persist(draft);
  return draft;
}

export function subscribeTransport(listener) {
  listeners.add(listener);
  const onStorage = (e) => {
    if (e.key === STORAGE_KEYS.transport) {
      cache = null;
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function getTransportSnapshot() {
  return getState();
}

function makeTrip({ bookingId, type, from, to, pickupTime, dropoffTime }) {
  return {
    id: newId(),
    bookingId,
    type,
    from,
    to,
    pickupTime,
    dropoffTime,
    driverId: null,
    status: 'assigned',
    statusHistory: [{ status: 'assigned', at: new Date().toISOString(), note: 'สร้างทริป' }],
    evidencePickup: null,
    evidenceDropoff: null,
  };
}

function placeLabel(place, state) {
  if (!place) return '';
  if (place.kind === 'clinic') {
    const c = state.clinics.find((x) => x.id === place.refId);
    return c ? `${c.name} — ${c.address}` : place.address || place.name || '';
  }
  if (place.kind === 'hotel') {
    const h = state.hotels.find((x) => x.id === place.refId);
    return h ? `${h.name} — ${h.address}` : place.address || place.name || '';
  }
  return [place.name, place.address].filter(Boolean).join(' — ');
}

/** Owner creates booking */
export function createBooking(input) {
  const state = getState();
  const zone = zoneFromDistance(input.distanceKm) ?? state.zones[0];
  const estimate = quotePrice({
    zoneId: zone.id,
    serviceType: input.serviceType,
    zones: state.zones,
  });

  const bookingId = newId();
  const from = { ...input.from };
  const to = { ...input.to };

  const trips = [
    makeTrip({
      bookingId,
      type: 'pickup',
      from,
      to,
      pickupTime: input.outboundPickupTime,
      dropoffTime: input.outboundDropoffTime,
    }),
  ];

  if (input.serviceType === 'round_trip') {
    trips.push(
      makeTrip({
        bookingId,
        type: 'dropoff',
        from: to,
        to: from,
        pickupTime: input.returnPickupTime,
        dropoffTime: input.returnDropoffTime,
      }),
    );
  }

  const booking = {
    id: bookingId,
    ownerId: input.ownerId,
    ownerName: input.ownerName,
    ownerPhone: input.ownerPhone,
    petId: input.petId || null,
    petName: input.petName,
    petNotes: input.petNotes || '',
    serviceType: input.serviceType,
    distanceKm: Number(input.distanceKm),
    zoneId: zone.id,
    estimatedQuote: estimate,
    finalQuote: null,
    status: 'submitted',
    paymentStatus: 'unpaid',
    paymentNote: '',
    cancelRequest: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  update((draft) => {
    draft.bookings.unshift(booking);
    draft.trips.push(...trips);
  });

  return { booking, trips };
}

export function confirmPrice(bookingId, { zoneId, customPerTrip }) {
  update((draft) => {
    const b = draft.bookings.find((x) => x.id === bookingId);
    if (!b) throw new Error('ไม่พบการจอง');
    const quote = quotePrice({
      zoneId: zoneId || b.zoneId,
      serviceType: b.serviceType,
      zones: draft.zones,
      customPerTrip: customPerTrip === '' || customPerTrip == null ? null : Number(customPerTrip),
    });
    if (quote.total == null) throw new Error('นอกพื้นที่ต้องใส่ราคาก่อนยืนยัน');
    b.zoneId = quote.zoneId;
    b.finalQuote = quote;
    b.status = 'price_confirmed';
    b.updatedAt = new Date().toISOString();
  });
}

export function assignDriver(tripId, driverId) {
  update((draft) => {
    const trip = draft.trips.find((t) => t.id === tripId);
    if (!trip) throw new Error('ไม่พบทริป');
    const booking = draft.bookings.find((b) => b.id === trip.bookingId);
    trip.driverId = driverId;
    trip.status = 'assigned';
    trip.statusHistory.push({
      status: 'assigned',
      at: new Date().toISOString(),
      note: `มอบหมายคนขับ ${draft.drivers.find((d) => d.id === driverId)?.name || driverId}`,
    });
    if (booking) {
      const related = draft.trips.filter((t) => t.bookingId === booking.id);
      const allAssigned = related.every((t) => t.driverId);
      if (allAssigned && ['price_confirmed', 'submitted', 'driver_assigned'].includes(booking.status)) {
        booking.status = 'awaiting_payment';
      } else if (booking.status === 'price_confirmed' || booking.status === 'submitted') {
        booking.status = 'driver_assigned';
      }
      booking.updatedAt = new Date().toISOString();
    }
  });
}

export function ownerConfirmPayment(bookingId, note = '') {
  update((draft) => {
    const b = draft.bookings.find((x) => x.id === bookingId);
    if (!b) throw new Error('ไม่พบการจอง');
    if (!['awaiting_payment', 'driver_assigned', 'price_confirmed'].includes(b.status)) {
      throw new Error('ยังไม่ถึงขั้นตอนชำระเงิน');
    }
    b.paymentStatus = 'owner_confirmed';
    b.paymentNote = note;
    b.status = 'awaiting_payment';
    b.updatedAt = new Date().toISOString();
  });
}

export function adminMarkPaid(bookingId) {
  update((draft) => {
    const b = draft.bookings.find((x) => x.id === bookingId);
    if (!b) throw new Error('ไม่พบการจอง');
    b.paymentStatus = 'paid';
    b.status = 'paid';
    b.updatedAt = new Date().toISOString();
  });
}

export function advanceTripStatus(tripId, note = '') {
  update((draft) => {
    const trip = draft.trips.find((t) => t.id === tripId);
    if (!trip) throw new Error('ไม่พบทริป');
    const booking = draft.bookings.find((b) => b.id === trip.bookingId);
    if (booking && booking.paymentStatus !== 'paid' && booking.status !== 'in_progress' && booking.status !== 'paid') {
      throw new Error('ต้องชำระเงินและ Admin ยืนยันก่อนเริ่มงาน');
    }
    const next = nextTripStatus(trip.status);
    if (!next) throw new Error('ทริปเสร็จแล้ว');
    // Gate: before moving past assigned, booking must be paid
    if (trip.status === 'assigned' && booking?.paymentStatus !== 'paid') {
      throw new Error('รอ Admin Mark as Paid ก่อน');
    }
    trip.status = next.id;
    trip.statusHistory.push({ status: next.id, at: new Date().toISOString(), note: note || next.label });
    if (booking) {
      booking.status = next.id === 'completed' ? booking.status : 'in_progress';
      const related = draft.trips.filter((t) => t.bookingId === booking.id);
      if (related.every((t) => t.status === 'completed')) booking.status = 'completed';
      booking.updatedAt = new Date().toISOString();
    }
  });
}

export function attachEvidence(tripId, kind, dataUrl) {
  update((draft) => {
    const trip = draft.trips.find((t) => t.id === tripId);
    if (!trip) throw new Error('ไม่พบทริป');
    if (kind === 'pickup') trip.evidencePickup = { url: dataUrl, at: new Date().toISOString() };
    else trip.evidenceDropoff = { url: dataUrl, at: new Date().toISOString() };
  });
}

export function requestCancel(bookingId, reason) {
  update((draft) => {
    const b = draft.bookings.find((x) => x.id === bookingId);
    if (!b) throw new Error('ไม่พบการจอง');
    if (!canOwnerRequestCancel(b, draft.trips)) {
      throw new Error('ยกเลิกเองไม่ได้แล้ว ต้องติดต่อ Admin');
    }
    b.cancelRequest = { reason, at: new Date().toISOString(), status: 'pending' };
    b.status = 'cancel_requested';
    b.updatedAt = new Date().toISOString();
  });
}

export function resolveCancel(bookingId, approve, adminNote = '') {
  update((draft) => {
    const b = draft.bookings.find((x) => x.id === bookingId);
    if (!b) throw new Error('ไม่พบการจอง');
    if (!b.cancelRequest) throw new Error('ไม่มีคำขอยกเลิก');
    b.cancelRequest.status = approve ? 'approved' : 'rejected';
    b.cancelRequest.adminNote = adminNote;
    b.cancelRequest.resolvedAt = new Date().toISOString();
    b.status = approve ? 'cancelled' : 'paid';
    b.updatedAt = new Date().toISOString();
  });
}

export function reportIssue({ tripId, driverId, reasonId, message }) {
  update((draft) => {
    draft.issues.unshift({
      id: newId(),
      tripId,
      driverId,
      reasonId,
      message,
      status: 'open',
      createdAt: new Date().toISOString(),
    });
  });
}

export function updateZones(zones) {
  update((draft) => {
    draft.zones = zones;
  });
}

export function addHotel({ name, address }) {
  update((draft) => {
    draft.hotels.push({ id: newId(), name: name.trim(), address: address.trim() });
  });
}

export function removeHotel(id) {
  update((draft) => {
    draft.hotels = draft.hotels.filter((h) => h.id !== id);
  });
}

export function resetTransportDemo() {
  persist(defaultState());
}

export function enrichBooking(booking, state = getState()) {
  if (!booking) return null;
  const trips = state.trips
    .filter((t) => t.bookingId === booking.id)
    .map((t) => ({
      ...t,
      driver: state.drivers.find((d) => d.id === t.driverId) || null,
      fromLabel: placeLabel(t.from, state),
      toLabel: placeLabel(t.to, state),
    }))
    .sort((a, b) => (a.type === 'pickup' ? -1 : 1));
  return {
    ...booking,
    statusMeta: bookingStatusMeta(booking.status),
    trips,
    quote: booking.finalQuote || booking.estimatedQuote,
  };
}

export { placeLabel };
