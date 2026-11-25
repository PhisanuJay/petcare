/**
 * Other-service prices pulled from Pet-Owner-Vet catalog:
 * - Hotel rooms: homeContent HOTEL_ROOMS / hotelOptions
 * - Clinic checkup: PROMOS "ตรวจสุขภาพประจำปี" = 990 บาท
 */
import { PROMOS } from '../../shared/data/homeContent.js';
import { HOTEL_ROOMS, hotelRoomByValue } from '../pet-owner/hotelOptions.js';

function promoCheckupPrice() {
  const promo = PROMOS.find((p) => String(p.title || '').includes('ตรวจสุขภาพ'));
  const amount = Number(promo?.big);
  return Number.isFinite(amount) ? amount : 990;
}

/** Clinic services with known prices on Pet-Owner-Vet */
export const CLINIC_SERVICES = [
  {
    id: 'checkup',
    label: 'ตรวจสุขภาพประจำปี',
    price: promoCheckupPrice(),
    icon: 'bi-heart-pulse',
  },
];

export const HOTEL_SERVICES = HOTEL_ROOMS.map((room) => ({
  id: room.value,
  label: `โรงแรม · ${room.label}`,
  price: room.price,
  icon: room.icon,
  unit: 'คืน',
}));

export function clinicServiceById(id) {
  return CLINIC_SERVICES.find((s) => s.id === id) || null;
}

export function hotelServiceById(id, hotelRoomPrices = []) {
  const room = hotelRoomByValue(id);
  if (!room) return null;
  const currentPrice = hotelRoomPrices.find((item) => item.id === id)?.price;
  return {
    id: room.value,
    label: `โรงแรม · ${room.label}`,
    price: Number.isFinite(Number(currentPrice)) ? Number(currentPrice) : room.price,
    icon: room.icon,
    unit: 'คืน',
  };
}

/** Destination place → whether other-service fee applies, and which catalog */
export function otherServiceKindForPlace(place) {
  if (!place) return null;
  const ref = String(place.refId || '');
  if (ref.startsWith('hotel-') || place.kind === 'hotel') return 'hotel';
  if (ref.startsWith('clinic-') || place.kind === 'clinic' || place.kind === 'facility') return 'clinic';
  return null;
}

/**
 * Resolve add-on line for outbound / round_trip.
 * inbound → always null (transport only).
 */
export function resolveOtherService({
  serviceType,
  place,
  otherServiceId,
  hotelNights = 1,
  hotelRoomPrices = [],
}) {
  if (serviceType === 'inbound') return null;
  const kind = otherServiceKindForPlace(place);
  if (!kind || !otherServiceId) return null;

  if (kind === 'hotel') {
    const room = hotelServiceById(otherServiceId, hotelRoomPrices);
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

  const clinic = clinicServiceById(otherServiceId);
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

export function catalogOptionsForPlace(place, hotelRoomPrices = []) {
  const kind = otherServiceKindForPlace(place);
  if (kind === 'hotel') {
    return HOTEL_SERVICES.map((room) => ({
      ...room,
      price: hotelServiceById(room.id, hotelRoomPrices)?.price ?? room.price,
    }));
  }
  if (kind === 'clinic') return CLINIC_SERVICES;
  return [];
}
