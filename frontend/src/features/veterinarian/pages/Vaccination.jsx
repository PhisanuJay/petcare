import VetLayout from '../components/VetLayout.jsx';

/**
 * Placeholder — Vaccination
 * Role: Veterinarian
 * Owner: มะแอ่ว
 * Source: Page 17 sitemap (Thanik Sapnonwai)
 *
 * TODO: implement UI and business logic later.
 */
export default function VaccinationPage() {
  return (
    <VetLayout>
      <div className="page-wrap">
        <div className="container">
          <div className="page-head">
            <div>
              <h1>วัคซีน</h1>
              <p>บันทึกการฉีดวัคซีนและนัดครั้งถัดไป</p>
            </div>
          </div>
          <div className="card-soft empty-box">
            <i className="bi bi-capsule" />
            หน้านี้ยังอยู่ระหว่างการพัฒนา
          </div>
        </div>
      </div>
    </VetLayout>
  );
}
