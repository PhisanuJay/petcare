import { readStaffSession } from '../auth/staffSession.js';

const BASE = '/api/pet-transport';

async function request(path, options = {}) {
  const token = readStaffSession()?.token;
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new Error(data?.error || `คำขอไม่สำเร็จ (${res.status})`);
  }
  return data;
}

export const transportApi = {
  getState: () => request('/state'),
  getPricing: () => request('/pricing'),
  createBooking: (body) => request('/bookings', { method: 'POST', body: JSON.stringify(body) }),
  confirmPrice: (id, body) =>
    request(`/bookings/${id}/confirm-price`, { method: 'POST', body: JSON.stringify(body || {}) }),
  setOtherService: (id, body) =>
    request(`/bookings/${id}/other-service`, { method: 'POST', body: JSON.stringify(body || {}) }),
  ownerConfirmPayment: (id, slip) =>
    request(`/bookings/${id}/owner-confirm-payment`, {
      method: 'POST',
      body: JSON.stringify({ slip }),
    }),
  approveTransportPayment: (id) =>
    request(`/bookings/${id}/approve-payment`, { method: 'POST', body: '{}' }),
  rejectTransportPayment: (id, note) =>
    request(`/bookings/${id}/reject-payment`, {
      method: 'POST',
      body: JSON.stringify({ note: note || '' }),
    }),
  requestCancel: (id, ownerId, cancellationId, reason) =>
    request(`/bookings/${id}/request-cancel`, {
      method: 'POST',
      body: JSON.stringify({ ownerId, cancellationId, reason: reason || '' }),
    }),
  resolveCancel: (id, cancellationId, approve, adminNote) =>
    request(`/bookings/${id}/resolve-cancel`, {
      method: 'POST',
      body: JSON.stringify({
        cancellationId,
        approve: Boolean(approve),
        adminNote: adminNote || '',
      }),
    }),
  assignDriver: (tripId, driverId, driverLabel) =>
    request(`/trips/${tripId}/assign-driver`, {
      method: 'POST',
      body: JSON.stringify({ driverId, driverLabel: driverLabel || '' }),
    }),
  updateTripSchedule: (tripId, body) =>
    request(`/trips/${tripId}/schedule`, { method: 'POST', body: JSON.stringify(body || {}) }),
  advanceTripStatus: (tripId, note) =>
    request(`/trips/${tripId}/advance-status`, {
      method: 'POST',
      body: JSON.stringify({ note: note || '' }),
    }),
  attachEvidence: (tripId, kind, dataUrl) =>
    request(`/trips/${tripId}/evidence`, {
      method: 'POST',
      body: JSON.stringify({ kind, dataUrl }),
    }),
  reportIssue: (body) => request('/issues', { method: 'POST', body: JSON.stringify(body || {}) }),
  markNotificationRead: (id) =>
    request(`/notifications/${id}/read`, { method: 'POST', body: '{}' }),
  markAllNotificationsRead: (driverId) =>
    request('/notifications/read-all', {
      method: 'POST',
      body: JSON.stringify({ driverId }),
    }),
  ensureUpcomingReminders: (driverId) =>
    request('/notifications/ensure-upcoming', {
      method: 'POST',
      body: JSON.stringify({ driverId }),
    }),
  updateZones: (zones) =>
    request('/zones', { method: 'PUT', body: JSON.stringify({ zones }) }),
  updateHotelRoomPrices: (rooms) =>
    request('/hotel-room-prices', { method: 'PUT', body: JSON.stringify({ rooms }) }),
  resetDemo: () => request('/reset-demo', { method: 'POST', body: '{}' }),
  purgeDemoJobs: () => request('/purge-demo-jobs', { method: 'POST', body: '{}' }),
};
