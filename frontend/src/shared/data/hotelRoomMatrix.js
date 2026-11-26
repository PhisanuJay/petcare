/** Hotel room catalog — sync prices/ids with backend SEED_HOTEL_ROOM_* in migrate.js */

const DOG_FEATURES = {
  S: ['กรงสุนัข S ส่วนตัว', 'พื้นลื่นไม่ลื่น', 'อาหารตามเจ้าของ', 'ส่งรูปอัปเดตทุกวัน'],
  M: ['ห้องสุนัข M กว้างขึ้น', 'แอร์ 24 ชม.', 'ดู CCTV ในแอป', 'พาเล่นวันละ 2 รอบ'],
  L: ['พื้นที่ L สำหรับน้องใหญ่', 'ที่นอนนุ่ม + ของเล่น', 'CCTV รายห้อง', 'รายงานพฤติกรรมรายวัน'],
  XL: ['ห้อง XL โล่ง', 'พี่เลี้ยงดูแลใกล้ชิด', 'CCTV + อัปเดตวิดีโอ', 'อาบน้ำก่อนรับกลับ (ตามแพ็ก)'],
};

const CAT_FEATURES = {
  S: ['คอนโดแมว S เงียบ', 'แยกเสียงจากสุนัข', 'อาหารตามเจ้าของ', 'ทำความสะอาดวันละ 2 ครั้ง'],
  M: ['ห้องแมว M มีที่ปีน', 'แอร์ 24 ชม.', 'ดู CCTV ในแอป', 'รองรับหลายตัว/ห้อง (ตามขนาด)'],
  L: ['โซนแมว L กว้าง', 'ที่ปีน + กล่องทรายแยก', 'CCTV รายห้อง', 'ลดความเครียดตามธรรมชาติแมว'],
  XL: ['ห้องแมว XL หลายระดับ', 'พื้นที่เล่น + ซ่อน', 'CCTV + อัปเดตวิดีโอ', 'เหมาะหลายตัวในครอบครัวเดียว'],
};

function featuresFor(species, sizeCode) {
  const table = species === 'dog' ? DOG_FEATURES : CAT_FEATURES;
  return [...(table[sizeCode] || [])];
}

function sizeHint(species, sizeCode) {
  if (species === 'dog') {
    if (sizeCode === 'S') return 'เหมาะสุนัขเล็ก / จิ๋ว';
    if (sizeCode === 'M') return 'สุนัขขนาดกลาง — ยอดนิยม';
    if (sizeCode === 'L') return 'สุนัขกลาง–ใหญ่';
    return 'สุนัขใหญ่ / หลายตัวต่อห้องตามนโยบาย';
  }
  if (sizeCode === 'S') return 'แมวตัวเดียว / ขี้อาย';
  if (sizeCode === 'M') return 'แมว 1–2 ตัว';
  if (sizeCode === 'L') return 'แมวหลายตัว / พื้นที่กว้าง';
  return 'แมวหลายตัว / บ้านหลังใหญ่';
}

export const HOTEL_ROOM_MATRIX = [
  {
    id: 'dog_s',
    species: 'dog',
    sizeCode: 'S',
    titleTh: 'ห้องสุนัข ไซส์ S',
    descriptionTh: 'เหมาะสุนัขเล็กและจิ๋ว',
    imageUrl: '/rooms/dog-s.jpg',
    price: 450,
    maxPetsPerUnit: 1,
    totalUnits: 6,
    sortOrder: 1,
    featured: false,
    icon: 'bi-box',
    bg: '#e7f1ff',
    fg: '#2f7fc8',
  },
  {
    id: 'dog_m',
    species: 'dog',
    sizeCode: 'M',
    titleTh: 'ห้องสุนัข ไซส์ M',
    descriptionTh: 'สุนัขขนาดกลาง สบายตัว',
    imageUrl: '/rooms/dog-m.jpg',
    price: 650,
    maxPetsPerUnit: 1,
    totalUnits: 8,
    sortOrder: 2,
    featured: true,
    icon: 'bi-house-door',
    bg: '#dff3fb',
    fg: '#1f97c7',
  },
  {
    id: 'dog_l',
    species: 'dog',
    sizeCode: 'L',
    titleTh: 'ห้องสุนัข ไซส์ L',
    descriptionTh: 'สุนัขกลาง–ใหญ่',
    imageUrl: '/rooms/dog-l.jpg',
    price: 950,
    maxPetsPerUnit: 1,
    totalUnits: 5,
    sortOrder: 3,
    featured: false,
    icon: 'bi-building',
    bg: '#e8f5ee',
    fg: '#2a9d64',
  },
  {
    id: 'dog_xl',
    species: 'dog',
    sizeCode: 'XL',
    titleTh: 'ห้องสุนัข ไซส์ XL',
    descriptionTh: 'สุนัขใหญ่พิเศษ',
    imageUrl: '/rooms/dog-xl.jpg',
    price: 1350,
    maxPetsPerUnit: 2,
    totalUnits: 3,
    sortOrder: 4,
    featured: false,
    icon: 'bi-stars',
    bg: '#e6e3ff',
    fg: '#5b52d6',
  },
  {
    id: 'cat_s',
    species: 'cat',
    sizeCode: 'S',
    titleTh: 'ห้องแมว ไซส์ S',
    descriptionTh: 'แมวตัวเดียว เงียบสงบ',
    imageUrl: '/rooms/cat-s.jpg',
    price: 350,
    maxPetsPerUnit: 3,
    totalUnits: 8,
    sortOrder: 5,
    featured: false,
    icon: 'bi-box',
    bg: '#f6e0ff',
    fg: '#a454d6',
  },
  {
    id: 'cat_m',
    species: 'cat',
    sizeCode: 'M',
    titleTh: 'ห้องแมว ไซส์ M',
    descriptionTh: 'แมวขนาดกลาง มีที่ปีน',
    imageUrl: '/rooms/cat-m.jpg',
    price: 550,
    maxPetsPerUnit: 3,
    totalUnits: 10,
    sortOrder: 6,
    featured: false,
    icon: 'bi-house-door',
    bg: '#ffe8f4',
    fg: '#c4548a',
  },
  {
    id: 'cat_l',
    species: 'cat',
    sizeCode: 'L',
    titleTh: 'ห้องแมว ไซส์ L',
    descriptionTh: 'แมวหลายตัว / พื้นที่กว้าง',
    imageUrl: '/rooms/cat-l.jpg',
    price: 750,
    maxPetsPerUnit: 3,
    totalUnits: 6,
    sortOrder: 7,
    featured: false,
    icon: 'bi-building',
    bg: '#fff0e8',
    fg: '#d67a45',
  },
  {
    id: 'cat_xl',
    species: 'cat',
    sizeCode: 'XL',
    titleTh: 'ห้องแมว ไซส์ XL',
    descriptionTh: 'ห้องใหญ่สำหรับแมวหลายตัว',
    imageUrl: '/rooms/cat-xl.jpg',
    price: 1050,
    maxPetsPerUnit: 2,
    totalUnits: 4,
    sortOrder: 8,
    featured: false,
    icon: 'bi-stars',
    bg: '#e6e3ff',
    fg: '#5b52d6',
  },
].map((row) => ({
  ...row,
  sizeHint: sizeHint(row.species, row.sizeCode),
  features: featuresFor(row.species, row.sizeCode),
}));

export const HOTEL_ROOM_BY_ID = Object.fromEntries(
  HOTEL_ROOM_MATRIX.map((row) => [row.id, row]),
);

export function catalogItemFromMatrix(row) {
  return {
    id: row.id,
    species: row.species,
    sizeCode: row.sizeCode,
    titleTh: row.titleTh,
    descriptionTh: row.descriptionTh,
    imageUrl: row.imageUrl,
    price: row.price,
    maxPetsPerUnit: row.maxPetsPerUnit,
    totalUnits: row.totalUnits,
  };
}

export function pricingRoomFromMatrix(row, priceOverride) {
  const price = priceOverride ?? row.price;
  return {
    value: row.id,
    label: row.titleTh,
    name: row.titleTh,
    image: row.imageUrl,
    price,
    featured: Boolean(row.featured),
    icon: row.icon,
    bg: row.bg,
    fg: row.fg,
    sizeHint: row.sizeHint,
    features: [...row.features],
  };
}