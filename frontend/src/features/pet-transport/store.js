import { bookingStatusMeta } from './constants.js';
import { districtLabel, subdistrictById } from './pricing.js';
import { transportApi } from './api.js';

const listeners = new Set();
let cache = emptyState();
let refreshPromise = null;
let bootstrapped = false;

const UPCOMING_WINDOW_MS = 2 * 60 * 60 * 1000;

function emptyState() {
  return {
    zones: [],
    clinics: [],
    hotels: [],
    bookings: [],
    trips: [],
    issues: [],
    notifications: [],
    ready: false,
    error: null,
  };
}

function emit() {
  listeners.forEach((l) => l());
}

function applySnapshot(data) {
  cache = {
    zones: data?.zones || [],
    clinics: data?.clinics || [],
    hotels: data?.hotels || [],
    bookings: data?.bookings || [],
    trips: data?.trips || [],
    issues: data?.issues || [],
    notifications: data?.notifications || [],
    ready: true,
    error: null,
  };
  emit();
  return cache;
}

export async function refreshTransport(force = false) {
  if (refreshPromise && !force) return refreshPromise;
  refreshPromise = transportApi
    .snapshot()
    .then((data) => applySnapshot(data))
    .catch((err) => {
      cache = { ...cache, ready: false, error: err.message || 'โหลดข้อมูลไม่สำเร็จ' };
      emit();
      throw err;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

async function mutate(fn) {
  const result = await fn();
  await refreshTransport(true);
  return result;
}

export function subscribeTransport(listener) {
  listeners.add(listener);
  if (!bootstrapped) {
    bootstrapped = true;
    refreshTransport().catch(() => {});
  }
  return () => {
    listeners.delete(listener);
  };
}

export function getTransportSnapshot() {
  return cache;
}

function getState() {
  return cache;
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

export function createBooking(input) {
  return mutate(() => transportApi.createBooking(input));
}

export function confirmPrice(bookingId, payload) {
  return mutate(() => transportApi.confirmPrice(bookingId, payload || {}));
}

export function assignDriver(tripId, driverId, driverLabel = '') {
  return mutate(() => transportApi.assignDriver(tripId, driverId, driverLabel));
}

export function updateTripSchedule(tripId, payload) {
  return mutate(() => transportApi.updateTripSchedule(tripId, payload || {}));
}

export function ownerConfirmPayment(bookingId, note = '') {
  return mutate(() => transportApi.ownerConfirmPayment(bookingId, note));
}

export function adminMarkPaid(bookingId) {
  return mutate(() => transportApi.adminMarkPaid(bookingId));
}

export function advanceTripStatus(tripId, note = '') {
  return mutate(() => transportApi.advanceTripStatus(tripId, note));
}

export function attachEvidence(tripId, kind, dataUrl) {
  return mutate(() => transportApi.attachEvidence(tripId, kind, dataUrl));
}

export function requestCancel(bookingId, reason) {
  return mutate(() => transportApi.requestCancel(bookingId, reason));
}

export function resolveCancel(bookingId, approve, adminNote = '') {
  return mutate(() => transportApi.resolveCancel(bookingId, approve, adminNote));
}

export function reportIssue({ tripId, driverId, reasonId, message }) {
  return mutate(() => transportApi.reportIssue(tripId, { driverId, reasonId, message }));
}

export function updateZones(zones) {
  return mutate(() => transportApi.updateZones(zones));
}

export function addHotel(payload) {
  return mutate(() => transportApi.addHotel(payload));
}

export function removeHotel(hotelId) {
  return mutate(() => transportApi.removeHotel(hotelId));
}

export function notificationsForDriver(driverId) {
  if (!driverId) return [];
  return (getState().notifications || [])
    .filter((n) => n.driverId === driverId)
    .slice()
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function unreadNotificationCount(driverId) {
  return notificationsForDriver(driverId).filter((n) => !n.read).length;
}

export function markNotificationRead(notificationId) {
  return mutate(() => transportApi.markNotificationRead(notificationId));
}

export function markAllNotificationsRead(driverId) {
  return mutate(() => transportApi.markAllNotificationsRead(driverId));
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

/** Client-side soft reminders (ไม่ persist ลง SQLite) */
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
        id: `local-${dedupeKey}`,
        driverId,
        type: 'upcoming',
        title: 'แจ้งเตือนงานที่กำลังจะถึง',
        body: `${booking.petName || 'สัตว์เลี้ยง'} · นัดรับ ${formatNotifyWhen(trip.pickupTime)}`,
        tripId: trip.id,
        bookingId: trip.bookingId,
        dedupeKey,
        read: false,
        createdAt: new Date().toISOString(),
      });
    });
  if (!pending.length) return;
  cache = {
    ...state,
    notifications: [...pending, ...(state.notifications || [])],
  };
  emit();
}

export function resetTransportDemo() {
  return refreshTransport(true);
}

export function purgeDemoDriverJobs() {
  return undefined;
}

export function enrichBooking(booking, state = getState(), drivers = []) {
  if (!booking) return null;
  const trips = state.trips
    .filter((t) => t.bookingId === booking.id)
    .map((t) => ({
      ...t,
      driver: drivers.find((d) => d.id === t.driverId) || null,
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
