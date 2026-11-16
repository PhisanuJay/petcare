import VetLayout from '../components/VetLayout.jsx';

/**
 * Placeholder — Reports
 * Role: Veterinarian
 * Owner: มะแอ่ว
 * Source: Page 17 sitemap (Thanik Sapnonwai)
 *
 * TODO: implement UI and business logic later.
 */
export default function ReportsPage() {
  return (
    <VetLayout>
      <div className="page-wrap">
        <div className="container">
          <div className="page-head">
            <div>
              <h1>รายงาน</h1>
              <p>สรุปรายงานของคลินิก</p>
            </div>
          </div>
          <div className="card-soft empty-box">
            <i className="bi bi-bar-chart-line" />
            หน้านี้ยังอยู่ระหว่างการพัฒนา
          </div>
        </div>
      </div>
    </VetLayout>
  );
}
