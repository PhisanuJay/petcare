import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { fileToResizedDataUrl } from '../../../shared/utils/storage.js';
import TransportSubnav from '../components/TransportSubnav.jsx';
import TripStatusTimeline from '../components/TripStatusTimeline.jsx';
import { ISSUE_REASONS, TRIP_TYPES, nextTripStatus } from '../constants.js';
import { placeLabel } from '../store.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useTransport } from '../useTransport.js';
import '../transport.css';

const NAV = [
  { to: '/pet-transport', label: 'Dashboard', icon: 'bi-speedometer2', end: true },
  { to: '/pet-transport/assigned-jobs', label: 'Assigned Jobs', icon: 'bi-list-task' },
  { to: '/pet-transport/history', label: 'History', icon: 'bi-clock-history' },
];

export default function JobDetailPage() {
  const { tripId } = useParams();
  const { currentUser } = useAuth();
  const transport = useTransport();
  const {
    trips,
    bookings,
    advanceTripStatus,
    attachEvidence,
    reportIssue,
  } = transport;
  const trip = trips.find((t) => t.id === tripId);
  const booking = bookings.find((b) => b.id === trip?.bookingId);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [issueReason, setIssueReason] = useState(ISSUE_REASONS[0].id);
  const [issueMsg, setIssueMsg] = useState('');

  if (!tripId) {
    return (
      <section className="tp-page">
        <TransportSubnav title="Driver" items={NAV} />
        <p>เลือกงานจาก Assigned Jobs</p>
        <Link className="btn btn-sky" to="/pet-transport/assigned-jobs">ไป Assigned Jobs</Link>
      </section>
    );
  }

  if (!trip) {
    return (
      <section className="tp-page">
        <p>ไม่พบงาน</p>
        <Link to="/pet-transport/assigned-jobs">กลับ</Link>
      </section>
    );
  }

  if (trip.driverId !== currentUser?.id) {
    return <Navigate to="/pet-transport/assigned-jobs" replace />;
  }

  const next = nextTripStatus(trip.status);
  const paid = booking?.paymentStatus === 'paid';

  async function onEvidence(kind, file) {
    setErr('');
    try {
      const url = await fileToResizedDataUrl(file, 800, 0.85);
      attachEvidence(trip.id, kind, url);
      setMsg(`แนบหลักฐาน${kind === 'pickup' ? 'รับ' : 'ส่ง'}แล้ว`);
    } catch (e) {
      setErr(e.message);
    }
  }

  function advance() {
    setErr('');
    try {
      advanceTripStatus(trip.id);
      setMsg('อัปเดตสถานะแล้ว');
    } catch (e) {
      setErr(e.message);
    }
  }

  function sendIssue() {
    setErr('');
    if (!issueMsg.trim()) return setErr('กรอกรายละเอียดปัญหา');
    reportIssue({
      tripId: trip.id,
      driverId: currentUser.id,
      reasonId: issueReason,
      message: issueMsg.trim(),
    });
    setIssueMsg('');
    setMsg('ส่งปัญหาให้ Admin แล้ว');
    return undefined;
  }

  return (
    <section className="tp-page">
      <TransportSubnav title="Driver · Job Detail" items={NAV} />
      <h1>Job Detail</h1>
      <p className="tp-lead">
        {TRIP_TYPES[trip.type]?.label} · {booking?.petName}
      </p>
      {msg && <div className="tp-alert tp-alert--ok">{msg}</div>}
      {err && <div className="tp-alert tp-alert--danger">{err}</div>}

      {!paid && (
        <div className="tp-alert tp-alert--info">
          ยังไม่สามารถเริ่มอัปเดตสถานะได้จนกว่า Admin จะ Mark as Paid
        </div>
      )}

      <div className="tp-grid tp-grid--2">
        <div className="tp-card">
          <p className="tp-muted">จาก: {placeLabel(trip.from, transport)}</p>
          <p className="tp-muted">ถึง: {placeLabel(trip.to, transport)}</p>
          <p className="tp-muted">Owner: {booking?.ownerName} · {booking?.ownerPhone}</p>
          <p className="tp-muted">หมายเหตุสัตว์: {booking?.petNotes || '-'}</p>
          <TripStatusTimeline status={trip.status} />
          <div className="tp-actions">
            <button type="button" className="btn btn-sky" disabled={!next || !paid} onClick={advance}>
              {next ? `ถัดไป: ${next.label}` : 'เสร็จสิ้นแล้ว'}
            </button>
            <Link className="btn btn-soft" to={`/pet-transport/jobs/${trip.id}/status`}>
              หน้า Tracking
            </Link>
          </div>
        </div>

        <div className="tp-card">
          <h3>หลักฐานรับ / ส่ง</h3>
          <div className="tp-form">
            <div className="field">
              <label htmlFor="ev-pick">อัปโหลดหลักฐานรับสัตว์</label>
              <input id="ev-pick" type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && onEvidence('pickup', e.target.files[0])} />
              {trip.evidencePickup && (
                <div className="tp-evidence"><img src={trip.evidencePickup.url} alt="รับ" /></div>
              )}
            </div>
            <div className="field">
              <label htmlFor="ev-drop">อัปโหลดหลักฐานส่งสัตว์</label>
              <input id="ev-drop" type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && onEvidence('dropoff', e.target.files[0])} />
              {trip.evidenceDropoff && (
                <div className="tp-evidence"><img src={trip.evidenceDropoff.url} alt="ส่ง" /></div>
              )}
            </div>
          </div>

          <h3 style={{ marginTop: '1rem' }}>แจ้งปัญหาให้ Admin</h3>
          <div className="tp-form">
            <div className="field">
              <label htmlFor="reason">เหตุผล</label>
              <select id="reason" value={issueReason} onChange={(e) => setIssueReason(e.target.value)}>
                {ISSUE_REASONS.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="imsg">รายละเอียด</label>
              <textarea id="imsg" rows={2} value={issueMsg} onChange={(e) => setIssueMsg(e.target.value)} />
            </div>
          </div>
          <button type="button" className="btn btn-soft" onClick={sendIssue}>ส่งรายงาน</button>
        </div>
      </div>
    </section>
  );
}
