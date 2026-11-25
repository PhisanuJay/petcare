/** Domain constants for Pet Transportation MVP — Chatuchak zone pricing */

export const ZONES = [
  { id: '1', label: 'Zone 1', price: 100 },
  { id: '2', label: 'Zone 2', price: 150 },
];

/** Service area: Chatuchak district only (MVP) */
export const SERVICE_DISTRICTS = [
  { id: 'chatuchak', label: 'เขตจตุจักร' },
];

/** 4 subdistricts in Chatuchak — Zone mapped for fare matrix */
export const SERVICE_SUBDISTRICTS = [
  { id: 'chatuchak', districtId: 'chatuchak', label: 'แขวงจตุจักร', zoneId: '1' },
  { id: 'chomphon', districtId: 'chatuchak', label: 'แขวงจอมพล', zoneId: '1' },
  { id: 'latyao', districtId: 'chatuchak', label: 'แขวงลาดยาว', zoneId: '2' },
  { id: 'chantharakasem', districtId: 'chatuchak', label: 'แขวงจันทรเกษม', zoneId: '2' },
];

/** Round trip no longer uses a discount — kept at 0 for legacy reads */
export const ROUND_TRIP_DISCOUNT = 0;

/** Fixed demo driver id — used by seed auth + sample jobs */
export const DEMO_DRIVER_ID = 'driver-seed';

/** 7 trip statuses — per trip, not per booking */
export const TRIP_STATUSES = [
  { id: 'assigned', label: 'มอบหมายแล้ว', step: 1 },
  { id: 'en_route_pickup', label: 'กำลังไปรับ', step: 2 },
  { id: 'arrived_pickup', label: 'ถึงจุดรับ', step: 3 },
  { id: 'picked_up', label: 'รับสัตว์แล้ว', step: 4 },
  { id: 'in_transit', label: 'กำลังเดินทาง', step: 5 },
  { id: 'arrived_dropoff', label: 'ถึงจุดส่ง', step: 6 },
  { id: 'completed', label: 'ส่งสำเร็จ', step: 7 },
];

export const TRIP_TYPES = {
  pickup: { id: 'pickup', label: 'เที่ยวไป (Pickup)' },
  dropoff: { id: 'dropoff', label: 'เที่ยวกลับ (Dropoff)' },
};

export const BOOKING_STATUSES = {
  submitted: { id: 'submitted', label: 'รอตรวจสอบ', tone: 'warn' },
  price_confirmed: { id: 'price_confirmed', label: 'ยืนยันราคาแล้ว', tone: 'info' },
  driver_assigned: { id: 'driver_assigned', label: 'มอบหมายคนขับแล้ว', tone: 'info' },
  awaiting_payment: { id: 'awaiting_payment', label: 'รอชำระเงิน', tone: 'warn' },
  paid: { id: 'paid', label: 'ชำระแล้ว', tone: 'ok' },
  in_progress: { id: 'in_progress', label: 'กำลังดำเนินการ', tone: 'info' },
  completed: { id: 'completed', label: 'เสร็จสิ้น', tone: 'ok' },
  cancel_requested: { id: 'cancel_requested', label: 'ขอยกเลิก', tone: 'warn' },
  cancelled: { id: 'cancelled', label: 'ยกเลิกแล้ว', tone: 'danger' },
};

export const PAYMENT_STATUSES = {
  unpaid: { id: 'unpaid', label: 'ยังไม่ชำระ' },
  owner_confirmed: { id: 'owner_confirmed', label: 'Owner ยืนยันว่าชำระแล้ว' },
  paid: { id: 'paid', label: 'ฝ่ายบัญชียืนยันชำระแล้ว' },
};

export const SERVICE_TYPES = [
  {
    id: 'outbound',
    label: 'ไปส่ง',
    icon: 'bi-truck',
    hint: 'รับจากบ้าน → ส่งไปคลินิก หรือปลายทาง',
  },
  {
    id: 'inbound',
    label: 'รับกลับ',
    icon: 'bi-house-door',
    hint: 'รับจากคลินิก → ส่งกลับบ้าน',
  },
  {
    id: 'round_trip',
    label: 'ไป–กลับ',
    icon: 'bi-arrow-left-right',
    hint: 'บ้าน → คลินิก แล้วรับกลับ (เวลากลับนัดภายหลัง)',
  },
];

export const LOCATION_KINDS = [
  { id: 'home', label: 'บ้าน' },
  { id: 'facility', label: 'คลินิก' },
  { id: 'custom', label: 'สถานที่อื่น' },
];

/** Normalize legacy clinic/hotel kinds → facility */
export function normalizePlaceKind(kind) {
  if (kind === 'clinic' || kind === 'hotel') return 'facility';
  return kind || 'custom';
}

export function isFacilityKind(kind) {
  return normalizePlaceKind(kind) === 'facility';
}

export function serviceTypeMeta(id) {
  if (id === 'one_way') return SERVICE_TYPES.find((s) => s.id === 'outbound');
  return SERVICE_TYPES.find((s) => s.id === id) ?? SERVICE_TYPES[0];
}

export function isRoundTrip(serviceType) {
  return serviceType === 'round_trip';
}

export function isSingleLeg(serviceType) {
  return serviceType === 'outbound' || serviceType === 'inbound' || serviceType === 'one_way';
}

export const ISSUE_REASONS = [
  { id: 'vehicle', label: 'รถเสีย' },
  { id: 'cannot_contact', label: 'ติดต่อ Owner ไม่ได้' },
  { id: 'owner_absent', label: 'Owner ไม่อยู่' },
  { id: 'pet_not_ready', label: 'สัตว์เลี้ยงไม่พร้อม' },
  { id: 'emergency', label: 'เหตุฉุกเฉิน' },
  { id: 'other', label: 'อื่น ๆ' },
];

export function tripStatusMeta(id) {
  return TRIP_STATUSES.find((s) => s.id === id) ?? TRIP_STATUSES[0];
}

export function bookingStatusMeta(id) {
  return BOOKING_STATUSES[id] ?? { id, label: id, tone: 'info' };
}

export function nextTripStatus(currentId) {
  const i = TRIP_STATUSES.findIndex((s) => s.id === currentId);
  if (i < 0 || i >= TRIP_STATUSES.length - 1) return null;
  return TRIP_STATUSES[i + 1];
}

/** Cancellation by owner only before pet pickup */
export function canOwnerRequestCancel(booking, trips) {
  if (!booking) return false;
  if (['cancelled', 'completed'].includes(booking.status)) return false;
  if (booking.status === 'cancel_requested') return false;
  const related = trips.filter((t) => t.bookingId === booking.id);
  return related.every((t) => {
    const step = tripStatusMeta(t.status).step;
    return step < 4; // before picked_up
  });
}
