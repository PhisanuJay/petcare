import VetLayout from '../components/VetLayout.jsx';

/**
 * Placeholder — Medical Records
 * Role: Veterinarian
 * Owner: มะแอ่ว
 * Source: Page 17 sitemap (Thanik Sapnonwai)
 *
 * TODO: implement UI and business logic later.
 */
export default function MedicalRecordsPage() {
  return (
    <VetLayout>
      <div className="page-wrap">
        <div className="container">
          <div className="page-head">
            <div>
              <h1>ประวัติการรักษา</h1>
              <p>บันทึกการตรวจและการรักษา</p>
            </div>
          </div>
          <div className="card-soft empty-box">
            <i className="bi bi-journal-medical" />
            หน้านี้ยังอยู่ระหว่างการพัฒนา
          </div>
        </div>
      </div>
    </VetLayout>
  );
}
