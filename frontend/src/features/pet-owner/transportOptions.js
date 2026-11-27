// Keep in sync with TRANSPORT_DIRECTIONS in backend/src/modules/pet-owner/routes.js
export const TRANSPORT_DIRECTIONS = [
  { value: 'to_clinic', label: 'รับจากบ้านไปคลินิก', icon: 'bi-house-door', desc: 'ทีมงานไปรับน้องที่บ้านแล้วพามาคลินิก' },
  { value: 'to_home', label: 'ส่งจากคลินิกกลับบ้าน', icon: 'bi-box-arrow-in-left', desc: 'หลังตรวจหรือรับบริการเสร็จ ทีมงานไปส่งน้องที่บ้าน' },
  { value: 'round_trip', label: 'รับ-ส่ง ไป-กลับ', icon: 'bi-arrow-left-right', desc: 'รับจากบ้านไปคลินิก และส่งกลับหลังเสร็จธุระ' },
];

export const TRANSPORT_STATUS = {
  pending: { label: 'รอยืนยัน', tone: 'warn' },
  confirmed: { label: 'ยืนยันแล้ว', tone: 'ok' },
  cancelled: { label: 'ยกเลิกแล้ว', tone: '' },
};
