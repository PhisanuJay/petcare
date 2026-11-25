/**
<<<<<<< HEAD
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
=======
 * Cat hotel rooms. Names, prices and features are copied from the home page
 * (shared/data/homeContent.js → HOTEL_ROOMS). Keep prices in sync with the backend (routes.js).
 */
export const HOTEL_ROOMS = [
  {
    value: 'standard',
    label: 'Standard',
    price: 450,
    icon: 'bi-house-door',
    bg: '#e7f1ff',
    fg: '#2f7fc8',
    features: ['ห้องส่วนตัวสำหรับน้องเล็ก', 'อาหาร 2 มื้อ ตามที่เจ้าของกำหนด', 'ทำความสะอาดวันละ 2 ครั้ง', 'ส่งรูปอัปเดตทุกวัน'],
  },
  {
    value: 'deluxe',
    label: 'Deluxe',
    price: 750,
    icon: 'bi-building',
    bg: '#dff3fb',
    fg: '#1f97c7',
    features: ['ห้องกว้าง มีคอนโดแมว / ของเล่น', 'แอร์ 24 ชั่วโมง', 'ดูน้องผ่าน CCTV ในแอป', 'พาเล่น / เดินเล่นวันละ 2 รอบ'],
  },
  {
    value: 'suite',
    label: 'Suite',
    price: 1200,
    icon: 'bi-stars',
    bg: '#e6e3ff',
    fg: '#5b52d6',
    features: ['ห้องสวีทพร้อมโซฟาและที่นอนนุ่ม', 'พี่เลี้ยงดูแลใกล้ชิด', 'CCTV + วิดีโอคอลหาน้องได้', 'อาบน้ำก่อนกลับบ้านฟรี'],
  },
];

export const HOTEL_SPECIES = 'cat'; // this hotel only takes cats
export const MAX_HOTEL_NIGHTS = 30;

export const RESERVATION_STATUS = {
  pending: { label: 'รอยืนยัน', tone: 'warn' },
  confirmed: { label: 'ยืนยันแล้ว', tone: 'ok' },
  cancelled: { label: 'ยกเลิกแล้ว', tone: '' },
};

/** Whole nights between two 'YYYY-MM-DD' dates (0 if either is missing). */
export function nightsBetween(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  return Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000);
}

export function addDays(dateString, days) {
  const [y, m, d] = dateString.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const formatBaht = (n) => `${n.toLocaleString('th-TH')} บาท`;
>>>>>>> origin/Pet-Owner-Vet
