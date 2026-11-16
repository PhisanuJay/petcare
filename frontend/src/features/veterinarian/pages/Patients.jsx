import VetLayout from '../components/VetLayout.jsx';

/**
 * Placeholder — Patients
 * Role: Veterinarian
 * Owner: มะแอ่ว
 * Source: Page 17 sitemap (Thanik Sapnonwai)
 *
 * TODO: implement UI and business logic later.
 */
export default function PatientsPage() {
  return (
    <VetLayout>
      <div className="page-wrap">
        <div className="container">
          <div className="page-head">
            <div>
              <h1>คนไข้</h1>
              <p>รายชื่อสัตว์เลี้ยงที่มารับบริการ</p>
            </div>
          </div>
          <div className="card-soft empty-box">
            <i className="bi bi-heart" />
            หน้านี้ยังอยู่ระหว่างการพัฒนา
          </div>
        </div>
      </div>
    </VetLayout>
  );
}
