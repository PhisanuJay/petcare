// Keep in sync with HOUSING / EXPERIENCE in backend/src/modules/pet-owner/routes.js
export const HOUSING_OPTIONS = [
  { value: 'house', label: 'บ้านเดี่ยว' },
  { value: 'townhome', label: 'ทาวน์เฮาส์ / ทาวน์โฮม' },
  { value: 'condo', label: 'คอนโดมิเนียม' },
  { value: 'apartment', label: 'หอพัก / อพาร์ตเมนต์' },
  { value: 'other', label: 'อื่นๆ' },
];

export const EXPERIENCE_OPTIONS = [
  { value: 'none', label: 'ยังไม่เคยเลี้ยง' },
  { value: 'some', label: 'เคยเลี้ยงมาบ้าง' },
  { value: 'experienced', label: 'มีประสบการณ์เลี้ยงมานาน' },
];

export const ADOPTION_STATUS = {
  pending: { label: 'รอพิจารณา', tone: 'warn' },
  cancelled: { label: 'ยกเลิกแล้ว', tone: '' },
};

export const adoptionEmoji = (species) => (species === 'cat' ? '🐱' : '🐶');
