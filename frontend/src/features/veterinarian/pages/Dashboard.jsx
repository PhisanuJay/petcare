import VetLayout from '../components/VetLayout.jsx';

/**
 * Placeholder — Veterinarian Dashboard
 * Role: Veterinarian
 * Owner: มะแอ่ว
 * Source: Page 17 sitemap (Thanik Sapnonwai)
 *
 * TODO: implement UI and business logic later.
 */
export default function VeterinarianDashboardPage() {
  return (
    <VetLayout>
      <div className="page-wrap">
        <div className="container">
          <div className="page-head">
            <div>
              <h1>ภาพรวม</h1>
              <p>สรุปนัดหมายและงานของวันนี้</p>
            </div>
          </div>
          <div className="card-soft empty-box">
            <i className="bi bi-speedometer2" />
            หน้านี้ยังอยู่ระหว่างการพัฒนา
          </div>
        </div>
      </div>
    </VetLayout>
  );
}
