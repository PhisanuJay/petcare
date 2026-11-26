import vet1 from '../../assets/vet-1.jpg';
import vet2 from '../../assets/vet-2.jpg';
import vet3 from '../../assets/vet-3.jpg';
import vet4 from '../../assets/vet-4.jpg';

/** Static marketing copy for the landing page (not live DB records). */

export const STATS = [
  { num: '12+', label: 'ปีที่เปิดให้บริการ' },
  { num: '15', label: 'สัตวแพทย์' },
  { num: '30K+', label: 'เคสที่ดูแล' },
  { num: '24/7', label: 'ฉุกเฉิน' },
];

export const SERVICES = [
  {
    icon: 'bi-clipboard2-pulse',
    title: 'ตรวจสุขภาพ',
    desc: 'ตรวจร่างกาย เลือด และปรึกษาคุณหมอตามอาการ',
    bg: '#dcecfc',
    fg: '#2f7fc8',
    href: '/pet-owner/services',
    cta: 'จองคิวตรวจ',
  },
  {
    icon: 'bi-capsule',
    title: 'ฉีดวัคซีน',
    desc: 'แพ็กวัคซีนครบตามวัย พร้อมแจ้งเตือนนัดถัดไป',
    bg: '#dff5e8',
    fg: '#2a9d64',
    href: '/pet-owner/services',
    cta: 'จองฉีดวัคซีน',
  },
  {
    icon: 'bi-bandaid',
    title: 'ผ่าตัด / ทำหมัน',
    desc: 'ห้องผ่าตัดมาตรฐาน มีทีมเฝ้าระวังหลังทำหัตถการ',
    bg: '#e8eefc',
    fg: '#3d5a98',
    href: '/pet-owner/services',
    cta: 'ปรึกษาคิวผ่าตัด',
  },
  {
    icon: 'bi-emoji-smile',
    title: 'ทันตกรรม',
    desc: 'ขูดหินปูน ตรวจช่องปาก และดูแลฟันให้สะอาด',
    bg: '#fff1c9',
    fg: '#c48f00',
    href: '/pet-owner/services',
    cta: 'จองทันตกรรม',
  },
  {
    icon: 'bi-building',
    title: 'โรงแรมสัตว์',
    desc: 'ฝากน้องได้ทั้งวัน มี CCTV และคุณหมอดูแล 24 ชม.',
    bg: '#dff3fb',
    fg: '#1f97c7',
    href: '/#hotel',
    cta: 'ดูห้องพัก',
  },
];

export const HOTEL_ROOMS = [
  {
    name: 'SizeS',
    price: 380,
    image: '/rooms/size-s.jpg',
    icon: 'bi-box',
    bg: '#e7f1ff',
    fg: '#2f7fc8',
    sizeHint: 'เหมาะน้องเล็ก เช่น แมว / สุนัขจิ๋ว',
    features: ['กรงขนาด S ส่วนตัว', 'อาหาร 2 มื้อตามเจ้าของกำหนด', 'ทำความสะอาดวันละ 2 ครั้ง', 'ส่งรูปอัปเดตทุกวัน'],
  },
  {
    name: 'SizeM',
    price: 580,
    image: '/rooms/size-m.jpg',
    icon: 'bi-house-door',
    bg: '#dff3fb',
    fg: '#1f97c7',
    featured: true,
    sizeHint: 'น้องขนาดกลางเล็ก — ยอดนิยม',
    features: ['กรงขนาด M กว้างสบาย', 'แอร์ตลอด 24 ชม.', 'ดูน้องผ่าน CCTV ในแอป', 'พาเล่นวันละ 2 รอบ'],
  },
  {
    name: 'SizeL',
    price: 880,
    image: '/rooms/size-l.jpg',
    icon: 'bi-building',
    bg: '#e8f5ee',
    fg: '#2a9d64',
    sizeHint: 'น้องกลาง–ใหญ่ ต้องการพื้นที่มาก',
    features: ['กรงขนาด L โล่ง', 'ของเล่นและที่นอนนุ่ม', 'CCTV รายกรง', 'รายงานพฤติกรรมรายวัน'],
  },
  {
    name: 'SizeXL',
    price: 1280,
    image: '/rooms/size-xl.jpg',
    icon: 'bi-stars',
    bg: '#e6e3ff',
    fg: '#5b52d6',
    sizeHint: 'น้องใหญ่หรือต้องการพื้นที่มากเป็นพิเศษ',
    features: ['กรงขนาด XL', 'พี่เลี้ยงดูแลใกล้ชิด', 'CCTV + อัปเดตวิดีโอ', 'อาบน้ำก่อนรับกลับ (ตามแพ็ก)'],
  },
];

export const HOTEL_PERKS = [
  { icon: 'bi-heart-pulse', title: 'สัตวแพทย์ประจำ 24 ชม.', desc: 'ดูแลทันทีหากไม่สบาย' },
  { icon: 'bi-camera-video', title: 'CCTV ดูน้องได้ตลอด', desc: 'เปิดดูผ่านมือถือ' },
  { icon: 'bi-shield-check', title: 'แยกโซนหมา-แมว', desc: 'ลดความเครียด ปลอดภัย' },
  { icon: 'bi-truck', title: 'บริการรับ-ส่งถึงบ้าน', desc: 'สะดวก ไม่ต้องเดินทาง' },
];

/** Teaser cards on homepage — full list from GET /api/adoption/animals */
export const ADOPT_ANIMALS = [
  {
    name: 'น้องถั่วเหลือง',
    breed: 'พันธุ์ผสม',
    age: '1 ปี',
    personality: 'ขี้อ้อน ชอบเล่นกับเด็ก',
    sex: 'female',
    photo: '/adoption/adopt-001.jpg',
    bg: '#fff1c9',
    tags: ['ฉีดวัคซีนแล้ว', 'ทำหมันแล้ว'],
  },
  {
    name: 'น้องมะลิ',
    breed: 'ขาวมณี',
    age: '8 เดือน',
    personality: 'เรียบร้อย ชอบนอนตัก',
    sex: 'female',
    photo: '/adoption/adopt-002.jpg',
    bg: '#e7f1ff',
    tags: ['ฉีดวัคซีนแล้ว'],
  },
  {
    name: 'น้องดำ',
    breed: 'ไทย',
    age: '2 ปี',
    personality: 'ฉลาด เป็นมิตรกับคนคุ้นเคย',
    sex: 'male',
    photo: '/adoption/adopt-003.jpg',
    bg: '#dff5e8',
    tags: ['ฉีดวัคซีนแล้ว', 'ทำหมันแล้ว'],
  },
  {
    name: 'น้องส้มโอ',
    breed: 'แมวส้ม',
    age: '3 เดือน',
    personality: 'ซน ขี้เล่น เข้ากับแมวตัวอื่นได้',
    sex: 'male',
    photo: '/adoption/adopt-004.jpg',
    bg: '#ffe6d9',
    tags: ['ถ่ายพยาธิแล้ว'],
  },
];

export const ADOPT_STEPS = [
  { icon: 'bi-search-heart', title: 'เลือกน้องที่ใช่' },
  { icon: 'bi-file-earmark-text', title: 'กรอกแบบฟอร์มขอรับเลี้ยง' },
  { icon: 'bi-chat-heart', title: 'พูดคุย / เยี่ยมบ้าน' },
  { icon: 'bi-house-heart', title: 'รับน้องกลับบ้าน' },
];

export const WHY = [
  { title: 'คุณหมอใจดี', desc: 'อธิบายละเอียด ไม่เร่งรีบ' },
  { title: 'จองคิวออนไลน์', desc: 'เลือกวัน เวลา หมอได้เอง' },
  { title: 'ประวัติครบในแอป', desc: 'ดูผลตรวจย้อนหลังได้ทุกครั้ง' },
  { title: 'สะสมแต้มแลกส่วนลด', desc: 'ยิ่งมาบ่อย ยิ่งคุ้ม' },
];

export const VETS = [
  { img: vet1, name: 'สพ.ญ.ณัฐชา ใจดี', spec: 'อายุรกรรม' },
  { img: vet2, name: 'น.สพ.วิทยา รักสัตว์', spec: 'ศัลยกรรม' },
  { img: vet3, name: 'สพ.ญ.พิมพ์ชนก แสนสุข', spec: 'แมวโดยเฉพาะ' },
  { img: vet4, name: 'น.สพ.ธนกฤต มีเมตตา', spec: 'ผิวหนัง' },
];

export const HOTEL_STAY_PROMO = {
  percent: 15,
  minNights: 3,
  until: '2026-12-31',
  title: 'พักโรงแรม 3 คืนขึ้นไป',
  desc: 'ทุกประเภทห้อง ถึง 31 ธ.ค.',
};

export const PROMOS = [
  { big: '20%', small: 'OFF', bg: 'var(--sky)', title: 'แพ็กเกจวัคซีนลูกสัตว์', desc: 'ครบชุด 3 เข็ม ถึง 30 พ.ย.', cta: 'เก็บคูปอง' },
  { big: '990', small: 'บาท', bg: '#7bc8a4', title: 'ตรวจสุขภาพประจำปี', desc: 'เลือด + ร่างกาย + ปรึกษาหมอ', cta: 'เก็บคูปอง' },
  { big: `${HOTEL_STAY_PROMO.percent}%`, small: 'โรงแรม', bg: '#b69cf0', title: HOTEL_STAY_PROMO.title, desc: HOTEL_STAY_PROMO.desc, cta: 'เก็บคูปอง' },
];

export const REVIEWS = [
  {
    stars: 5,
    text: 'คุณหมออธิบายละเอียดมาก น้องหมาที่บ้านไม่กลัวเลย จองคิวออนไลน์สะดวกสุดๆ',
    name: 'คุณมายด์',
    pet: 'เจ้าของน้องข้าวตัง',
    photo: '/pets/default-dog.jpg',
    bg: '#dcecfc',
  },
  {
    stars: 5,
    text: 'ฝากน้องแมวไว้โรงแรม 5 วัน เปิดดู CCTV ได้ตลอด มีส่งรูปอัปเดตทุกวัน ประทับใจค่ะ',
    name: 'คุณแพรว',
    pet: 'เจ้าของน้องส้มจี๊ด',
    photo: '/pets/default-cat.jpg',
    bg: '#dff5e8',
  },
  {
    stars: 5,
    text: 'รับน้องดำมาจากโครงการหาบ้าน ทีมงานช่วยแนะนำการดูแลดีมาก ตอนนี้น้องเป็นสมาชิกครอบครัวแล้วครับ',
    name: 'คุณบอส',
    pet: 'เจ้าของน้องดำ',
    photo: '/adoption/adopt-004.jpg',
    bg: '#e6e3ff',
  },
];
