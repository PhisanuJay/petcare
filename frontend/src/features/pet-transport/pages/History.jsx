import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { placeParts } from '../store.js';
import { useTransport } from '../useTransport.js';
import '../transport.css';

const JOB_KIND = {
  pickup: 'รับขึ้นโรงแรม',
  dropoff: 'ส่งกลับบ้าน',
};

export default function HistoryPage() {
  const { currentUser } = useAuth();
  const transport = useTransport();
  const jobs = transport.tripsForDriver(currentUser?.id)
    .filter((job) => job.status === 'completed')
    .sort((left, right) => String(right.pickupTime).localeCompare(String(left.pickupTime)));

  return (
    <section className="tp-page driver-page">
      <div className="driver-jobs">
        {jobs.map((job) => {
          const from = placeParts(job.from, transport);
          const to = placeParts(job.to, transport);
          return (
            <Link key={job.id} className="driver-job" to={`/pet-transport/jobs/${job.id}`}>
              <header>
                <div>
                  <time>{job.pickupTime ? new Date(job.pickupTime).toLocaleString('th-TH') : '—'}</time>
                  <strong>{job.booking?.petName || 'สัตว์เลี้ยง'}</strong>
                  <em>{JOB_KIND[job.type] || 'งานส่งสัตว์'}</em>
                </div>
                <span className="driver-status">ส่งสำเร็จ</span>
              </header>
              <div className="driver-stops">
                <div className="driver-stop">
                  <span>รับจาก</span>
                  <strong>{from.name}</strong>
                  <p>{from.address}</p>
                </div>
                <div className="driver-stop">
                  <span>ส่งที่</span>
                  <strong>{to.name}</strong>
                  <p>{to.address}</p>
                </div>
              </div>
            </Link>
          );
        })}
        {!jobs.length ? <div className="driver-empty">ยังไม่มีงานที่ส่งแล้ว</div> : null}
      </div>
    </section>
  );
}
