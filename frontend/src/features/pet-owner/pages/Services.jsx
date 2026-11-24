import { Link } from 'react-router-dom';
import { CLINIC_PHONE, hoursSummary, useClinicInfo } from '../bookingOptions.js';

/**
 * Services — Role: Pet Owner (มะแอ่ว)
 * Entry page that lists everything PetCare offers and links to the matching page.
 */

const MEDICAL = [
  {
    icon: 'bi-clipboard2-pulse',
    title: 'ตรวจสุขภาพ',
    desc: 'ตรวจร่างกายทั่วไป และติดตามอาการกับสัตวแพทย์',
    to: '/pet-owner/booking?service=checkup',
    action: 'จองนัดตรวจ',
    bg: '#dcecfc',
    fg: '#2f7fc8',
  },
  {
    icon: 'bi-capsule',
    title: 'ฉีดวัคซีน',
    desc: 'วัคซีนตามช่วงวัย พร้อมแจ้งเตือนนัดครั้งถัดไป',
    to: '/pet-owner/booking?service=vaccine',
    action: 'จองนัดฉีดวัคซีน',
    bg: '#dff5e8',
    fg: '#2a9d64',
  },
  {
    icon: 'bi-bug',
    title: 'ถ่ายพยาธิ / เห็บหมัด',
    desc: 'ยากำจัดพยาธิและป้องกันเห็บหมัดตามรอบ',
    to: '/pet-owner/booking?service=parasite',
    action: 'จองนัด',
    bg: '#fff1c9',
    fg: '#c48f00',
  },
  {
    icon: 'bi-journal-medical',
    title: 'ประวัติสุขภาพ',
    desc: 'ดูวัคซีน ยาถ่ายพยาธิ และประวัติการรักษาของน้องๆ',
    to: '/pet-owner/medical',
    action: 'ดูประวัติ',
    bg: '#e6e3ff',
    fg: '#5b52d6',
  },
];

const MORE = [
  {
    icon: 'bi-building',
    title: 'โรงแรมแมว',
    desc: 'ฝากน้องแมวพร้อมการดูแลตลอด 24 ชั่วโมง',
    to: '/pet-owner/cat-hotel',
    action: 'ดูโรงแรมแมว',
    bg: '#dff3fb',
    fg: '#1f97c7',
  },
  {
    icon: 'bi-camera-video',
    title: 'CCTV',
    desc: 'ดูน้องที่ฝากไว้ผ่านกล้องวงจรปิดได้ตลอด',
    to: '/pet-owner/cctv',
    action: 'เปิดดู CCTV',
    bg: '#f6e0ff',
    fg: '#a454d6',
  },
  {
    icon: 'bi-truck',
    title: 'รับ-ส่งสัตว์เลี้ยง',
    desc: 'บริการรับ-ส่งน้องถึงบ้านอย่างปลอดภัย',
    to: '/pet-owner/transport',
    action: 'เรียกรับ-ส่ง',
    bg: '#dcecfc',
    fg: '#2f7fc8',
  },
  {
    icon: 'bi-house-heart',
    title: 'หาบ้านให้น้อง',
    desc: 'ดูน้องที่รอครอบครัว และยื่นขอรับเลี้ยง',
    to: '/pet-owner/adoption',
    action: 'ดูน้องที่รอบ้าน',
    bg: '#ffe3e8',
    fg: '#d6456a',
  },
];

function ServiceCard({ s }) {
  return (
    <div className="col-sm-6 col-lg-3">
      <Link to={s.to} className="pet-card text-center align-items-center h-100">
        <span
          className="d-inline-flex align-items-center justify-content-center rounded-circle mb-2"
          style={{ width: 64, height: 64, background: s.bg, color: s.fg, fontSize: '1.8rem' }}
        >
          <i className={`bi ${s.icon}`} />
        </span>
        <div className="mitr fs-5">{s.title}</div>
        <div className="small text-muted mb-3">{s.desc}</div>
        <span className="btn btn-soft btn-sm mt-auto">{s.action}</span>
      </Link>
    </div>
  );
}

export default function ServicesPage() {
  // Opening hours set by the clinic admin (falls back to the default hours if they cannot be loaded).
  const { info } = useClinicInfo();
  return (
    <div className="page-wrap">
      <div className="container">
        <div className="page-head">
          <div>
            <h1>บริการของเรา</h1>
            <p>ทุกอย่างที่น้องๆ ต้องการ ในที่เดียว</p>
          </div>
        </div>

        <div className="section-label">
          <i className="bi bi-heart-pulse" />
          บริการทางการแพทย์
        </div>
        <div className="row g-4 mb-4">
          {MEDICAL.map((s) => (
            <ServiceCard key={s.title} s={s} />
          ))}
        </div>

        <div className="section-label">
          <i className="bi bi-stars" />
          บริการอื่นๆ
        </div>
        <div className="row g-4 mb-4">
          {MORE.map((s) => (
            <ServiceCard key={s.title} s={s} />
          ))}
        </div>

        <div className="card-soft small">
          <div className="mb-1">
            <i className="bi bi-clock me-1" />
            {hoursSummary(info).join(' · ')}
          </div>
          <div>
            <i className="bi bi-telephone me-1" />
            กรณีฉุกเฉิน เปิด 24 ชั่วโมง โทร {CLINIC_PHONE}
          </div>
        </div>
      </div>
    </div>
  );
}
