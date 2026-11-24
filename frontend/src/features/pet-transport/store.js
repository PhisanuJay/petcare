import { STORAGE_KEYS, newId, readJSON, writeJSON } from '../../shared/utils/storage.js';
import {
  DEMO_CLINICS,
  DEMO_HOTELS,
  ZONES,
  bookingStatusMeta,
  canOwnerRequestCancel,
  isRoundTrip,
  nextTripStatus,
} from './constants.js';
import { districtLabel, quotePrice, subdistrictById, zoneIdFromSubdistrict } from './pricing.js';

const listeners = new Set();
let cache = null;
const PRICING_VERSION = 4;

function defaultState() {
  return {
    zones: ZONES.map((z) => ({ ...z })),
    clinics: DEMO_CLINICS.map((c) => ({ ...c })),
    hotels: DEMO_HOTELS.map((h) => ({ ...h })),
    bookings: [],
    trips: [],
    issues: [],
    notifications: [],
    seeded: true,
    pricingVersion: PRICING_VERSION,
  };
}

const UPCOMING_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_NOTIFICATIONS = 120;

function ensureNotifications(draft) {
  if (!Array.isArray(draft.notifications)) draft.notifications = [];
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

function pushDriverNotification(draft, {
  driverId,
  type,
  title,
  body = '',
  tripId = null,
  bookingId = null,
  dedupeKey = null,
}) {
  if (!driverId) return;
  ensureNotifications(draft);
  if (dedupeKey && draft.notifications.some((n) => n.dedupeKey === dedupeKey)) return;
  draft.notifications.unshift({
    id: newId(),
    driverId,
    type,
    title,
    body,
    tripId,
    bookingId,
    dedupeKey,
    read: false,
    createdAt: new Date().toISOString(),
  });
  if (draft.notifications.length > MAX_NOTIFICATIONS) {
    draft.notifications = draft.notifications.slice(0, MAX_NOTIFICATIONS);
  }
}

function zonesNeedMigration(zones) {
  if (!Array.isArray(zones) || zones.length === 0) return true;
  const ids = zones.map((z) => z.id);
  return ids.includes('A') || ids.includes('OUT') || !ids.includes('1') || !ids.includes('2');
}

function mergeCatalog(list, demos) {
  return demos.map((demo) => {
    const existing = (list || []).find((x) => x.id === demo.id);
    return existing ? { ...existing, ...demo, ...pickZoneFields(demo) } : { ...demo };
  });
}

function pickZoneFields(demo) {
  return {
    districtId: demo.districtId,
    subdistrictId: demo.subdistrictId,
    zoneId: demo.zoneId || zoneIdFromSubdistrict(demo.subdistrictId),
    address: demo.address,
    name: demo.name,
  };
}

function getState() {
  if (cache === null) {
    const raw = readJSON(STORAGE_KEYS.transport, null);
    cache = raw?.seeded ? raw : defaultState();
    if (!raw?.seeded) {
      persist(cache);
    } else if (zonesNeedMigration(cache.zones) || cache.pricingVersion !== PRICING_VERSION) {
      cache = {
        ...cache,
        zones: ZONES.map((z) => ({ ...z })),
        clinics: mergeCatalog(cache.clinics, DEMO_CLINICS),
        hotels: mergeCatalog(cache.hotels, DEMO_HOTELS),
        pricingVersion: PRICING_VERSION,
      };
      persist(cache);
    }
    if (cache.demoDriverVersion !== 'purged') {
      const bookings = (cache.bookings || []).filter((item) => !String(item.id).startsWith('demo-booking-'));
      const trips = (cache.trips || []).filter((item) => !String(item.id).startsWith('demo-trip-'));
      if (bookings.length !== (cache.bookings || []).length || trips.length !== (cache.trips || []).length || cache.demoDriverVersion !== 'purged') {
        cache = { ...cache, bookings, trips, demoDriverVersion: 'purged' };
        persist(cache);
      }
    }
    if (!Array.isArray(cache.notifications)) {
      cache = { ...cache, notifications: [] };
      persist(cache);
    }
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

export function placeParts(place, state = getState()) {
  if (!place) return { name: '', address: '', mapUrl: '' };
  if (place.kind === 'clinic' || place.kind === 'facility') {
    const clinic = (state.clinics || []).find((item) => item.id === place.refId);
    return {
      name: clinic?.name || place.name || 'คลินิก',
      address: clinic?.address || place.address || '',
      mapUrl: place.mapUrl || clinic?.mapUrl || '',
    };
  }
  if (place.kind === 'hotel') {
    const hotel = (state.hotels || []).find((item) => item.id === place.refId);
    return {
      name: hotel?.name || place.name || 'โรงแรม',
      address: hotel?.address || place.address || '',
      mapUrl: place.mapUrl || hotel?.mapUrl || '',
    };
  }
  if (place.kind === 'home') {
    return { name: place.name || 'บ้าน', address: place.address || '', mapUrl: place.mapUrl || '' };
  }
  return { name: place.name || '', address: place.address || '', mapUrl: place.mapUrl || '' };
}

function placeLabel(place, state = getState()) {
  if (!place) return '';
  const parts = placeParts(place, state);
  if (parts.name || parts.address) {
    return [parts.name, parts.address].filter(Boolean).join(' — ');
  }
  const sub = place.subdistrictId ? subdistrictById(place.subdistrictId) : null;
  return [
    place.name || null,
    districtLabel(place.districtId) || null,
    sub?.label || null,
    place.zoneId ? `Zone ${place.zoneId}` : null,
    place.address || null,
  ].filter(Boolean).join(' · ') || place.address || '';
}

/** Owner creates booking */
export function createBooking(input) {
  const state = getState();
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
    zones: state.zones,
  });
  if (estimate.total == null) {
    throw new Error('คำนวณราคาไม่สำเร็จ');
  }

  const bookingId = newId();

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

  if (isRoundTrip(input.serviceType)) {
    trips.push(
      makeTrip({
        bookingId,
        type: 'dropoff',
        from: returnFrom,
        to: returnTo,
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
    fromZoneId: from.zoneId,
    toZoneId: to.zoneId,
    returnFromZoneId: isRoundTrip(input.serviceType) ? returnFrom.zoneId : null,
    returnToZoneId: isRoundTrip(input.serviceType) ? returnTo.zoneId : null,
    fareZoneId: estimate.fareZoneId,
    zoneId: estimate.fareZoneId,
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

export function confirmPrice(bookingId, { fareZoneId, customPerTrip }) {
  update((draft) => {
    const b = draft.bookings.find((x) => x.id === bookingId);
    if (!b) throw new Error('ไม่พบการจอง');
    const fromZoneId = b.fromZoneId || b.estimatedQuote?.fromZoneId;
    const toZoneId = b.toZoneId || b.estimatedQuote?.toZoneId;
    const override = fareZoneId || b.fareZoneId || b.zoneId;
    const quote = quotePrice({
      fromZoneId,
      toZoneId,
      returnFromZoneId: b.returnFromZoneId || b.estimatedQuote?.returnFromZoneId,
      returnToZoneId: b.returnToZoneId || b.estimatedQuote?.returnToZoneId,
      serviceType: b.serviceType,
      zones: draft.zones,
      fareZoneOverride: override,
      customPerTrip: customPerTrip === '' || customPerTrip == null ? null : Number(customPerTrip),
    });
    if (quote.total == null) throw new Error('ต้องใส่ราคาก่อนยืนยัน');
    b.fareZoneId = quote.fareZoneId;
    b.zoneId = quote.fareZoneId;
    b.finalQuote = quote;
    b.status = 'price_confirmed';
    b.updatedAt = new Date().toISOString();
  });
}

export function assignDriver(tripId, driverId, driverLabel = '') {
  update((draft) => {
    const trip = draft.trips.find((t) => t.id === tripId);
    if (!trip) throw new Error('ไม่พบทริป');
    const booking = draft.bookings.find((b) => b.id === trip.bookingId);
    const prevDriverId = trip.driverId;
    const petName = booking?.petName || 'สัตว์เลี้ยง';

    if (prevDriverId && prevDriverId !== driverId) {
      pushDriverNotification(draft, {
        driverId: prevDriverId,
        type: 'cancelled',
        title: 'งานถูกมอบหมายให้คนขับอื่น',
        body: `${petName} · เวลารับ ${formatNotifyWhen(trip.pickupTime)}`,
        tripId: trip.id,
        bookingId: trip.bookingId,
      });
    }

    trip.driverId = driverId;
    trip.status = 'assigned';
    trip.statusHistory.push({
      status: 'assigned',
      at: new Date().toISOString(),
      note: `มอบหมายคนขับ ${driverLabel || driverId}`,
    });

    if (driverId && driverId !== prevDriverId) {
      pushDriverNotification(draft, {
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

/** Admin changes pickup/dropoff time — notifies assigned driver. */
export function updateTripSchedule(tripId, { pickupTime, dropoffTime }) {
  update((draft) => {
    const trip = draft.trips.find((t) => t.id === tripId);
    if (!trip) throw new Error('ไม่พบทริป');
    const booking = draft.bookings.find((b) => b.id === trip.bookingId);
    const prevPickup = trip.pickupTime;
    if (pickupTime != null) trip.pickupTime = pickupTime;
    if (dropoffTime != null) trip.dropoffTime = dropoffTime;
    trip.statusHistory.push({
      status: trip.status,
      at: new Date().toISOString(),
      note: `เปลี่ยนเวลานัดรับเป็น ${formatNotifyWhen(trip.pickupTime)}`,
    });
    if (booking) booking.updatedAt = new Date().toISOString();
    if (trip.driverId && prevPickup !== trip.pickupTime) {
      pushDriverNotification(draft, {
        driverId: trip.driverId,
        type: 'time_changed',
        title: 'มีการเปลี่ยนแปลงเวลานัดรับ',
        body: `${booking?.petName || 'สัตว์เลี้ยง'} · จาก ${formatNotifyWhen(prevPickup)} เป็น ${formatNotifyWhen(trip.pickupTime)}`,
        tripId: trip.id,
        bookingId: trip.bookingId,
      });
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
    if (approve) {
      const related = draft.trips.filter((t) => t.bookingId === bookingId && t.driverId);
      related.forEach((trip) => {
        pushDriverNotification(draft, {
          driverId: trip.driverId,
          type: 'cancelled',
          title: 'งานถูกยกเลิก',
          body: `${b.petName || 'สัตว์เลี้ยง'} · เวลารับ ${formatNotifyWhen(trip.pickupTime)}${adminNote ? ` — ${adminNote}` : ''}`,
          tripId: trip.id,
          bookingId,
          dedupeKey: `cancelled:${bookingId}:${trip.driverId}:${b.cancelRequest.resolvedAt}`,
        });
      });
    }
  });
}

export function notificationsForDriver(driverId) {
  if (!driverId) return [];
  const state = getState();
  return (state.notifications || [])
    .filter((n) => n.driverId === driverId)
    .slice()
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function unreadNotificationCount(driverId) {
  return notificationsForDriver(driverId).filter((n) => !n.read).length;
}

export function markNotificationRead(notificationId) {
  update((draft) => {
    ensureNotifications(draft);
    const item = draft.notifications.find((n) => n.id === notificationId);
    if (item) item.read = true;
  });
}

export function markAllNotificationsRead(driverId) {
  update((draft) => {
    ensureNotifications(draft);
    draft.notifications.forEach((n) => {
      if (n.driverId === driverId) n.read = true;
    });
  });
}

/** Create upcoming-job reminders for trips within the next 2 hours. */
export function ensureUpcomingReminders(driverId) {
  if (!driverId) return;
  const state = getState();
  const now = Date.now();
  const pending = [];
  (state.trips || [])
    .filter((t) => t.driverId === driverId && t.status !== 'completed')
    .forEach((trip) => {
      const booking = (state.bookings || []).find((b) => b.id === trip.bookingId);
      if (!booking || booking.status === 'cancelled') return;
      const at = new Date(trip.pickupTime).getTime();
      if (Number.isNaN(at)) return;
      const delta = at - now;
      if (delta <= 0 || delta > UPCOMING_WINDOW_MS) return;
      const hourKey = new Date(trip.pickupTime).toISOString().slice(0, 13);
      const dedupeKey = `upcoming:${trip.id}:${hourKey}`;
      if ((state.notifications || []).some((n) => n.dedupeKey === dedupeKey)) return;
      pending.push({
        driverId,
        type: 'upcoming',
        title: 'แจ้งเตือนงานที่กำลังจะถึง',
        body: `${booking.petName || 'สัตว์เลี้ยง'} · นัดรับ ${formatNotifyWhen(trip.pickupTime)}`,
        tripId: trip.id,
        bookingId: trip.bookingId,
        dedupeKey,
      });
    });
  if (!pending.length) return;
  update((draft) => {
    pending.forEach((item) => pushDriverNotification(draft, item));
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

/** Remove legacy demo trips/bookings so driver only sees real assigned jobs. */
export function purgeDemoDriverJobs() {
  const current = getState();
  if (current.demoDriverVersion === 'purged') return;
  const hasDemo = current.bookings.some((b) => String(b.id).startsWith('demo-booking-'))
    || current.trips.some((t) => String(t.id).startsWith('demo-trip-'));
  if (!hasDemo && current.demoDriverVersion == null) {
    update((draft) => {
      draft.demoDriverVersion = 'purged';
    });
    return;
  }
  update((draft) => {
    draft.bookings = draft.bookings.filter((item) => !String(item.id).startsWith('demo-booking-'));
    draft.trips = draft.trips.filter((item) => !String(item.id).startsWith('demo-trip-'));
    draft.demoDriverVersion = 'purged';
  });
}

export function enrichBooking(booking, state = getState(), drivers = []) {
  if (!booking) return null;
  const trips = state.trips
    .filter((t) => t.bookingId === booking.id)
    .map((t) => ({
      ...t,
      driver: drivers.find((d) => d.id === t.driverId) || null,
      fromLabel: placeLabel(t.from),
      toLabel: placeLabel(t.to),
    }))
    .sort((a, b) => (a.type === 'pickup' ? -1 : 1));
  return {
    ...booking,
    statusMeta: bookingStatusMeta(booking.status),
    trips,
    quote: booking.finalQuote || booking.estimatedQuote,
  };
}

/** Map auth driver user → assign list shape */
export function toAssignDriver(user) {
  if (!user) return null;
  const vehicleBits = [user.vehicle, user.plateNumber].filter(Boolean);
  return {
    id: user.id,
    name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
    phone: user.phone || '',
    vehicle: vehicleBits.join(' · '),
    plateNumber: user.plateNumber || '',
    email: user.email,
    active: user.active !== false,
  };
}

export { placeLabel };
