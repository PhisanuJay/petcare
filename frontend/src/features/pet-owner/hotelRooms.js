/** Room size catalog + display labels (sync with homeContent HOTEL_ROOMS). */

import { HOTEL_ROOM_MATRIX } from '../../shared/data/hotelRoomMatrix.js';

const ROOM_TYPE_TITLE = Object.fromEntries(HOTEL_ROOM_MATRIX.map((row) => [row.id, row.titleTh]));

export const LEGACY_ROOM_LABELS = {
  Standard: 'ไซส์ S · น้องจิ๋ว',
  Deluxe: 'ไซส์ M · มาตรฐาน',
  Suite: 'ไซส์ L · กว้างขวาง',
};

export const ROOM_THAI = {
  SizeS: 'ไซส์ S · น้องจิ๋ว',
  SizeM: 'ไซส์ M · มาตรฐาน',
  SizeL: 'ไซส์ L · กว้างขวาง',
  SizeXL: 'ไซส์ XL · ใหญ่พิเศษ',
  ...LEGACY_ROOM_LABELS,
};

export function roomLabelThai(roomName) {
  if (!roomName) return 'ไม่ระบุไซส์';
  return ROOM_THAI[roomName] || roomName;
}

export function roomTypeTitleTh(roomTypeId) {
  if (!roomTypeId) return '—';
  return ROOM_TYPE_TITLE[roomTypeId] || roomLabelThai(roomTypeId);
}