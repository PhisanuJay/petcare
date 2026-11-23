import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  enrichBooking,
  getTransportSnapshot,
  subscribeTransport,
  createBooking,
  confirmPrice,
  assignDriver,
  ownerConfirmPayment,
  adminMarkPaid,
  advanceTripStatus,
  attachEvidence,
  requestCancel,
  resolveCancel,
  reportIssue,
  updateZones,
  addHotel,
  removeHotel,
  resetTransportDemo,
} from './store.js';

export function useTransport() {
  const state = useSyncExternalStore(subscribeTransport, getTransportSnapshot);

  const bookings = useMemo(
    () => state.bookings.map((b) => enrichBooking(b, state)),
    [state],
  );

  const getBooking = useCallback(
    (id) => enrichBooking(state.bookings.find((b) => b.id === id), state),
    [state],
  );

  const tripsForDriver = useCallback(
    (driverId) =>
      state.trips
        .filter((t) => t.driverId === driverId)
        .map((t) => {
          const booking = enrichBooking(
            state.bookings.find((b) => b.id === t.bookingId),
            state,
          );
          return { ...t, booking, driver: state.drivers.find((d) => d.id === driverId) };
        }),
    [state],
  );

  return {
    ...state,
    bookings,
    getBooking,
    tripsForDriver,
    createBooking,
    confirmPrice,
    assignDriver,
    ownerConfirmPayment,
    adminMarkPaid,
    advanceTripStatus,
    attachEvidence,
    requestCancel,
    resolveCancel,
    reportIssue,
    updateZones,
    addHotel,
    removeHotel,
    resetTransportDemo,
  };
}
