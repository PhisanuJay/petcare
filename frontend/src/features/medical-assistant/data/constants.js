export { VETS } from '../../../shared/data/homeContent.js';
export {
  BOOKING_SERVICES,
  OPENING_HOURS,
  availableSlots,
  slotsForDate,
  todayString,
} from '../../pet-owner/bookingOptions.js';

export const STAGE_META = {
  pending: { value: 'pending', label: 'รอยืนยัน', tag: 'warn', icon: 'bi-hourglass-split' },
  confirmed: { value: 'confirmed', label: 'ยืนยันแล้ว', tag: 'sky', icon: 'bi-calendar2-check' },
  checked_in: { value: 'checked_in', label: 'มาถึงแล้ว', tag: 'sky', icon: 'bi-geo-alt' },
  in_treatment: { value: 'in_treatment', label: 'กำลังตรวจ', tag: 'warn', icon: 'bi-heart-pulse' },
  completed: { value: 'completed', label: 'เสร็จสิ้น', tag: 'ok', icon: 'bi-check2-circle' },
  no_show: { value: 'no_show', label: 'ไม่มาตามนัด', tag: 'danger', icon: 'bi-person-x' },
  rejected: { value: 'rejected', label: 'ปฏิเสธแล้ว', tag: 'danger', icon: 'bi-x-circle' },
  cancelled: { value: 'cancelled', label: 'เจ้าของยกเลิก', tag: '', icon: 'bi-slash-circle' },
};

export const STAGE_LIST = Object.values(STAGE_META);

/** สถานะที่แสดงเป็นแท็บกรองบนหน้านัดหมาย (ไม่รวมปฏิเสธ/ยกเลิก — จัดการที่หน้าคำขอจอง) */
export const STAGE_TAB_LIST = STAGE_LIST.filter(
  (s) => s.value !== 'rejected' && s.value !== 'cancelled',
);

export const FINAL_STAGES = ['completed', 'no_show', 'rejected', 'cancelled'];

export const TRIAGE_LEVELS = {
  urgent: { value: 'urgent', label: 'ด่วน', tag: 'danger', priority: 1 },
  soon: { value: 'soon', label: 'เร่ง', tag: 'warn', priority: 2 },
  normal: { value: 'normal', label: 'ปกติ', tag: 'sky', priority: 3 },
};

export const TRIAGE_LEVEL_LIST = Object.values(TRIAGE_LEVELS);

// ค่าอ้างอิงเพื่อการแจ้งเตือนเบื้องต้น ให้สัตวแพทย์ตรวจสอบ
export const VITAL_RANGES = {
  dog: {
    temp: { min: 37.5, max: 39.2, unit: '°C', label: 'อุณหภูมิ' },
    heartRate: { min: 60, max: 140, unit: 'ครั้ง/นาที', label: 'ชีพจร' },
    respRate: { min: 10, max: 30, unit: 'ครั้ง/นาที', label: 'อัตราหายใจ' },
  },
  cat: {
    temp: { min: 38.0, max: 39.2, unit: '°C', label: 'อุณหภูมิ' },
    heartRate: { min: 140, max: 220, unit: 'ครั้ง/นาที', label: 'ชีพจร' },
    respRate: { min: 20, max: 30, unit: 'ครั้ง/นาที', label: 'อัตราหายใจ' },
  },
  rabbit: {
    temp: { min: 38.5, max: 40.0, unit: '°C', label: 'อุณหภูมิ' },
    heartRate: { min: 130, max: 325, unit: 'ครั้ง/นาที', label: 'ชีพจร' },
    respRate: { min: 30, max: 60, unit: 'ครั้ง/นาที', label: 'อัตราหายใจ' },
  },
  default: {
    temp: { min: 37.5, max: 39.5, unit: '°C', label: 'อุณหภูมิ' },
    heartRate: { min: 60, max: 200, unit: 'ครั้ง/นาที', label: 'ชีพจร' },
    respRate: { min: 15, max: 40, unit: 'ครั้ง/นาที', label: 'อัตราหายใจ' },
  },
};

const DEFAULT_PREP_CHECKLIST = ['ชั่งน้ำหนัก', 'วัดไข้', 'ตรวจประวัติแพ้ยา'];

export const PREP_CHECKLISTS = {
  checkup: [
    'ชั่งน้ำหนักและบันทึกน้ำหนักเทียบครั้งก่อน',
    'วัดอุณหภูมิ ชีพจร และอัตราการหายใจ',
    'ซักประวัติอาการและตรวจประวัติแพ้ยา',
  ],
  vaccine: [
    'ตรวจสมุดวัคซีนและประวัติการฉีดครั้งก่อน',
    'วัดไข้และตรวจสุขภาพเบื้องต้นก่อนรับวัคซีน',
    'ตรวจประวัติแพ้วัคซีนหรือยาที่เคยได้รับ',
    'เตรียมข้อมูลแจ้งเจ้าของเฝ้าดูอาการหลังฉีด 15–30 นาที',
  ],
  parasite: [
    'ชั่งน้ำหนักเพื่อใช้อ้างอิงขนาดยา',
    'ตรวจประวัติการให้ยาถ่ายพยาธิ/ป้องกันเห็บหมัดครั้งล่าสุด',
    'ตรวจประวัติแพ้ยา',
  ],
  followup: [
    'ชั่งน้ำหนักและวัดสัญญาณชีพเปรียบเทียบกับครั้งก่อน',
    'ซักถามอาการเปลี่ยนแปลงและยาที่ป้อนไปล่าสุด',
    'ทบทวนบันทึกการรักษาก่อนหน้าของสัตวแพทย์',
  ],
  other: DEFAULT_PREP_CHECKLIST,
};

export function getPrepChecklist(service) {
  return PREP_CHECKLISTS[service] ?? DEFAULT_PREP_CHECKLIST;
}

export const BCS_SCALE = [
  { value: 1, label: '1/9 - ผอมมากจนเห็นกระดูกชัดเจน' },
  { value: 2, label: '2/9 - ผอมมาก เอวคอดลึก' },
  { value: 3, label: '3/9 - ผอม คลำซี่โครงได้ง่าย' },
  { value: 4, label: '4/9 - ค่อนข้างผอม ไขมันน้อย' },
  { value: 5, label: '5/9 - สมส่วนพอดี (Ideal)' },
  { value: 6, label: '6/9 - เริ่มมีน้ำหนักเกินเล็กน้อย' },
  { value: 7, label: '7/9 - น้ำหนักเกิน คลำซี่โครงยาก' },
  { value: 8, label: '8/9 - อ้วน ไขมันสะสมมาก' },
  { value: 9, label: '9/9 - อ้วนมาก เสี่ยงโรคแทรกซ้อน' },
];

export const PAIN_SCALE = [
  { value: 0, label: '0 - ไม่เจ็บปวด สบายดี' },
  { value: 1, label: '1 - เจ็บเล็กน้อย (ยังซน/กินได้)' },
  { value: 2, label: '2 - เจ็บปานกลาง (ซึม/เลียตำแหน่งเจ็บ)' },
  { value: 3, label: '3 - เจ็บมาก (ไม่ยอมให้จับ/ร้องคราง)' },
  { value: 4, label: '4 - เจ็บรุนแรง (กระสับกระส่าย/ก้าวร้าวจากความเจ็บ)' },
];

export const MUCOUS_OPTIONS = ['ชมพู (ปกติ)', 'ซีด', 'เหลือง', 'ม่วงคล้ำ', 'แดงจัด'];
export const CRT_OPTIONS = ['< 2 วินาที (ปกติ)', '≥ 2 วินาที (ช้า)'];

export const CAUTION_FLAGS = {
  aggressive: {
    value: 'aggressive',
    label: 'ดุ/กัด',
    icon: 'bi-exclamation-diamond-fill',
    tag: 'danger',
  },
  drug_allergy: {
    value: 'drug_allergy',
    label: 'แพ้ยา',
    icon: 'bi-capsule',
    tag: 'danger',
  },
  anxious: {
    value: 'anxious',
    label: 'ตื่นกลัวง่าย',
    icon: 'bi-lightning-charge-fill',
    tag: 'warn',
  },
  contagious: {
    value: 'contagious',
    label: 'สงสัยโรคติดต่อ (แยกห้อง)',
    icon: 'bi-shield-exclamation',
    tag: 'danger',
  },
  senior: {
    value: 'senior',
    label: 'สัตว์สูงวัย/ต้องระวังพิเศษ',
    icon: 'bi-heart-pulse-fill',
    tag: 'warn',
  },
};

export const CAUTION_FLAG_LIST = Object.values(CAUTION_FLAGS);

export const FALLBACK_NOTE_CATEGORIES = ['ทั่วไป', 'พฤติกรรม', 'อาการ', 'การติดต่อเจ้าของ'];
export const FALLBACK_DURATIONS = [15, 30, 45, 60, 90];
export const FALLBACK_REJECT_REASONS = [
  'คิวเต็ม',
  'สัตวแพทย์ไม่ว่าง',
  'บริการไม่เปิดให้จองออนไลน์',
  'ข้อมูลไม่ครบ/ติดต่อไม่ได้',
  'อื่นๆ',
];

export function toDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function offsetDateKey(offsetDays = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return toDateKey(d);
}

export function timeToMinutes(time = '') {
  const [h, m] = String(time).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return NaN;
  return h * 60 + m;
}

export function minutesToTime(totalMinutes = 0) {
  const clamped = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(clamped / 60) % 24;
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
