import { getSettings } from '../clinic-admin/clinicSettings.js';
import { pickVetForOnlineBooking } from '../medical-assistant/vetScheduling.js';
import { listVisits, upsertVisit } from '../medical-assistant/visitStore.js';
import { confirmBookingOnline, listAllBookings } from './bookingStore.js';

export async function confirmOnlineBooking(pendingBooking) {
  const [bookings, visits] = await Promise.all([listAllBookings(), listVisits()]);
  const visitsMap = new Map(visits.map((v) => [v.bookingId, v]));
  const slotMin = Number(getSettings().slotMinutes) || 60;
  const lineCount = Math.max(1, pendingBooking.petLines?.length || 1);
  const durationMin = slotMin * lineCount;

  const vet = pickVetForOnlineBooking({
    date: pendingBooking.date,
    time: pendingBooking.time,
    durationMin,
    preferredVetId: pendingBooking.vetId ?? '',
    bookings,
    visitsMap,
    excludeBookingId: pendingBooking.id,
  });

  const confirmed = await confirmBookingOnline(pendingBooking.id, {
    vetId: vet.id,
    vetName: vet.name,
  });

  const now = new Date().toISOString();
  await upsertVisit(pendingBooking.id, {
    petId: pendingBooking.petId,
    vetId: vet.id,
    vet: vet.name,
    durationMin,
    handledAt: now,
    handledBy: 'ระบบออนไลน์',
    handledById: null,
  });

  return confirmed;
}