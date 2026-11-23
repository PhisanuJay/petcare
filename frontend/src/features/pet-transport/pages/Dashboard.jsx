import { useState } from 'react';
import { Link } from 'react-router-dom';
import DriverActorBar, { getSelectedDriverId } from '../components/DriverActorBar.jsx';
import TransportSubnav from '../components/TransportSubnav.jsx';
import { useTransport } from '../useTransport.js';
import '../transport.css';

const NAV = [
  { to: '/pet-transport', label: 'Dashboard', icon: 'bi-speedometer2', end: true },
  { to: '/pet-transport/assigned-jobs', label: 'Assigned Jobs', icon: 'bi-list-task' },
  { to: '/pet-transport/history', label: 'History', icon: 'bi-clock-history' },
];

export default function PetTransportDashboardPage() {
  const { drivers, tripsForDriver } = useTransport();
  const [driverId, setDriverId] = useState(() => getSelectedDriverId(drivers));
  const jobs = tripsForDriver(driverId);
  const active = jobs.filter((j) => j.status !== 'completed');
  const done = jobs.filter((j) => j.status === 'completed');

  return (
    <section className="tp-page">
      <TransportSubnav title="Driver · Pet Transport" items={NAV} />
      <DriverActorBar driverId={driverId} onChange={setDriverId} />
      <h1>Dashboard</h1>
      <p className="tp-lead">งานที่ Admin มอบหมายให้คุณ</p>
      <div className="tp-stats">
        <div className="tp-stat"><strong>{active.length}</strong><span>งานที่ต้องทำ</span></div>
        <div className="tp-stat"><strong>{done.length}</strong><span>เสร็จแล้ว</span></div>
      </div>
      <div className="tp-actions">
        <Link className="tp-btn" to="/pet-transport/assigned-jobs">ดู Assigned Jobs</Link>
      </div>
    </section>
  );
}
