import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { fileToResizedDataUrl } from '../../../shared/utils/storage.js';
import IssueFields from '../components/IssueFields.jsx';
import PetKind from '../components/PetKind.jsx';
import { TRIP_STATUSES, nextTripStatus, tripStatusMeta } from '../constants.js';
import { placeParts } from '../store.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useTransport } from '../useTransport.js';
import '../transport.css';

const JOB_KIND = {
  pickup: 'รับขึ้นโรงแรม',
  dropoff: 'ส่งกลับบ้าน',
};

function whenLabel(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('th-TH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function phoneHref(phone) {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : '';
}

function Stop({ label, place, state }) {
  const parts = placeParts(place, state);
  return (
    <div className="driver-stop">
      <span>{label}</span>
      <strong>{parts.name || 'ไม่ระบุสถานที่'}</strong>
      <p>{parts.address || 'ยังไม่มีเลขที่อยู่'}</p>
    </div>
  );
}

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
  const trip = trips.find((item) => item.id === tripId);
  const booking = bookings.find((item) => item.id === trip?.bookingId);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [issueOpen, setIssueOpen] = useState(false);

  if (!trip) {
    return (
      <section className="tp-page driver-page">
        <p>ไม่พบงานนี้</p>
        <Link className="tp-btn" to="/pet-transport">กลับตารางงาน</Link>
      </section>
    );
  }

  if (trip.driverId !== currentUser?.id) {
    return <Navigate to="/pet-transport" replace />;
  }

  const next = nextTripStatus(trip.status);
  const meta = tripStatusMeta(trip.status);
  const paid = booking?.paymentStatus === 'paid';
  const phone = phoneHref(booking?.ownerPhone);

  async function onEvidence(kind, file) {
    setErr('');
    try {
      const url = await fileToResizedDataUrl(file, 800, 0.85);
      attachEvidence(trip.id, kind, url);
      setMsg(kind === 'pickup' ? 'แนบรูปตอนรับแล้ว' : 'แนบรูปตอนส่งแล้ว');
    } catch (error) {
      setErr(error.message);
    }
  }

  function advance() {
    setErr('');
    try {
      advanceTripStatus(trip.id);
      setMsg('อัปเดตสถานะแล้ว');
    } catch (error) {
      setErr(error.message);
    }
  }

  function submitIssue(reasonId, message) {
    reportIssue({
      tripId: trip.id,
      driverId: currentUser.id,
      reasonId,
      message,
    });
    setIssueOpen(false);
    setErr('');
    setMsg('ส่งปัญหาให้แอดมินแล้ว');
  }

  return (
    <section className="tp-page driver-page driver-detail">
      <Link className="driver-back" to="/pet-transport">
        <span aria-hidden="true">←</span>
        กลับตารางงาน
      </Link>
      {msg ? <div className="tp-alert tp-alert--ok">{msg}</div> : null}
      {err ? <div className="tp-alert tp-alert--danger">{err}</div> : null}
      {!paid ? (
        <div className="tp-alert tp-alert--info">รอแอดมินยืนยันการชำระก่อน จึงจะเริ่มอัปเดตสถานะได้</div>
      ) : null}

      <article className="driver-job driver-job--detail">
        <header>
          <div className="driver-job__who">
            {trip.pickupTime ? <time>{whenLabel(trip.pickupTime)}</time> : null}
            <strong>{booking?.petName || 'สัตว์เลี้ยง'}</strong>
            <div className="driver-job__meta">
              <em className={`driver-kind is-${trip.type}`}>{JOB_KIND[trip.type] || 'งานส่งสัตว์'}</em>
              <PetKind booking={booking} />
            </div>
          </div>
          <span className={`driver-status step-${meta.step}`}>{meta.label}</span>
        </header>
        <div className="driver-detail-bar">
          {phone ? (
            <a className="driver-call" href={phone}>โทร {booking?.ownerName || 'เจ้าของ'}</a>
          ) : (
            <span className="driver-call is-muted">ไม่มีเบอร์</span>
          )}
          <button type="button" className="tp-btn" disabled={!next || !paid} onClick={advance}>
            {next ? `อัปเดตเป็น ${next.label}` : 'ส่งแล้ว'}
          </button>
        </div>
        <div className="driver-stops">
          <Stop label="รับจาก" place={trip.from} state={transport} />
          <Stop label="ส่งที่" place={trip.to} state={transport} />
        </div>
        {booking?.petNotes ? <p className="driver-note">{booking.petNotes}</p> : null}
        <div className="driver-job__actions">
          <button
            type="button"
            className="tp-btn tp-btn--ghost"
            aria-expanded={issueOpen}
            onClick={() => setIssueOpen((open) => !open)}
          >
            แจ้งปัญหา
          </button>
        </div>
        {issueOpen ? (
          <IssueFields onClose={() => setIssueOpen(false)} onSubmit={submitIssue} />
        ) : null}
        <div className="driver-progress">
          <span>ขั้น {meta.step} จาก {TRIP_STATUSES.length}</span>
          <ol aria-label="สถานะงาน">
            {TRIP_STATUSES.map((step) => (
              <li
                key={step.id}
                className={step.step < meta.step ? 'is-done' : step.step === meta.step ? 'is-active' : ''}
                title={step.label}
              />
            ))}
          </ol>
        </div>
      </article>

      <div className="tp-card">
        <h2>แนบรูป</h2>
        <div className="tp-form">
          <div className="field">
            <label htmlFor="ev-pick">รูปตอนรับสัตว์</label>
            <input id="ev-pick" type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && onEvidence('pickup', event.target.files[0])} />
            {trip.evidencePickup ? (
              <div className="tp-evidence"><img src={trip.evidencePickup.url} alt="รูปตอนรับ" /></div>
            ) : null}
          </div>
          <div className="field">
            <label htmlFor="ev-drop">รูปตอนส่งสัตว์</label>
            <input id="ev-drop" type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && onEvidence('dropoff', event.target.files[0])} />
            {trip.evidenceDropoff ? (
              <div className="tp-evidence"><img src={trip.evidenceDropoff.url} alt="รูปตอนส่ง" /></div>
            ) : null}
          </div>
        </div>
      </div>

    </section>
  );
}
