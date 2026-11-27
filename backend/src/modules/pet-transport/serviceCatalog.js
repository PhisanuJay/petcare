/**
 * Mirror of Pet-Owner-Vet prices used by transport quotes.
 * Keep in sync with frontend hotelRoomMatrix + migrate SEED_HOTEL_ROOM_PRICES.
 */

export const HOTEL_ROOMS = [
  { id: 'dog_s', label: 'สุนัข S', price: 450 },
  { id: 'dog_m', label: 'สุนัข M', price: 650 },
  { id: 'dog_l', label: 'สุนัข L', price: 950 },
  { id: 'dog_xl', label: 'สุนัข XL', price: 1350 },
  { id: 'cat_s', label: 'แมว S', price: 350 },
  { id: 'cat_m', label: 'แมว M', price: 550 },
  { id: 'cat_l', label: 'แมว L', price: 750 },
  { id: 'cat_xl', label: 'แมว XL', price: 1050 },
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

export function resolveOtherService({
  serviceType,
  place,
  otherServiceId,
  hotelNights = 1,
  hotelRooms = HOTEL_ROOMS,
}) {
  if (serviceType === 'inbound') return null;
  const kind = otherServiceKindForPlace(place);
  if (!kind || !otherServiceId) return null;

  if (kind === 'hotel') {
    const room = hotelRooms.find((r) => r.id === otherServiceId);
    if (!room) return null;
    const nights = Math.max(1, Number(hotelNights) || 1);
    return {
      kind: 'hotel',
      id: room.id,
      label: `โรงแรม · ${room.label} × ${nights} คืน`,
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