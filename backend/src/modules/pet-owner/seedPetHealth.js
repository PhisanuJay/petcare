/** Demo health timelines by pet name (applied only when all record lists are empty). */
const BY_NAME = {
  ดีดี้: {
    vaccines: [
      {
        id: 'vac-ddy-001',
        source: 'vet',
        name: 'วัคซีนรวม 5 โรค',
        place: 'PetCare Clinic',
        vet: 'สพ.ญ.ณัฐชา ใจดี',
        date: '2024-03-15',
        nextDate: '2025-03-15',
        lot: 'LOT-5in1-2403',
      },
      {
        id: 'vac-ddy-002',
        source: 'vet',
        name: 'วัคซีนพิษสุนัขบ้า',
        place: 'PetCare Clinic',
        vet: 'สพ.ญ.ณัฐชา ใจดี',
        date: '2024-04-20',
        nextDate: '2025-04-20',
        lot: 'RAB-2024-A',
      },
      {
        id: 'vac-ddy-003',
        source: 'vet',
        name: 'วัคซีนรวม 5 โรค (เข็มกระตุ้น)',
        place: 'PetCare Clinic',
        vet: 'น.สพ.วิทยา รักสัตว์',
        date: '2025-03-10',
        nextDate: '2026-03-10',
        lot: 'LOT-5in1-2503',
      },
    ],
    treatments: [
      {
        id: 'trt-ddy-001',
        source: 'vet',
        date: '2024-06-08',
        vet: 'สพ.ญ.ณัฐชา ใจดี',
        clinic: 'PetCare Clinic',
        symptoms: 'มาตรวจสุขภาพประจำปี',
        diagnosis: 'สุขภาพแข็งแรง',
        treatment: 'ตรวจร่างกาย ฟังหัวใจ ตรวจเหงือก',
        followUp: '',
      },
      {
        id: 'trt-ddy-002',
        source: 'vet',
        date: '2025-08-12',
        vet: 'น.สพ.ธนกฤต มีเมตตา',
        clinic: 'PetCare Clinic',
        symptoms: 'เกาตัวบ่อย ผิวแดงที่หลัง',
        diagnosis: 'แพ้เห็บหมัด / ผิวหนังอักเสบเล็กน้อย',
        treatment: 'ให้ยาทาแก้อักเสบ แนะนำป้องกันเห็บหมัด',
        followUp: '2025-09-12',
      },
    ],
    parasites: [
      {
        id: 'par-ddy-001',
        source: 'vet',
        type: 'deworm',
        product: 'Drontal Plus',
        vet: 'สพ.ญ.ณัฐชา ใจดี',
        date: '2025-05-01',
        nextDate: '2025-11-01',
      },
      {
        id: 'par-ddy-002',
        source: 'vet',
        type: 'flea',
        product: 'NexGard Spectra',
        vet: 'น.สพ.วิทยา รักสัตว์',
        date: '2025-10-15',
        nextDate: '2025-12-15',
      },
    ],
  },
  ดาด้า: {
    vaccines: [
      {
        id: 'vac-dda-001',
        source: 'vet',
        name: 'วัคซีนแมว 3 โรค (FVRCP)',
        place: 'PetCare Clinic',
        vet: 'สพ.ญ.พิมพ์ชนก แสนสุข',
        date: '2024-07-05',
        nextDate: '2025-07-05',
        lot: 'FVRCP-2407',
      },
      {
        id: 'vac-dda-002',
        source: 'vet',
        name: 'วัคซีนพิษสุนัขบ้า (แมว)',
        place: 'PetCare Clinic',
        vet: 'สพ.ญ.พิมพ์ชนก แสนสุข',
        date: '2024-08-10',
        nextDate: '2025-08-10',
        lot: 'RAB-CAT-24',
      },
      {
        id: 'vac-dda-003',
        source: 'vet',
        name: 'วัคซีน FVRCP (ตามอายุ)',
        place: 'PetCare Clinic',
        vet: 'สพ.ญ.ณัฐชา ใจดี',
        date: '2025-07-02',
        nextDate: '2026-07-02',
        lot: 'FVRCP-2507',
      },
    ],
    treatments: [
      {
        id: 'trt-dda-001',
        source: 'vet',
        date: '2024-11-20',
        vet: 'สพ.ญ.พิมพ์ชนก แสนสุข',
        clinic: 'PetCare Clinic',
        symptoms: 'ไอเล็กน้อย หลังฝนตก',
        diagnosis: 'หวัดแมวเล็กน้อย',
        treatment: 'ให้ยาลดน้ำมูก แนะนำอากาศถ่ายเท',
        followUp: '2024-11-27',
      },
      {
        id: 'trt-dda-002',
        source: 'vet',
        date: '2025-09-18',
        vet: 'สพ.ญ.ณัฐชา ใจดี',
        clinic: 'PetCare Clinic',
        symptoms: 'ตรวจฟันประจำปี',
        diagnosis: 'มีคราบหินปูนเล็กน้อย',
        treatment: 'ขูดหินปูน + โพลีวิทีซี',
        followUp: '2026-03-18',
      },
    ],
    parasites: [
      {
        id: 'par-dda-001',
        source: 'vet',
        type: 'deworm',
        product: 'Profender Spot-on',
        vet: 'สพ.ญ.พิมพ์ชนก แสนสุข',
        date: '2025-04-12',
        nextDate: '2025-10-12',
      },
      {
        id: 'par-dda-002',
        source: 'vet',
        type: 'flea',
        product: 'Bravecto Cat',
        vet: 'สพ.ญ.ณัฐชา ใจดี',
        date: '2025-09-01',
        nextDate: '2025-12-01',
      },
    ],
  },
};

function isHealthEmpty(pet) {
  return !(pet.vaccines?.length) && !(pet.treatments?.length) && !(pet.parasites?.length);
}

/** Overlay demo records at read time (does not persist until owner saves a pet). */
export function withDemoHealthIfEmpty(pet) {
  if (!isHealthEmpty(pet)) return pet;
  const sample = BY_NAME[pet.name?.trim()];
  if (!sample) return pet;
  return {
    ...pet,
    vaccines: [...(sample.vaccines || [])],
    treatments: [...(sample.treatments || [])],
    parasites: [...(sample.parasites || [])],
  };
}