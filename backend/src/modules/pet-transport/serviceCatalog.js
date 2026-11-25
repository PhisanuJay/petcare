/**
 * Mirror of Pet-Owner-Vet prices used by transport quotes.
 * Keep in sync with frontend homeContent HOTEL_ROOMS + PROMOS checkup.
 */

export const HOTEL_ROOMS = [
  { id: 'standard', label: 'โรงแรม · Standard', price: 450 },
  { id: 'deluxe', label: 'โรงแรม · Deluxe', price: 750 },
  { id: 'suite', label: 'โรงแรม · Suite', price: 1200 },
];

export const CLINIC_SERVICES = [
  { id: 'checkup', label: 'ตรวจสุขภาพประจำปี', price: 990 },
];

export function otherServiceKindForPlace(place) {
  if (!place) return null;
  const ref = String(place.refId || '');
  if (ref.startsWith('hotel-') || place.kind === 'hotel') return 'hotel';
  if (ref.startsWith('clinic-') || place.kind === 'clinic' || place.kind === 'facility') return 'clinic';
  return null;
}

export function resolveOtherService({ serviceType, place, otherServiceId, hotelNights = 1 }) {
  if (serviceType === 'inbound') return null;
  const kind = otherServiceKindForPlace(place);
  if (!kind || !otherServiceId) return null;

  if (kind === 'hotel') {
    const room = HOTEL_ROOMS.find((r) => r.id === otherServiceId);
    if (!room) return null;
    const nights = Math.max(1, Number(hotelNights) || 1);
    return {
      kind: 'hotel',
      id: room.id,
      label: `${room.label} × ${nights} คืน`,
      unitPrice: room.price,
      nights,
      amount: room.price * nights,
    };
  }

  const clinic = CLINIC_SERVICES.find((s) => s.id === otherServiceId);
  if (!clinic) return null;
  return {
    kind: 'clinic',
    id: clinic.id,
    label: clinic.label,
    unitPrice: clinic.price,
    nights: 1,
    amount: clinic.price,
  };
}
