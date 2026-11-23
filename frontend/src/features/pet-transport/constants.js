/** Domain constants for Pet Transportation MVP */

export const ZONES = [
  { id: 'A', label: 'Zone A', minKm: 0, maxKm: 5, price: 100 },
  { id: 'B', label: 'Zone B', minKm: 5, maxKm: 10, price: 180 },
  { id: 'C', label: 'Zone C', minKm: 10, maxKm: 20, price: 300 },
  { id: 'OUT', label: 'นอกพื้นที่', minKm: 20, maxKm: Infinity, price: null },
];

export const ROUND_TRIP_DISCOUNT = 0.1;

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
  paid: { id: 'paid', label: 'Admin ยืนยันชำระแล้ว' },
};

export const SERVICE_TYPES = [
  { id: 'one_way', label: 'เที่ยวเดียว' },
  { id: 'round_trip', label: 'ไป–กลับ' },
];

export const LOCATION_KINDS = [
  { id: 'home', label: 'บ้าน Owner' },
  { id: 'clinic', label: 'คลินิก' },
  { id: 'hotel', label: 'โรงแรมสัตว์' },
  { id: 'custom', label: 'สถานที่อื่น' },
];

export const ISSUE_REASONS = [
  { id: 'vehicle', label: 'รถเสีย' },
  { id: 'cannot_contact', label: 'ติดต่อ Owner ไม่ได้' },
  { id: 'owner_absent', label: 'Owner ไม่อยู่' },
  { id: 'pet_not_ready', label: 'สัตว์เลี้ยงไม่พร้อม' },
  { id: 'emergency', label: 'เหตุฉุกเฉิน' },
  { id: 'other', label: 'อื่น ๆ' },
];

export const DEMO_DRIVERS = [
  { id: 'drv-1', name: 'สมชาย ใจดี', phone: '081-111-1111', vehicle: 'รถตู้ขาว กข 1234' },
  { id: 'drv-2', name: 'วิภา ขับดี', phone: '082-222-2222', vehicle: 'รถเก๋งเทา คค 5678' },
  { id: 'drv-3', name: 'อนุชา ตรงเวลา', phone: '083-333-3333', vehicle: 'รถตู้เงิน งง 9012' },
];

export const DEMO_CLINICS = [
  { id: 'clinic-1', name: 'คลินิกมะแอ่ว สาขาหลัก', address: '123 ถ.สุขุมวิท กรุงเทพฯ' },
  { id: 'clinic-2', name: 'คลินิกมะแอ่ว สาขาลาดพร้าว', address: '88 ถ.ลาดพร้าว กรุงเทพฯ' },
];

export const DEMO_HOTELS = [
  { id: 'hotel-1', name: 'PetCare Hotel Ari', address: '45 อารีย์ กรุงเทพฯ' },
  { id: 'hotel-2', name: 'Cat Nest Thonglor', address: '12 ทองหล่อ กรุงเทพฯ' },
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
