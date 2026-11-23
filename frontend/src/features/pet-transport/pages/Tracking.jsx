import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import TripStatusTimeline from '../components/TripStatusTimeline.jsx';
import TransportSubnav from '../components/TransportSubnav.jsx';
import { nextTripStatus, tripStatusMeta } from '../constants.js';
import { useTransport } from '../useTransport.js';
import '../transport.css';

const NAV = [
  { to: '/pet-transport', label: 'Dashboard', icon: 'bi-speedometer2', end: true },
  { to: '/pet-transport/assigned-jobs', label: 'Assigned Jobs', icon: 'bi-list-task' },
  { to: '/pet-transport/history', label: 'History', icon: 'bi-clock-history' },
];

export default function TrackingPage() {
  const { tripId } = useParams();
  const { trips, bookings, advanceTripStatus } = useTransport();
  const trip = trips.find((t) => t.id === tripId);
  const booking = bookings.find((b) => b.id === trip?.bookingId);
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  if (!trip) {
    return (
      <section className="tp-page">
        <TransportSubnav title="Driver · Pet Transport" items={NAV} />
        <p>เลือกงานจาก Assigned Jobs เพื่ออัปเดตสถานะ</p>
        <Link className="tp-btn" to="/pet-transport/assigned-jobs">ไป Assigned Jobs</Link>
      </section>
    );
  }

  const next = nextTripStatus(trip.status);
  const paid = booking?.paymentStatus === 'paid';

  function advance() {
    setErr('');
    try {
      advanceTripStatus(trip.id, note);
      setNote('');
      setMsg(`อัปเดตเป็น: ${tripStatusMeta(next.id).label}`);
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <section className="tp-page">
      <TransportSubnav title="Driver · Pet Transport" items={NAV} />
      <h1>Tracking / Update Status</h1>
      <p className="tp-lead">อัปเดต 7 สถานะของทริป · {booking?.petName}</p>
      {msg && <div className="tp-alert tp-alert--ok">{msg}</div>}
      {err && <div className="tp-alert tp-alert--danger">{err}</div>}
      {!paid && <div className="tp-alert tp-alert--info">รอ Admin Mark as Paid ก่อนเริ่ม</div>}

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
