import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import {
  enrichBooking,
  getTransportSnapshot,
  subscribeTransport,
  createBooking,
  confirmPrice,
  setBookingOtherService,
  assignDriver as assignDriverStore,
  ownerConfirmPayment,
  approveTransportPayment,
  rejectTransportPayment,
  advanceTripStatus,
  attachEvidence,
  requestCancel,
  resolveCancel,
  reportIssue,
  updateTripSchedule,
  notificationsForDriver,
  unreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  ensureUpcomingReminders,
  updateZones,
  updateHotelRoomPrices,
  resetTransportDemo,
  purgeDemoDriverJobs,
  toAssignDriver,
} from './store.js';

export function useTransport() {
  const { drivers: authDrivers } = useAuth();
  const state = useSyncExternalStore(subscribeTransport, getTransportSnapshot);

  const drivers = useMemo(
    () => authDrivers.map(toAssignDriver).filter(Boolean),
    [authDrivers],
  );

  const activeDrivers = useMemo(
    () => drivers.filter((d) => d.active !== false),
    [drivers],
  );

  const bookings = useMemo(
    () => state.bookings.map((b) => enrichBooking(b, state, drivers)),
    [state, drivers],
  );

  const getBooking = useCallback(
    (id) => enrichBooking(state.bookings.find((b) => b.id === id), state, drivers),
    [state, drivers],
  );

  const tripsForDriver = useCallback(
    (driverId) =>
      state.trips
        .filter((t) => t.driverId === driverId
          && state.bookings.some((booking) => booking.id === t.bookingId && booking.status !== 'cancelled'))
        .map((t) => {
          const booking = enrichBooking(
            state.bookings.find((b) => b.id === t.bookingId),
            state,
            drivers,
          );
          return {
            ...t,
            booking,
            driver: drivers.find((d) => d.id === driverId) || null,
          };
        }),
    [state, drivers],
  );

  const assignDriver = useCallback((tripId, driverId) => {
    const label = drivers.find((d) => d.id === driverId)?.name || '';
    return assignDriverStore(tripId, driverId, label);
  }, [drivers]);

  const driverNotifications = useCallback(
    (driverId) => notificationsForDriver(driverId),
    [state.notifications],
  );

  const driverUnreadCount = useCallback(
    (driverId) => unreadNotificationCount(driverId),
    [state.notifications],
  );

  return {
    ...state,
    drivers,
    activeDrivers,
    bookings,
    getBooking,
    tripsForDriver,
    driverNotifications,
    driverUnreadCount,
    createBooking,
    confirmPrice,
    setBookingOtherService,
    assignDriver,
    ownerConfirmPayment,
    approveTransportPayment,
    rejectTransportPayment,
    advanceTripStatus,
    attachEvidence,
    requestCancel,
    resolveCancel,
    reportIssue,
    updateTripSchedule,
    markNotificationRead,
    markAllNotificationsRead,
    ensureUpcomingReminders,
    updateZones,
    updateHotelRoomPrices,
    resetTransportDemo,
    purgeDemoDriverJobs,
  };
}
