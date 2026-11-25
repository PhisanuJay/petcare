const BASE = '/api/pet-transport';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });
<<<<<<< HEAD
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
  createBooking: (body) => request('/bookings', { method: 'POST', body: JSON.stringify(body) }),
  confirmPrice: (id, body) =>
    request(`/bookings/${id}/confirm-price`, { method: 'POST', body: JSON.stringify(body || {}) }),
  setOtherService: (id, body) =>
    request(`/bookings/${id}/other-service`, { method: 'POST', body: JSON.stringify(body || {}) }),
  ownerConfirmPayment: (id, note) =>
    request(`/bookings/${id}/owner-confirm-payment`, {
      method: 'POST',
      body: JSON.stringify({ note: note || '' }),
    }),
  adminMarkPaid: (id) =>
    request(`/bookings/${id}/admin-mark-paid`, { method: 'POST', body: '{}' }),
  requestCancel: (id, reason) =>
    request(`/bookings/${id}/request-cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || '' }),
    }),
  resolveCancel: (id, approve, adminNote) =>
    request(`/bookings/${id}/resolve-cancel`, {
      method: 'POST',
      body: JSON.stringify({ approve: Boolean(approve), adminNote: adminNote || '' }),
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
=======
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
>>>>>>> origin/Admin-transport
  attachEvidence: (tripId, kind, dataUrl) =>
    request(`/trips/${tripId}/evidence`, {
      method: 'POST',
      body: JSON.stringify({ kind, dataUrl }),
    }),
<<<<<<< HEAD
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
  addHotel: (body) => request('/hotels', { method: 'POST', body: JSON.stringify(body || {}) }),
  removeHotel: (id) => request(`/hotels/${id}`, { method: 'DELETE' }),
  resetDemo: () => request('/reset-demo', { method: 'POST', body: '{}' }),
  purgeDemoJobs: () => request('/purge-demo-jobs', { method: 'POST', body: '{}' }),
=======
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
>>>>>>> origin/Admin-transport
};
