import { Link } from 'react-router-dom';

/**
 * Pet Hotel staff shell (placeholder) — operations use owner stays + Super Admin CCTV.
 */
export default function PetHotelDashboardPage() {
  return (
    <section className="page-wrap">
      <div className="container">
        <h1>โรงแรมสัตว์ (ฝั่งพนักงาน)</h1>
        <p className="text-muted">
          การจองและเข้าพักจริงอยู่ที่ระบบ <strong>ฝากโรงแรม</strong> ของเจ้าของสัตว์ และกล้อง CCTV อยู่ที่ Super Admin
        </p>
        <div className="d-flex flex-wrap gap-2 mt-3">
          <Link className="btn btn-sky" to="/">ไปหน้าแรก</Link>
          <Link className="btn btn-soft" to="/super-admin">Super Admin / CCTV</Link>
        </div>
      </div>
    </section>
  );
}