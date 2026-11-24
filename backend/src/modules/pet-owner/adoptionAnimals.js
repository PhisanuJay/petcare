/**
 * TEMPORARY list of animals waiting for a home.
 *
 * The real list will be managed by the Adoption role (backend/src/modules/adoption). Until that exists,
 * the Pet Owner pages use these sample animals, copied from the home page
 * (frontend/src/shared/data/homeContent.js → ADOPT_ANIMALS). Replace `listAdoptionAnimals` / `findAdoptionAnimal`
 * with a lookup into the Adoption module's data when it is ready; the rest of the Pet Owner code only
 * depends on these two functions and on the animal shape below.
 *
 * Shape: { id, name, species ('dog'|'cat'), breed, sex ('male'|'female'), age, personality, tags[] }
 */
const ADOPTION_ANIMALS = [
  { id: 'sample-1', name: 'น้องถั่วเหลือง', species: 'dog', breed: 'สุนัขพันธุ์ผสม', sex: 'female', age: '1 ปี', personality: 'ขี้อ้อน ชอบเล่นกับเด็ก', tags: ['ฉีดวัคซีนแล้ว', 'ทำหมันแล้ว'] },
  { id: 'sample-2', name: 'น้องมะลิ', species: 'cat', breed: 'แมวขาวมณี', sex: 'female', age: '8 เดือน', personality: 'เรียบร้อย ชอบนอนตัก', tags: ['ฉีดวัคซีนแล้ว'] },
  { id: 'sample-3', name: 'น้องดำ', species: 'dog', breed: 'สุนัขพันธุ์ไทย', sex: 'male', age: '2 ปี', personality: 'ฉลาด เฝ้าบ้านเก่ง', tags: ['ฉีดวัคซีนแล้ว', 'ทำหมันแล้ว'] },
  { id: 'sample-4', name: 'น้องส้มโอ', species: 'cat', breed: 'แมวส้ม', sex: 'male', age: '3 เดือน', personality: 'ซน ขี้เล่น เข้ากับแมวอื่นได้', tags: ['ถ่ายพยาธิแล้ว'] },
];

export function listAdoptionAnimals() {
  return Promise.resolve(ADOPTION_ANIMALS);
}

export function findAdoptionAnimal(id) {
  return Promise.resolve(ADOPTION_ANIMALS.find((a) => a.id === id) ?? null);
}
