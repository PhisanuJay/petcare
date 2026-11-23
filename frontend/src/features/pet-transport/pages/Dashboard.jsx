import { Link } from 'react-router-dom';
import TransportSubnav from '../components/TransportSubnav.jsx';
import { tripStatusMeta } from '../constants.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useTransport } from '../useTransport.js';
import '../transport.css';

const NAV = [
  { to: '/pet-transport', label: 'Dashboard', icon: 'bi-speedometer2', end: true },
  { to: '/pet-transport/assigned-jobs', label: 'Assigned Jobs', icon: 'bi-list-task' },
  { to: '/pet-transport/history', label: 'History', icon: 'bi-clock-history' },
];

export default function PetTransportDashboardPage() {
  const { currentUser } = useAuth();
  const { tripsForDriver } = useTransport();
  const jobs = tripsForDriver(currentUser?.id);
  const pickupSoon = jobs.filter((j) => {
    const step = tripStatusMeta(j.status).step;
    return step >= 1 && step < 4;
  });
  const inProgress = jobs.filter((j) => {
    const step = tripStatusMeta(j.status).step;
    return step >= 4 && step < 7;
  });
  const done = jobs.filter((j) => j.status === 'completed');

  return (
    <section className="tp-page">
      <TransportSubnav title="Driver Dashboard" items={NAV} />
      <h1>สวัสดี คุณ{currentUser?.firstName}</h1>
      <p className="tp-lead">งานที่ได้รับมอบหมาย · งานที่ต้องไปรับ · งานที่กำลังดำเนินการ</p>
      <div className="tp-stats">
        <div className="tp-stat"><strong>{pickupSoon.length}</strong><span>ต้องไปรับ / รอรับ</span></div>
        <div className="tp-stat"><strong>{inProgress.length}</strong><span>กำลังดำเนินการ</span></div>
        <div className="tp-stat"><strong>{done.length}</strong><span>เสร็จแล้ว</span></div>
      </div>
      <div className="tp-actions">
        <Link className="btn btn-sky" to="/pet-transport/assigned-jobs">ดู Assigned Jobs</Link>
      </div>
    </section>
  );
}
