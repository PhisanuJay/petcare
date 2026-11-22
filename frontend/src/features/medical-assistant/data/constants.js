export { VETS } from '../../../shared/data/homeContent.js';

export const STORAGE_KEY = 'petcare_ma_appointments';
export const PATIENT_NOTES_KEY = 'petcare_ma_patient_notes';
export const VISITS_KEY = 'petcare_ma_visits';

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
  ตรวจสุขภาพทั่วไป: DEFAULT_PREP_CHECKLIST,
  ฉีดวัคซีน: [
    'ตรวจสมุดวัคซีน/ประวัติแพ้วัคซีน',
    'วัดไข้ก่อนฉีด',
    'แจ้งเฝ้าดูอาการหลังฉีด 15–30 นาที',
  ],
  ถ่ายพยาธิ: DEFAULT_PREP_CHECKLIST,
  ทำหมัน: [
    'งดน้ำงดอาหารตามกำหนด',
    'เจ้าของเซ็นใบยินยอม',
    'ตรวจเลือดก่อนผ่าตัด',
    'ชั่งน้ำหนักเพื่อคำนวณยาสลบ',
    'เตรียมปลอกคอกันเลีย',
  ],
  ผ่าตัด: [
    'งดน้ำงดอาหารตามกำหนด',
    'เจ้าของเซ็นใบยินยอม',
    'ตรวจเลือดก่อนผ่าตัด',
    'ชั่งน้ำหนักเพื่อคำนวณยาสลบ',
    'เตรียมปลอกคอกันเลีย',
  ],
  ตรวจผิวหนัง: DEFAULT_PREP_CHECKLIST,
  ทำฟัน: ['ตรวจเลือดก่อนวางยาสลบ', 'งดอาหาร', 'เซ็นใบยินยอม'],
  ติดตามอาการ: DEFAULT_PREP_CHECKLIST,
};

export function getPrepChecklist(service) {
  return PREP_CHECKLISTS[service] ?? DEFAULT_PREP_CHECKLIST;
}

export const MED_ROUTES = [
  'รับประทาน',
  'ฉีดใต้ผิวหนัง',
  'ฉีดเข้ากล้าม',
  'ฉีดเข้าเส้น',
  'หยอดตา/หู',
  'ทาภายนอก',
];

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

export const OWNER_INSTRUCTION_TEMPLATES = [
  'งดอาบน้ำ 7 วัน',
  'สังเกตอาการแพ้ 24 ชม.',
  'ใส่ปลอกคอกันเลียจนตัดไหม',
  'ป้อนยาหลังอาหารและดื่มน้ำให้เพียงพอ',
];

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

export const NOTE_CATEGORIES = ['ทั่วไป', 'พฤติกรรม', 'อาการ', 'การติดต่อเจ้าของ'];

export const APPOINTMENT_STATUS = {
  pending: { value: 'pending', label: 'รอยืนยัน', tag: 'warn' },
  confirmed: { value: 'confirmed', label: 'ยืนยันแล้ว', tag: 'sky' },
  checked_in: { value: 'checked_in', label: 'มาถึงแล้ว', tag: 'sky' },
  in_treatment: { value: 'in_treatment', label: 'กำลังตรวจ', tag: 'warn' },
  completed: { value: 'completed', label: 'เสร็จสิ้น', tag: 'ok' },
  cancelled: { value: 'cancelled', label: 'ยกเลิก', tag: 'danger' },
  no_show: { value: 'no_show', label: 'ไม่มาตามนัด', tag: 'danger' },
  rejected: { value: 'rejected', label: 'ปฏิเสธ', tag: 'danger' },
};

export const STATUS_LIST = Object.values(APPOINTMENT_STATUS);

export const STATUS_TRANSITIONS = {
  pending: ['confirmed', 'cancelled', 'rejected'],
  confirmed: ['checked_in', 'no_show', 'cancelled'],
  checked_in: ['in_treatment'],
  in_treatment: ['completed'],
  completed: [],
  cancelled: [],
  no_show: [],
  rejected: [],
};

export const FINAL_STATUSES = ['completed', 'cancelled', 'no_show', 'rejected'];

export const BOOKING_SOURCES = {
  online: { value: 'online', label: 'จองออนไลน์', icon: 'bi-globe2', tag: 'sky' },
  phone: { value: 'phone', label: 'โทรศัพท์', icon: 'bi-telephone', tag: 'ok' },
  walk_in: { value: 'walk_in', label: 'Walk-in', icon: 'bi-door-open', tag: '' },
};

export const BOOKING_SOURCE_LIST = Object.values(BOOKING_SOURCES);

export const sourceOf = (value) => BOOKING_SOURCES[value] ?? BOOKING_SOURCES.walk_in;

export const REJECT_REASONS = [
  'คิวเต็ม',
  'สัตวแพทย์ไม่ว่าง',
  'บริการไม่เปิดให้จองออนไลน์',
  'ข้อมูลไม่ครบ/ติดต่อไม่ได้',
  'อื่นๆ',
];

export const CLINIC_HOURS = { open: '09:00', close: '18:00', slotMin: 30 };

export const SERVICE_TYPES = [
  'ตรวจสุขภาพทั่วไป',
  'ฉีดวัคซีน',
  'ถ่ายพยาธิ',
  'ทำหมัน',
  'ผ่าตัด',
  'ตรวจผิวหนัง',
  'ทำฟัน',
  'ติดตามอาการ',
];

export const DURATION_OPTIONS = [15, 30, 45, 60, 90];

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
