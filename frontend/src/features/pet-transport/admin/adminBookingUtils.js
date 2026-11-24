/** Map booking → Booking Management tab bucket */
export function bookingBucket(b) {
  if (b.status === 'cancelled' || b.status === 'cancel_requested') return 'cancelled';
  if (b.status === 'completed') return 'completed';
  if (b.status === 'in_progress' || b.status === 'paid') return 'in_progress';
  if (
    b.status === 'awaiting_payment'
    || b.paymentStatus === 'owner_confirmed'
    || (b.status === 'driver_assigned' && b.paymentStatus !== 'paid')
  ) {
    return 'awaiting_payment';
  }
  if (b.status === 'price_confirmed') return 'awaiting_assign';
  if (b.status === 'submitted') return 'awaiting_price';
  const needsDriver = (b.trips || []).some((t) => !t.driverId);
  if (needsDriver) return 'awaiting_assign';
  if (b.paymentStatus !== 'paid') return 'awaiting_payment';
  return 'in_progress';
}

export function shortBookingId(id = '') {
  return String(id).slice(0, 8).toUpperCase();
}
