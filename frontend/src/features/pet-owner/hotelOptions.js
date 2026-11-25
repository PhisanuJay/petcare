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

export const RESERVATION_STATUS = {
  pending: { label: 'รอยืนยัน', tone: 'warn' },
  confirmed: { label: 'ยืนยันแล้ว', tone: 'ok' },
  cancelled: { label: 'ยกเลิกแล้ว', tone: '' },
};

export const formatBaht = (amount) => `${Number(amount).toLocaleString('th-TH')} บาท`;

export function hotelRoomByValue(value) {
  return HOTEL_ROOMS.find((room) => room.value === value) || null;
}

export function nightsBetween(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  return Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000);
}

export function addDays(dateString, days) {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day + days);
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
