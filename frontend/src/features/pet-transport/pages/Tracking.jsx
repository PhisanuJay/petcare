import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import TripStatusTimeline from '../components/TripStatusTimeline.jsx';
import TransportSubnav from '../components/TransportSubnav.jsx';
import { nextTripStatus, tripStatusMeta } from '../constants.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useTransport } from '../useTransport.js';
import '../transport.css';

const NAV = [
  { to: '/pet-transport', label: 'Dashboard', icon: 'bi-speedometer2', end: true },
  { to: '/pet-transport/assigned-jobs', label: 'Assigned Jobs', icon: 'bi-list-task' },
  { to: '/pet-transport/history', label: 'History', icon: 'bi-clock-history' },
];

export default function TrackingPage() {
  const { tripId } = useParams();
  const { currentUser } = useAuth();
  const { trips, bookings, advanceTripStatus } = useTransport();
  const trip = trips.find((t) => t.id === tripId);
  const booking = bookings.find((b) => b.id === trip?.bookingId);
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  if (!tripId) {
    return (
      <section className="tp-page">
        <TransportSubnav title="Driver · Tracking" items={NAV} />
        <p>เลือกงานจาก Assigned Jobs เพื่ออัปเดตสถานะ</p>
        <Link className="tp-btn" to="/pet-transport/assigned-jobs">ไป Assigned Jobs</Link>
      </section>
    );
  }

  if (!trip) {
    return (
      <section className="tp-page">
        <p>ไม่พบทริป</p>
        <Link to="/pet-transport/assigned-jobs">กลับ</Link>
      </section>
    );
  }

  if (trip.driverId !== currentUser?.id) {
    return <Navigate to="/pet-transport/assigned-jobs" replace />;
  }

  const next = nextTripStatus(trip.status);
  const paid = booking?.paymentStatus === 'paid';

  async function advance() {
    setErr('');
    try {
      const n = nextTripStatus(trip.status);
      await advanceTripStatus(trip.id, note);
      setNote('');
      setMsg(n ? `อัปเดตเป็น: ${tripStatusMeta(n.id).label}` : 'อัปเดตแล้ว');
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <section className="tp-page">
      <TransportSubnav title="Driver · Tracking" items={NAV} />
      <h1>Tracking / Update Status</h1>
      <p className="tp-lead">อัปเดต 7 สถานะของทริป · {booking?.petName}</p>
      {msg && <div className="tp-alert tp-alert--ok">{msg}</div>}
      {err && <div className="tp-alert tp-alert--danger">{err}</div>}
      {!paid && <div className="tp-alert tp-alert--info">รอฝ่ายการเงินยืนยันชำระก่อนเริ่ม</div>}

      <div className="tp-card">
        <TripStatusTimeline status={trip.status} />
        <div className="tp-form" style={{ marginTop: '1rem' }}>
          <div className="field">
            <label htmlFor="note">บันทึกเพิ่มเติม (ถ้ามี)</label>
            <input id="note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <div className="tp-actions">
          <button type="button" className="tp-btn" disabled={!next || !paid} onClick={advance}>
            {next ? `อัปเดต → ${next.label}` : 'ครบ 7 สถานะแล้ว'}
          </button>
          <Link className="tp-btn tp-btn--ghost" to={`/pet-transport/jobs/${trip.id}`}>กลับ Job Detail</Link>
        </div>
      </div>
    </section>
  );
}
