const BASE = '/api/pet-transport';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (!res.ok || json?.ok === false) {
    throw new Error(json?.error || `API error ${res.status}`);
  }
  return json?.data;
}

export const transportApi = {
  snapshot: () => request('/snapshot'),
  createBooking: (body) => request('/bookings', { method: 'POST', body: JSON.stringify(body) }),
  confirmPrice: (bookingId, body) =>
    request(`/bookings/${bookingId}/confirm-price`, { method: 'POST', body: JSON.stringify(body) }),
  ownerConfirmPayment: (bookingId, note = '') =>
    request(`/bookings/${bookingId}/owner-confirm-payment`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),
  adminMarkPaid: (bookingId) =>
    request(`/bookings/${bookingId}/mark-paid`, { method: 'POST', body: '{}' }),
  requestCancel: (bookingId, reason) =>
    request(`/bookings/${bookingId}/request-cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  resolveCancel: (bookingId, approve, adminNote = '') =>
    request(`/bookings/${bookingId}/resolve-cancel`, {
      method: 'POST',
      body: JSON.stringify({ approve, adminNote }),
    }),
  assignDriver: (tripId, driverId, driverLabel = '') =>
    request(`/trips/${tripId}/assign-driver`, {
      method: 'POST',
      body: JSON.stringify({ driverId, driverLabel }),
    }),
  advanceTripStatus: (tripId, note = '') =>
    request(`/trips/${tripId}/advance`, { method: 'POST', body: JSON.stringify({ note }) }),
  updateTripSchedule: (tripId, body) =>
    request(`/trips/${tripId}/schedule`, { method: 'PATCH', body: JSON.stringify(body) }),
  attachEvidence: (tripId, kind, dataUrl) =>
    request(`/trips/${tripId}/evidence`, {
      method: 'POST',
      body: JSON.stringify({ kind, dataUrl }),
    }),
  reportIssue: (tripId, body) =>
    request(`/trips/${tripId}/issues`, { method: 'POST', body: JSON.stringify(body) }),
  markNotificationRead: (notificationId) =>
    request(`/notifications/${notificationId}/read`, { method: 'POST', body: '{}' }),
  markAllNotificationsRead: (driverId) =>
    request(`/drivers/${driverId}/notifications/read-all`, { method: 'POST', body: '{}' }),
  updateZones: (zones) =>
    request('/zones', { method: 'PUT', body: JSON.stringify({ zones }) }),
  addHotel: (body) => request('/hotels', { method: 'POST', body: JSON.stringify(body) }),
  removeHotel: (hotelId) => request(`/hotels/${hotelId}`, { method: 'DELETE' }),
};
