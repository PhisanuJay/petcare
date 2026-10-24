export const SPECIES = [
  { value: 'dog', label: 'สุนัข', emoji: '🐶' },
  { value: 'cat', label: 'แมว', emoji: '🐱' },
  { value: 'rabbit', label: 'กระต่าย', emoji: '🐰' },
  { value: 'bird', label: 'นก', emoji: '🐦' },
  { value: 'rodent', label: 'หนู / แฮมสเตอร์', emoji: '🐹' },
  { value: 'reptile', label: 'สัตว์เลื้อยคลาน', emoji: '🐢' },
  { value: 'other', label: 'อื่นๆ', emoji: '🐾' },
];

export const SEX_OPTIONS = [
  { value: 'male', label: 'เพศผู้' },
  { value: 'female', label: 'เพศเมีย' },
  { value: 'unknown', label: 'ไม่ทราบ' },
];

export const NEUTER_OPTIONS = [
  { value: 'yes', label: 'ทำหมันแล้ว' },
  { value: 'no', label: 'ยังไม่ทำหมัน' },
  { value: 'unknown', label: 'ไม่ทราบ' },
];

export const PARASITE_TYPES = [
  { value: 'deworm', label: 'ถ่ายพยาธิ' },
  { value: 'flea', label: 'ป้องกันเห็บหมัด' },
  { value: 'heartworm', label: 'ป้องกันพยาธิหนอนหัวใจ' },
];

export const labelOf = (options, value) => options.find((o) => o.value === value)?.label ?? '-';

export const speciesOf = (value) => SPECIES.find((s) => s.value === value) ?? SPECIES.at(-1);

export function formatDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ageText(birthDate) {
  if (!birthDate) return 'ไม่ระบุอายุ';
  const birth = new Date(birthDate);
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) return 'ไม่ระบุอายุ';
  if (months < 1) return 'น้อยกว่า 1 เดือน';
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (!years) return `${rest} เดือน`;
  return rest ? `${years} ปี ${rest} เดือน` : `${years} ปี`;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function daysUntil(value) {
  const target = new Date(value);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - startOfToday()) / 86400000);
}

/**
 * Upcoming / overdue care items (vaccines, parasite prevention) across the given pets,
 * sorted by due date.
 */
export function careReminders(pets) {
  const items = [];
  for (const pet of pets) {
    for (const v of pet.vaccines ?? []) {
      if (v.nextDate) items.push({ pet, kind: 'vaccine', title: `วัคซีน ${v.name || ''}`.trim(), date: v.nextDate });
    }
    for (const p of pet.parasites ?? []) {
      if (p.nextDate) items.push({ pet, kind: 'parasite', title: labelOf(PARASITE_TYPES, p.type), date: p.nextDate });
    }
  }
  return items
    .map((item) => {
      const days = daysUntil(item.date);
      const status = days < 0 ? 'overdue' : days <= 30 ? 'soon' : 'later';
      return { ...item, days, status };
    })
    .sort((a, b) => a.days - b.days);
}

export function reminderText(r) {
  if (r.days < 0) return `เลยกำหนด ${Math.abs(r.days)} วัน`;
  if (r.days === 0) return 'ครบกำหนดวันนี้';
  return `อีก ${r.days} วัน`;
}

export function emptyPet() {
  return {
    photo: '',
    name: '',
    species: 'dog',
    breed: '',
    sex: 'unknown',
    birthDate: '',
    weight: '',
    color: '',
    microchip: '',
    neutered: 'unknown',
    allergies: '',
    chronicDiseases: '',
    medications: '',
    food: '',
    notes: '',
    vaccines: [],
    treatments: [],
    parasites: [],
  };
}
