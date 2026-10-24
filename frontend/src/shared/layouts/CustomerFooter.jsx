import { Link } from 'react-router-dom';

export default function CustomerFooter() {
  return (
    <footer className="pc-footer">
      <div className="container">
        <div className="row g-4 align-items-start">
          <div className="col-lg-4">
            <div className="d-flex align-items-center gap-2 mb-2">
              <span className="brand-logo"><i className="bi bi-balloon-heart-fill" /></span>
              <span className="brand-text">Pet<span>Care</span></span>
            </div>
            <p className="small text-muted">คลินิกที่น้องๆ ไม่กลัว ดูแลด้วยหัวใจ</p>
            <div className="social">
              <a href="#" aria-label="Facebook"><i className="bi bi-facebook" /></a>
              <a href="#" aria-label="Instagram"><i className="bi bi-instagram" /></a>
              <a href="#" aria-label="LINE"><i className="bi bi-line" /></a>
              <a href="#" aria-label="TikTok"><i className="bi bi-tiktok" /></a>
            </div>
          </div>
          <div className="col-6 col-lg-2">
            <div className="mitr mb-2">เมนู</div>
            <div className="small d-grid gap-1">
              <Link to="/">หน้าแรก</Link>
              <Link to="/#services">บริการ</Link>
              <Link to="/#hotel">โรงแรมสัตว์</Link>
              <Link to="/#adopt">หาบ้าน</Link>
              <Link to="/#promo">โปรโมชั่น</Link>
            </div>
          </div>
          <div className="col-6 col-lg-3">
            <div className="mitr mb-2">สำหรับสมาชิก</div>
            <div className="small d-grid gap-1">
              <Link to="/pet-owner/booking">จองนัดหมาย</Link>
              <Link to="/pet-owner">นัดหมายของฉัน</Link>
              <Link to="/pet-owner/my-pets">สัตว์เลี้ยงของฉัน</Link>
              <Link to="/pet-owner/medical">ประวัติ</Link>
              <Link to="/profile">โปรไฟล์</Link>
            </div>
          </div>
          <div className="col-lg-3">
            <div className="mitr mb-2">ฉุกเฉิน 24 ชม.</div>
            <div className="fs-4 mitr text-sky">089-999-9999</div>
          </div>
        </div>
        <div className="small text-center text-muted mt-4">© 2026 PetCare Animal Clinic</div>
      </div>
    </footer>
  );
}
