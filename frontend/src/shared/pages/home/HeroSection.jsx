import { Link } from 'react-router-dom';
import heroImg from '../../../assets/hero-blue.jpg';
import { memberTier, useAuth } from '../../../features/auth/AuthContext.jsx';
import { usePets } from '../../../features/pet-owner/usePets.js';
import { careReminders, reminderText } from '../../../features/pet-owner/petUtils.js';

function NextCareStrip({ pets }) {
  if (!pets.length) {
    return (
      <div className="appt-strip mt-4 d-flex align-items-center gap-3" style={{ maxWidth: 470 }}>
        <i className="bi bi-heart-pulse fs-2 text-sky px-2" />
        <div className="flex-grow-1">
          <div className="fw-medium">ยังไม่มีข้อมูลสัตว์เลี้ยง</div>
          <div className="small text-muted">เพิ่มประวัติน้อง เพื่อรับการแจ้งเตือนวัคซีน</div>
        </div>
        <Link to="/pet-owner/my-pets/new" className="btn btn-soft btn-sm text-nowrap">เพิ่มสัตว์เลี้ยง</Link>
      </div>
    );
  }

  const next = careReminders(pets)[0];
  if (!next) {
    return (
      <div className="appt-strip mt-4 d-flex align-items-center gap-3" style={{ maxWidth: 470 }}>
        <i className="bi bi-calendar2-check fs-2 text-sky px-2" />
        <div className="flex-grow-1">
          <div className="fw-medium">ยังไม่มีนัดที่กำลังจะถึง</div>
          <div className="small text-muted">บันทึกวัคซีนและวันนัดครั้งถัดไปได้ในหน้าสัตว์เลี้ยง</div>
        </div>
        <Link to="/pet-owner/my-pets" className="btn btn-soft btn-sm text-nowrap">สัตว์เลี้ยง</Link>
      </div>
    );
  }

  const date = new Date(next.date);
  return (
    <div className="appt-strip mt-4 d-flex align-items-center gap-3" style={{ maxWidth: 470 }}>
      <div className="text-center px-2">
        <div className="small text-muted">{date.toLocaleDateString('th-TH', { month: 'short' })}</div>
        <div className={`mitr fs-3 lh-1 ${next.status === 'overdue' ? 'text-danger' : 'text-sky'}`}>
          {date.getDate()}
        </div>
      </div>
      <div className="flex-grow-1">
        <div className="fw-medium">
          {next.title} · {next.pet.name}
        </div>
        <div className={`small ${next.status === 'overdue' ? 'text-danger' : 'text-muted'}`}>{reminderText(next)}</div>
      </div>
      <Link to={`/pet-owner/my-pets/${next.pet.id}`} className="btn btn-soft btn-sm text-nowrap">ดูรายละเอียด</Link>
    </div>
  );
}

export default function HeroSection({ go }) {
  const { currentUser } = useAuth();
  const { pets } = usePets();
  const petNames = pets.slice(0, 3).map((p) => `น้อง${p.name}`).join(' ');

  return (
    <header className="hero">
      <i className="bi bi-suit-heart-fill paw-bg" style={{ top: 40, left: -30 }} />
      <i className="bi bi-suit-heart-fill paw-bg" style={{ bottom: -40, right: '38%', fontSize: '6rem' }} />
      <div className="container">
        <div className="row align-items-center g-5">
          <div className="col-lg-6">
            {currentUser ? (
              <>
                <span className="badge rounded-pill text-bg-light mb-3 px-3 py-2 fw-normal">
                  <i className="bi bi-stars text-warning me-1" /> สมาชิก {memberTier(currentUser.points)} ·{' '}
                  {currentUser.points ?? 0} แต้ม
                </span>
                <h1>
                  ยินดีต้อนรับกลับ
                  <br />
                  <span className="hl">คุณ{currentUser.firstName}</span>
                </h1>
                <p className="lead my-4">
                  {pets.length
                    ? `${petNames}คิดถึงคุณหมอแล้ว จองคิวครั้งต่อไปได้เลย`
                    : 'เพิ่มข้อมูลสัตว์เลี้ยงของคุณ เพื่อให้คุณหมอดูแลน้องได้ตรงจุดยิ่งขึ้น'}
                </p>
              </>
            ) : (
              <>
                <span className="badge rounded-pill text-bg-light mb-3 px-3 py-2 fw-normal">
                  <i className="bi bi-emoji-heart-eyes text-danger me-1" /> คลินิกที่น้องๆ ไม่กลัว
                </span>
                <h1>
                  สุขภาพดีทุกวัน
                  <br />
                  เริ่มที่ <span className="hl">PetCare</span>
                </h1>
                <p className="lead my-4">
                  ดูแลน้องหมา น้องแมว และสัตว์เลี้ยงตัวจิ๋ว ด้วยทีมคุณหมอใจดี มีโรงแรมสัตว์และโครงการหาบ้านให้น้อง
                  จองคิวออนไลน์ได้ตลอด 24 ชั่วโมง
                </p>
              </>
            )}
            <div className="d-flex flex-wrap gap-2">
              <a href="/pet-owner/booking" className="btn btn-sky btn-lg" onClick={go('/pet-owner/booking')}>
                <i className="bi bi-calendar-heart me-1" /> จองนัดหมาย
              </a>
              <Link to="/#services" className="btn btn-soft btn-lg bg-white">ดูบริการ</Link>
            </div>
            {currentUser && <NextCareStrip pets={pets} />}
          </div>
          <div className="col-lg-6">
            <div className="blob">
              <img src={heroImg} alt="น้องหมาและน้องแมว" />
              <div className="float-badge" style={{ top: '8%', left: '-4%' }}>
                <span className="ic" style={{ background: '#e3efff', color: 'var(--sky-dark)' }}>
                  <i className="bi bi-star-fill" />
                </span>
                <div>
                  <div className="fw-semibold">4.9 / 5</div>
                  <div className="small text-muted">รีวิวจากเจ้าของ</div>
                </div>
              </div>
              <div className="float-badge" style={{ bottom: '8%', right: '-2%' }}>
                <span className="ic" style={{ background: '#dff5e8', color: '#2a9d64' }}>
                  <i className="bi bi-clock-fill" />
                </span>
                <div>
                  <div className="fw-semibold">ฉุกเฉิน 24 ชม.</div>
                  <div className="small text-muted">089-999-9999</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
