import { Link } from 'react-router-dom';
import { useCctv } from '../useCctv.js';
import { formatDate } from '../petUtils.js';

/**
 * CCTV — Role: Pet Owner (มะแอ่ว)
 * Lets an owner watch their cat while it stays at the hotel.
 * The backend (/api/pet-owner/cctv) returns only the owner's own stays and says whether each one
 * can be watched now ('live'), later ('upcoming') or is waiting for confirmation ('pending').
 * `streamUrl` is set by the hotel team once a camera is connected to the stay; until then a
 * placeholder is shown. The stream format is not decided yet, so a plain http(s) page is embedded.
 */

const isHttpUrl = (value) => {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

function Viewer({ stay }) {
  if (stay.streamUrl && isHttpUrl(stay.streamUrl)) {
    return (
      <div className="ratio ratio-16x9 rounded-3 overflow-hidden bg-dark">
        <iframe
          title={`กล้องห้อง ${stay.roomLabel} ของ ${stay.petName}`}
          src={stay.streamUrl}
          sandbox="allow-scripts allow-same-origin"
          allow="autoplay"
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }
  return (
    <div className="ratio ratio-16x9 rounded-3 bg-dark text-white-50">
      <div className="d-flex flex-column align-items-center justify-content-center text-center p-3">
        <i className="bi bi-camera-video-off fs-1" />
        <div className="mt-2">ยังไม่มีสัญญาณกล้องของห้องนี้</div>
        <div className="small">ทีมโรงแรมกำลังเชื่อมต่อกล้อง กรุณากลับมาดูใหม่อีกครั้ง</div>
      </div>
    </div>
  );
}

function StayCard({ stay }) {
  return (
    <div className="col-lg-6">
      <div className="card-soft h-100">
        <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
          <span className="mitr fs-5">{stay.petName}</span>
          <span className="tag">
            <i className="bi bi-building me-1" />
            {stay.roomLabel}
          </span>
          {stay.access === 'live' && <span className="tag ok">ดูได้ตอนนี้</span>}
          {stay.access === 'upcoming' && <span className="tag sky">เริ่มดูได้วันเช็คอิน</span>}
          {stay.access === 'pending' && <span className="tag warn">รอโรงแรมยืนยัน</span>}
        </div>
        <div className="small text-muted mb-3">
          {formatDate(stay.checkIn)} - {formatDate(stay.checkOut)}
        </div>

        {stay.access === 'live' ? (
          <Viewer stay={stay} />
        ) : (
          <div className="empty-box py-3">
            <i className="bi bi-lock" />
            {stay.access === 'upcoming'
              ? `ดูกล้องได้ตั้งแต่วันที่ ${formatDate(stay.checkIn)}`
              : 'จะดูกล้องได้เมื่อโรงแรมยืนยันการจอง'}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CctvPage() {
  const { stays, loading, error, reload } = useCctv();

  return (
    <div className="page-wrap">
      <div className="container">
        <div className="page-head">
          <div>
            <h1>ดูน้องผ่าน CCTV</h1>
            <p>ดูน้องแมวที่ฝากไว้กับเราได้ตลอดช่วงที่พัก</p>
          </div>
        </div>

        {error && (
          <div className="alert alert-danger d-flex align-items-center justify-content-between" role="alert">
            <span>{error}</span>
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={reload}>ลองใหม่</button>
          </div>
        )}

        {loading ? (
          <div className="card-soft empty-box">กำลังโหลดข้อมูล...</div>
        ) : stays.length === 0 ? (
          <div className="card-soft empty-box">
            <i className="bi bi-camera-video" />
            ยังไม่มีน้องที่ฝากอยู่ในตอนนี้ เมื่อมีการจองโรงแรมที่ยืนยันแล้ว จะดูกล้องได้ที่นี่
            <div className="mt-3">
              <Link to="/pet-owner/cat-hotel" className="btn btn-sky">จองโรงแรมแมว</Link>
            </div>
          </div>
        ) : (
          <div className="row g-4">
            {stays.map((s) => (
              <StayCard key={s.id} stay={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
