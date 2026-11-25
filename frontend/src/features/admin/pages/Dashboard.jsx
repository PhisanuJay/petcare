import { Link } from 'react-router-dom';

/**
 * Admin Dashboard — transport-first after role login.
 */
export default function AdminDashboardPage() {
  return (
    <section className="tp-page">
      <header className="tp-page-head">
        <h1>จัดการบริการรับส่ง</h1>
        <p className="tp-lead">เลือกหน้าที่ต้องการจัดการ</p>
      </header>
      <div className="admin-quick-links">
        <Link className="admin-quick-link" to="/admin/transport">
          <i className="bi bi-speedometer2" aria-hidden="true" />
          <span><strong>ภาพรวมงานรับส่ง</strong><small>ดูสถานะงานและรายการที่ต้องติดตาม</small></span>
        </Link>
        <Link className="admin-quick-link" to="/admin/transport/drivers">
          <i className="bi bi-person-badge" aria-hidden="true" />
          <span><strong>จัดการคนขับ</strong><small>ดูและจัดการบัญชีคนขับ</small></span>
        </Link>
        <Link className="admin-quick-link" to="/admin/transport/bookings">
          <i className="bi bi-journal-text" aria-hidden="true" />
          <span><strong>รายการจอง</strong><small>ตรวจสอบราคาและมอบหมายคนขับ</small></span>
        </Link>
      </div>
    </section>
  );
}
