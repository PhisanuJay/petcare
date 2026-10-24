import { PARASITE_TYPES } from './petUtils.js';

export const VACCINE_FIELDS = [
  { key: 'name', label: 'ชื่อวัคซีน', placeholder: 'เช่น พิษสุนัขบ้า, รวม 5 โรค' },
  { key: 'place', label: 'สถานที่ / สัตวแพทย์', placeholder: 'เช่น PetCare, สพ.ญ.ณัฐชา' },
  { key: 'date', label: 'วันที่ฉีด', type: 'date' },
  { key: 'nextDate', label: 'นัดครั้งถัดไป', type: 'date' },
  { key: 'lot', label: 'Lot / หมายเหตุ', col: 'col-12', placeholder: 'ไม่บังคับ' },
];

export const TREATMENT_FIELDS = [
  { key: 'date', label: 'วันที่', type: 'date', col: 'col-md-4' },
  { key: 'vet', label: 'สัตวแพทย์', col: 'col-md-4' },
  { key: 'clinic', label: 'คลินิก / โรงพยาบาล', col: 'col-md-4' },
  { key: 'symptoms', label: 'อาการ', type: 'textarea' },
  { key: 'diagnosis', label: 'ผลการวินิจฉัย', type: 'textarea' },
  { key: 'treatment', label: 'การรักษา / ยาที่ได้รับ', type: 'textarea' },
  { key: 'followUp', label: 'นัดติดตามอาการ', type: 'date' },
];

export const PARASITE_FIELDS = [
  { key: 'type', label: 'ประเภท', type: 'select', options: PARASITE_TYPES },
  { key: 'product', label: 'ชื่อยา / ผลิตภัณฑ์', placeholder: 'เช่น NexGard, Drontal' },
  { key: 'date', label: 'วันที่ให้ยา', type: 'date' },
  { key: 'nextDate', label: 'ครั้งถัดไป', type: 'date' },
];

export const newVaccine = () => ({ name: '', place: '', date: '', nextDate: '', lot: '' });
export const newTreatment = () => ({
  date: '',
  vet: '',
  clinic: '',
  symptoms: '',
  diagnosis: '',
  treatment: '',
  followUp: '',
});
export const newParasite = () => ({ type: 'deworm', product: '', date: '', nextDate: '' });
