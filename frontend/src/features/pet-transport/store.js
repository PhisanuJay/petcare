import { transportApi } from './api.js';
import { bookingStatusMeta } from './constants.js';
import { districtLabel, subdistrictById } from './pricing.js';
import { STAFF_SESSION_CHANGED } from '../auth/staffSession.js';

const listeners = new Set();
let cache = emptyState();
let loadPromise = null;
let hydrated = false;
let sessionGeneration = 0;
let sessionListenerRegistered = false;

function emptyState() {
  return {
    zones: [],
    hotelRoomPrices: [],
    clinics: [],
    hotels: [],
    bookings: [],
    trips: [],
    issues: [],
    notifications: [],
    seeded: false,
    loading: true,
    error: null,
  };
}

function notify() {
  listeners.forEach((l) => l());
}

function setCache(next) {
  cache = next;
  notify();
}

function applyState(state) {
  setCache({
    zones: state.zones || [],
    hotelRoomPrices: state.hotelRoomPrices || [],
    clinics: state.clinics || [],
    hotels: state.hotels || [],
    bookings: state.bookings || [],
    trips: state.trips || [],
    issues: state.issues || [],
    notifications: state.notifications || [],
    seeded: true,
    loading: false,
    error: null,
  });
}

async function ensureLoaded() {
  if (hydrated && !cache.loading) return cache;
  if (loadPromise) return loadPromise;
  const generation = sessionGeneration;
  loadPromise = transportApi
    .getState()
    .then((state) => {
      if (generation !== sessionGeneration) return cache;
      hydrated = true;
      applyState(state);
      return cache;
    })
    .catch((error) => {
      if (generation === sessionGeneration) {
        setCache({
          ...cache,
          loading: false,
          error: error.message || 'โหลดข้อมูลไม่สำเร็จ',
        });
      }
      throw error;
    })
    .finally(() => {
      if (generation === sessionGeneration) loadPromise = null;
    });
  return loadPromise;
}

function onStaffSessionChanged() {
  sessionGeneration += 1;
  loadPromise = null;
  hydrated = false;
  setCache(emptyState());
  ensureLoaded().catch(() => {});
}

async function mutate(fn) {
  await ensureLoaded();
  const result = await fn();
  if (result?.state) applyState(result.state);
  else {
    const state = await transportApi.getState();
    applyState(state);
  }
  return result;
}

export function subscribeTransport(listener) {
  listeners.add(listener);
  if (!sessionListenerRegistered && typeof window !== 'undefined') {
    window.addEventListener(STAFF_SESSION_CHANGED, onStaffSessionChanged);
    sessionListenerRegistered = true;
  }
  ensureLoaded().catch(() => {});
  return () => {
    listeners.delete(listener);
  };
}

export function getTransportSnapshot() {
  return cache;
}

export function placeParts(place, state = cache) {
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

function placeLabel(place, state = cache) {
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

export async function createBooking(input) {
  const result = await mutate(() => transportApi.createBooking(input));
  return { booking: result.booking, trips: result.trips };
}

export async function confirmPrice(bookingId, payload) {
  await mutate(() => transportApi.confirmPrice(bookingId, payload));
}

export async function setBookingOtherService(bookingId, payload) {
  await mutate(() => transportApi.setOtherService(bookingId, payload));
}

export async function assignDriver(tripId, driverId, driverLabel = '') {
  await mutate(() => transportApi.assignDriver(tripId, driverId, driverLabel));
}

export async function updateTripSchedule(tripId, payload) {
  await mutate(() => transportApi.updateTripSchedule(tripId, payload));
}

export async function ownerConfirmPayment(bookingId, slip) {
  await mutate(() => transportApi.ownerConfirmPayment(bookingId, slip));
}

export async function approveTransportPayment(bookingId) {
  await mutate(() => transportApi.approveTransportPayment(bookingId));
}

export async function rejectTransportPayment(bookingId, note = '') {
  await mutate(() => transportApi.rejectTransportPayment(bookingId, note));
}

export async function advanceTripStatus(tripId, note = '') {
  await mutate(() => transportApi.advanceTripStatus(tripId, note));
}

export async function attachEvidence(tripId, kind, dataUrl) {
  await mutate(() => transportApi.attachEvidence(tripId, kind, dataUrl));
}

export async function requestCancel(bookingId, ownerId, cancellationId, reason) {
  await mutate(() => transportApi.requestCancel(bookingId, ownerId, cancellationId, reason));
}

export async function resolveCancel(bookingId, cancellationId, approve, adminNote = '') {
  await mutate(() => transportApi.resolveCancel(bookingId, cancellationId, approve, adminNote));
}

export function notificationsForDriver(driverId) {
  if (!driverId) return [];
  return (cache.notifications || [])
    .filter((n) => n.driverId === driverId)
    .slice()
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function unreadNotificationCount(driverId) {
  return notificationsForDriver(driverId).filter((n) => !n.read).length;
}

export async function markNotificationRead(notificationId) {
  await mutate(() => transportApi.markNotificationRead(notificationId));
}

export async function markAllNotificationsRead(driverId) {
  await mutate(() => transportApi.markAllNotificationsRead(driverId));
}

export async function ensureUpcomingReminders(driverId) {
  if (!driverId) return;
  await mutate(() => transportApi.ensureUpcomingReminders(driverId));
}

export async function reportIssue(payload) {
  await mutate(() => transportApi.reportIssue(payload));
}

export async function updateZones(zones) {
  await mutate(() => transportApi.updateZones(zones));
}

export async function updateHotelRoomPrices(rooms) {
  await mutate(() => transportApi.updateHotelRoomPrices(rooms));
}

export function enrichBooking(booking, state = cache, drivers = []) {
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
