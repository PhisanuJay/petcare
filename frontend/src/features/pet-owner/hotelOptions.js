/**
 * Cat hotel rooms. Names, prices and features are copied from Pet-Owner-Vet
 * (shared/data/homeContent.js → HOTEL_ROOMS / backend pet-owner routes).
 */
import { HOTEL_ROOMS as HOME_HOTEL_ROOMS } from '../../shared/data/homeContent.js';

const ROOM_VALUES = ['standard', 'deluxe', 'suite'];

export const HOTEL_ROOMS = HOME_HOTEL_ROOMS.map((room, index) => ({
  value: ROOM_VALUES[index] || `room-${index + 1}`,
  label: room.name,
  price: room.price,
  icon: room.icon,
  bg: room.bg,
  fg: room.fg,
  features: room.features || [],
}));

export const HOTEL_SPECIES = 'cat';
export const MAX_HOTEL_NIGHTS = 30;

export const formatBaht = (n) => `${Number(n).toLocaleString('th-TH')} บาท`;

export function hotelRoomByValue(value) {
  return HOTEL_ROOMS.find((r) => r.value === value) || null;
}
