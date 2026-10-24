import vet1 from '../../assets/vet-1.jpg';
import vet2 from '../../assets/vet-2.jpg';
import vet3 from '../../assets/vet-3.jpg';
import vet4 from '../../assets/vet-4.jpg';

/** Mock content for the home page until the backend provides real data. */

export const STATS = [
  { num: '12+', label: 'ปีที่เปิดให้บริการ' },
  { num: '15', label: 'สัตวแพทย์' },
  { num: '30K+', label: 'เคสที่ดูแล' },
  { num: '24/7', label: 'ฉุกเฉิน' },
];

export const SERVICES = [
  { icon: 'bi-clipboard2-pulse', title: 'ตรวจสุขภาพ', desc: 'ตรวจร่างกาย ตรวจเลือด', bg: '#dcecfc', fg: '#2f7fc8' },
  { icon: 'bi-capsule', title: 'ฉีดวัคซีน', desc: 'แจ้งเตือนนัดอัตโนมัติ', bg: '#dff5e8', fg: '#2a9d64' },
  { icon: 'bi-bandaid', title: 'ผ่าตัด / ทำหมัน', desc: 'ห้องผ่าตัดมาตรฐาน', bg: '#e6e3ff', fg: '#5b52d6' },
  { icon: 'bi-emoji-smile', title: 'ทันตกรรม', desc: 'ขูดหินปูน ดูแลช่องปาก', bg: '#fff1c9', fg: '#c48f00' },
  { icon: 'bi-scissors', title: 'อาบน้ำ ตัดขน', desc: 'สปาโดยมืออาชีพ', bg: '#f6e0ff', fg: '#a454d6' },
  { icon: 'bi-building', title: 'โรงแรมสัตว์', desc: 'ดูแลตลอด 24 ชม.', bg: '#dff3fb', fg: '#1f97c7' },
];

export const HOTEL_ROOMS = [
  {
    name: 'Standard',
    price: 450,
    icon: 'bi-house-door',
    bg: '#e7f1ff',
    fg: '#2f7fc8',
    features: ['ห้องส่วนตัวสำหรับน้องเล็ก', 'อาหาร 2 มื้อ ตามที่เจ้าของกำหนด', 'ทำความสะอาดวันละ 2 ครั้ง', 'ส่งรูปอัปเดตทุกวัน'],
  },
  {
    name: 'Deluxe',
    price: 750,
    icon: 'bi-building',
    bg: '#dff3fb',
    fg: '#1f97c7',
    featured: true,
    features: ['ห้องกว้าง มีคอนโดแมว / ของเล่น', 'แอร์ 24 ชั่วโมง', 'ดูน้องผ่าน CCTV ในแอป', 'พาเล่น / เดินเล่นวันละ 2 รอบ'],
  },
  {
    name: 'Suite',
    price: 1200,
    icon: 'bi-stars',
    bg: '#e6e3ff',
    fg: '#5b52d6',
    features: ['ห้องสวีทพร้อมโซฟาและที่นอนนุ่ม', 'พี่เลี้ยงดูแลใกล้ชิด', 'CCTV + วิดีโอคอลหาน้องได้', 'อาบน้ำก่อนกลับบ้านฟรี'],
  },
];

export const HOTEL_PERKS = [
  { icon: 'bi-heart-pulse', title: 'สัตวแพทย์ประจำ 24 ชม.', desc: 'ดูแลทันทีหากไม่สบาย' },
  { icon: 'bi-camera-video', title: 'CCTV ดูน้องได้ตลอด', desc: 'เปิดดูผ่านมือถือ' },
  { icon: 'bi-shield-check', title: 'แยกโซนหมา-แมว', desc: 'ลดความเครียด ปลอดภัย' },
  { icon: 'bi-truck', title: 'บริการรับ-ส่งถึงบ้าน', desc: 'สะดวก ไม่ต้องเดินทาง' },
];

export const ADOPT_ANIMALS = [
  {
    name: 'น้องถั่วเหลือง',
    emoji: '🐕',
    bg: '#fff1c9',
    breed: 'สุนัขพันธุ์ผสม',
    sex: 'female',
    age: '1 ปี',
    personality: 'ขี้อ้อน ชอบเล่นกับเด็ก',
    tags: ['ฉีดวัคซีนแล้ว', 'ทำหมันแล้ว'],
  },
  {
    name: 'น้องมะลิ',
    emoji: '🐈',
    bg: '#e7f1ff',
    breed: 'แมวขาวมณี',
    sex: 'female',
    age: '8 เดือน',
    personality: 'เรียบร้อย ชอบนอนตัก',
    tags: ['ฉีดวัคซีนแล้ว'],
  },
  {
    name: 'น้องดำ',
    emoji: '🐶',
    bg: '#dff5e8',
    breed: 'สุนัขพันธุ์ไทย',
    sex: 'male',
    age: '2 ปี',
    personality: 'ฉลาด เฝ้าบ้านเก่ง',
    tags: ['ฉีดวัคซีนแล้ว', 'ทำหมันแล้ว'],
  },
  {
    name: 'น้องส้มโอ',
    emoji: '🐱',
    bg: '#ffe6d9',
    breed: 'แมวส้ม',
    sex: 'male',
    age: '3 เดือน',
    personality: 'ซน ขี้เล่น เข้ากับแมวอื่นได้',
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

export const PROMOS = [
  { big: '20%', small: 'OFF', bg: 'var(--sky)', title: 'แพ็กเกจวัคซีนลูกสัตว์', desc: 'ครบชุด 3 เข็ม ถึง 30 พ.ย.', cta: 'เก็บคูปอง' },
  { big: '990', small: 'บาท', bg: '#7bc8a4', title: 'ตรวจสุขภาพประจำปี', desc: 'เลือด + ร่างกาย + ปรึกษาหมอ', cta: 'เก็บคูปอง' },
  { big: '15%', small: 'โรงแรม', bg: '#b69cf0', title: 'พักโรงแรม 3 คืนขึ้นไป', desc: 'ทุกประเภทห้อง ถึง 31 ธ.ค.', cta: 'เก็บคูปอง' },
];

export const REVIEWS = [
  {
    stars: 5,
    text: 'คุณหมออธิบายละเอียดมาก น้องหมาที่บ้านไม่กลัวเลย จองคิวออนไลน์สะดวกสุดๆ',
    name: 'คุณมายด์',
    pet: 'เจ้าของน้องข้าวตัง',
    emoji: '🐶',
    bg: '#dcecfc',
  },
  {
    stars: 5,
    text: 'ฝากน้องแมวไว้โรงแรม 5 วัน เปิดดู CCTV ได้ตลอด มีส่งรูปอัปเดตทุกวัน ประทับใจค่ะ',
    name: 'คุณแพรว',
    pet: 'เจ้าของน้องส้มจี๊ด',
    emoji: '🐱',
    bg: '#dff5e8',
  },
  {
    stars: 5,
    text: 'รับน้องดำมาจากโครงการหาบ้าน ทีมงานช่วยแนะนำการดูแลดีมาก ตอนนี้น้องเป็นสมาชิกครอบครัวแล้วครับ',
    name: 'คุณบอส',
    pet: 'เจ้าของน้องดำ',
    emoji: '🐕',
    bg: '#e6e3ff',
  },
];
