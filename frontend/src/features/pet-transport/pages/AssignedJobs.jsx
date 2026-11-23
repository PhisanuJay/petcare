import { Link } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge.jsx';
import TransportSubnav from '../components/TransportSubnav.jsx';
import { TRIP_TYPES, tripStatusMeta } from '../constants.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useTransport } from '../useTransport.js';
import { placeLabel } from '../store.js';
import '../transport.css';

const NAV = [
  { to: '/pet-transport', label: 'Dashboard', icon: 'bi-speedometer2', end: true },
  { to: '/pet-transport/assigned-jobs', label: 'Assigned Jobs', icon: 'bi-list-task' },
  { to: '/pet-transport/history', label: 'History', icon: 'bi-clock-history' },
];

export default function AssignedJobsPage() {
  const { currentUser } = useAuth();
  const transport = useTransport();
  const jobs = transport.tripsForDriver(currentUser?.id).filter((j) => j.status !== 'completed');

  return (
    <section className="tp-page">
      <TransportSubnav title="Driver · Assigned Jobs" items={NAV} />
      <h1>Assigned Jobs</h1>
      <p className="tp-lead">ทริปที่ Admin มอบหมายให้คุณและยังไม่เสร็จ</p>
      <div className="tp-list">
        {jobs.map((job) => {
          const meta = tripStatusMeta(job.status);
          return (
            <Link key={job.id} className="tp-list-item" to={`/pet-transport/jobs/${job.id}`}>
              <div>
                <strong>{TRIP_TYPES[job.type]?.label}</strong> · {job.booking?.petName}
                <div className="tp-list-item__meta">
                  {placeLabel(job.from, transport)} → {placeLabel(job.to, transport)}
                </div>
                <div className="tp-list-item__meta">
                  รับ {job.pickupTime ? new Date(job.pickupTime).toLocaleString('th-TH') : '-'}
                </div>
              </div>
              <StatusBadge label={meta.label} tone={meta.step >= 7 ? 'ok' : 'info'} />
            </Link>
          );
        })}
        {!jobs.length && <div className="tp-card"><p className="tp-muted" style={{ margin: 0 }}>ยังไม่มีงาน</p></div>}
      </div>
    </section>
  );
}
