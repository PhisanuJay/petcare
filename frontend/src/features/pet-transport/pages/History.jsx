import { Link } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge.jsx';
import TransportSubnav from '../components/TransportSubnav.jsx';
import { TRIP_TYPES, tripStatusMeta } from '../constants.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useTransport } from '../useTransport.js';
import '../transport.css';

const NAV = [
  { to: '/pet-transport', label: 'Dashboard', icon: 'bi-speedometer2', end: true },
  { to: '/pet-transport/assigned-jobs', label: 'Assigned Jobs', icon: 'bi-list-task' },
  { to: '/pet-transport/history', label: 'History', icon: 'bi-clock-history' },
];

export default function HistoryPage() {
  const { currentUser } = useAuth();
  const { tripsForDriver } = useTransport();
  const jobs = tripsForDriver(currentUser?.id).filter((j) => j.status === 'completed');

  return (
    <section className="tp-page">
      <TransportSubnav title="Driver · History" items={NAV} />
      <h1>History</h1>
      <p className="tp-lead">งานที่ส่งสำเร็จแล้ว</p>
      <div className="tp-list">
        {jobs.map((job) => (
          <Link key={job.id} className="tp-list-item" to={`/pet-transport/jobs/${job.id}`}>
            <div>
              <strong>{TRIP_TYPES[job.type]?.label}</strong> · {job.booking?.petName}
              <div className="tp-list-item__meta">
                {job.pickupTime ? new Date(job.pickupTime).toLocaleString('th-TH') : '-'}
              </div>
            </div>
            <StatusBadge label={tripStatusMeta(job.status).label} tone="ok" />
          </Link>
        ))}
        {!jobs.length && <div className="tp-card"><p className="tp-muted" style={{ margin: 0 }}>ยังไม่มีประวัติ</p></div>}
      </div>
    </section>
  );
}
