import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { fileToResizedDataUrl } from '../../../shared/utils/storage.js';
import IssueFields from '../components/IssueFields.jsx';
import { TRIP_STATUSES, nextTripStatus, tripStatusMeta } from '../constants.js';
import { placeParts } from '../store.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { bookingPetPhotoSrc, speciesOf } from '../../pet-owner/petUtils.js';
import { useTransport } from '../useTransport.js';
import '../transport.css';

const JOB_KIND = {
  pickup: 'รับขึ้นโรงแรม',
  dropoff: 'ส่งกลับบ้าน',
};

const SPECIES_SHORT = {
  dog: 'หมา',
  cat: 'แมว',
};

const STEP_HINT = {
  assigned: 'รอเริ่มงานตามเวลานัด',
  en_route_pickup: 'กำลังมุ่งหน้าไปจุดรับ',
  arrived_pickup: 'ถึงจุดรับแล้ว รอรับน้อง',
  picked_up: 'รับน้องแล้ว พร้อมเดินทาง',
  in_transit: 'กำลังพาน้องไปปลายทาง',
  arrived_dropoff: 'ถึงจุดส่งแล้ว',
  completed: 'ส่งน้องถึงปลายทางเรียบร้อย',
};

function phoneHref(phone) {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : '';
}

function mapsHref(place) {
  const direct = String(place?.mapUrl || '').trim();
  if (direct) return direct;
  const q = String(place?.address || '').trim();
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : '';
}

function dateParts(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { day: '—', time: '' };
  }
  return {
    day: date.toLocaleDateString('th-TH', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
    time: `${date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`,
  };
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CalIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 3.5v3M16 3.5v3M4 9.5h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8.5 12.2l2.3 2.3 4.7-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5.5 19c1.6-3 4-4.5 6.5-4.5S16.9 16 18.5 19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="11" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function WarnIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4 21 20H3L12 4Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 10v4.5M12 17.5h.01" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7.5 4.5h3l1.2 3-1.8 1.2a11 11 0 0 0 5.4 5.4l1.2-1.8 3 1.2v3A1.5 1.5 0 0 1 18 18 13.5 13.5 0 0 1 4.5 4.5 1.5 1.5 0 0 1 6 3h1.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 4.5 3.5 6.5v13L9 17.5l6 2 5.5-2v-13L15 6.5 9 4.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 4.5v13M15 6.5v13" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function PhotoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="6" width="17" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12.5" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7 6 8.2 4.2h7.6L17 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 4.5h7.5L19 9v10.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14.5 4.5V9H19M9 12.5h6M9 16h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
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
      <section className="tp-page driver-page dv-light">
        <p>ไม่พบงานนี้</p>
        <Link className="dv-btn dv-btn--primary" to="/pet-transport">กลับตารางงาน</Link>
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
  const when = dateParts(trip.pickupTime);
  const from = placeParts(trip.from, transport);
  const to = placeParts(trip.to, transport);
  const mapLink = mapsHref(to.mapUrl ? to : from.mapUrl ? from : (to.address ? to : from));
  const speciesKey = booking?.petSpecies;
  const speciesLabel = SPECIES_SHORT[speciesKey] || speciesOf(speciesKey).label;
  const photo = bookingPetPhotoSrc(booking);
  const sexMark = booking?.petSex === 'female' ? '♀' : booking?.petSex === 'male' ? '♂' : '';
  const done = meta.step >= 7;

  async function onEvidence(kind, file) {
    setErr('');
    try {
      const url = await fileToResizedDataUrl(file, 800, 0.85);
      await attachEvidence(trip.id, kind, url);
      setMsg(kind === 'pickup' ? 'แนบรูปตอนรับแล้ว' : 'แนบรูปตอนส่งแล้ว');
    } catch (error) {
      setErr(error.message);
    }
  }

  async function advance() {
    setErr('');
    try {
      await advanceTripStatus(trip.id);
      setMsg('อัปเดตสถานะแล้ว');
    } catch (error) {
      setErr(error.message);
    }
  }

  async function submitIssue(reasonId, message) {
    try {
      await reportIssue({
        tripId: trip.id,
        driverId: currentUser.id,
        reasonId,
        message,
      });
      setIssueOpen(false);
      setErr('');
      setMsg('ส่งปัญหาให้แอดมินแล้ว');
    } catch (error) {
      setErr(error.message);
    }
  }

  return (
    <section className="tp-page driver-page dv-light dv-detail">
      <Link className="dv-detail__back" to="/pet-transport">
        <BackIcon />
        กลับตารางงาน
      </Link>

      {msg ? <div className="tp-alert tp-alert--ok">{msg}</div> : null}
      {err ? <div className="tp-alert tp-alert--danger">{err}</div> : null}
      {!paid ? (
        <div className="tp-alert tp-alert--info">รอแอดมินยืนยันการชำระก่อน จึงจะเริ่มอัปเดตสถานะได้</div>
      ) : null}

      <article className="dv-detail__card">
        <header className="dv-detail__head">
          <div className="dv-detail__when">
            <CalIcon />
            <div>
              <strong>{when.day}</strong>
              <span>{when.time}</span>
            </div>
          </div>
          <div className="dv-detail__title">
            <h1>งานรับ-ส่งสัตว์เลี้ยง</h1>
            <em className={`dv-chip is-${trip.type}`}>{JOB_KIND[trip.type] || 'งานส่งสัตว์'}</em>
          </div>
          <span className={`dv-appt__badge ${done ? 'is-done' : 'is-info'}`}>
            <CheckIcon />
            {meta.label}
          </span>
        </header>

        <div className="dv-detail__hero">
          <div className="dv-detail__pet">
            <img className="dv-detail__avatar" src={photo} alt="" loading="lazy" decoding="async" />
            <div>
              <strong>
                {booking?.petName || 'สัตว์เลี้ยง'}
                {sexMark ? <i className={`dv-detail__sex is-${booking?.petSex || ''}`}>{sexMark}</i> : null}
                <b className="dv-detail__species">{speciesLabel}</b>
              </strong>
              <span>โทร {booking?.ownerName || 'เจ้าของ'}</span>
            </div>
          </div>

          <div className={`dv-detail__banner ${done ? 'is-done' : 'is-live'}`}>
            <CheckIcon />
            <div>
              <strong>{meta.label}</strong>
              <span>{STEP_HINT[trip.status] || 'อัปเดตสถานะตามขั้นตอน'}</span>
            </div>
          </div>
        </div>

        <div className="dv-detail__stops">
          <div className="dv-detail__stop">
            <UserIcon />
            <div>
              <span>รับจาก</span>
              <strong>{from.name || 'ไม่ระบุสถานที่'}</strong>
              <p>{from.address || 'ยังไม่มีเลขที่อยู่'}</p>
            </div>
          </div>
          <div className="dv-detail__stop">
            <PinIcon />
            <div>
              <span>ส่งที่</span>
              <strong>{to.name || 'ไม่ระบุสถานที่'}</strong>
              <p>{to.address || 'ยังไม่มีเลขที่อยู่'}</p>
            </div>
          </div>
        </div>

        <div className="dv-detail__actions">
          <button
            type="button"
            className="dv-btn dv-btn--warn"
            aria-expanded={issueOpen}
            onClick={() => setIssueOpen((open) => !open)}
          >
            <WarnIcon />
            แจ้งปัญหา
          </button>
          {phone ? (
            <a className="dv-btn dv-btn--ghost" href={phone}>
              <PhoneIcon />
              โทรติดต่อ
            </a>
          ) : (
            <span className="dv-btn dv-btn--ghost" style={{ opacity: 0.5 }}>ไม่มีเบอร์</span>
          )}
          {mapLink ? (
            <a className="dv-btn dv-btn--ghost" href={mapLink} target="_blank" rel="noreferrer">
              <MapIcon />
              ดูเส้นทาง
            </a>
          ) : null}
          <button
            type="button"
            className="dv-btn dv-btn--primary"
            disabled={!next || !paid}
            onClick={advance}
          >
            {next ? `อัปเดตเป็น ${next.label}` : 'ส่งแล้ว'}
          </button>
        </div>

        {issueOpen ? (
          <IssueFields onClose={() => setIssueOpen(false)} onSubmit={submitIssue} />
        ) : null}

        <div className="dv-detail__progress">
          <div className="dv-detail__progress-head">
            <strong>ขั้นตอนการทำงาน</strong>
            <span>({meta.step}/{TRIP_STATUSES.length})</span>
          </div>
          <ol className="dv-detail__steps" aria-label="สถานะงาน">
            {TRIP_STATUSES.map((step, index) => {
              const state = step.step < meta.step ? 'is-done' : step.step === meta.step ? 'is-active' : '';
              return (
                <li key={step.id} className={state}>
                  {index > 0 ? <i className="dv-detail__line" aria-hidden="true" /> : null}
                  <span className="dv-detail__dot">
                    {step.step <= meta.step ? <CheckIcon /> : step.step}
                  </span>
                  <em>{step.label}</em>
                </li>
              );
            })}
          </ol>
        </div>
      </article>

      <div className="dv-detail__extras">
        <div className="dv-detail__extra">
          <header>
            <PhotoIcon />
            <div>
              <strong>แนบรูป</strong>
              <span>รูปตอนรับ-ส่งน้อง</span>
            </div>
          </header>
          <div className="dv-detail__uploads">
            <label className="dv-detail__upload">
              <span>รูปตอนรับ</span>
              <input type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && onEvidence('pickup', event.target.files[0])} />
              {trip.evidencePickup ? <img src={trip.evidencePickup.url} alt="รูปตอนรับ" /> : <PhotoIcon />}
            </label>
            <label className="dv-detail__upload">
              <span>รูปตอนส่ง</span>
              <input type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && onEvidence('dropoff', event.target.files[0])} />
              {trip.evidenceDropoff ? <img src={trip.evidenceDropoff.url} alt="รูปตอนส่ง" /> : <PhotoIcon />}
            </label>
          </div>
        </div>

        <div className="dv-detail__extra">
          <header>
            <NoteIcon />
            <div>
              <strong>รายละเอียดเพิ่มเติม</strong>
              <span>บันทึกจากเจ้าของ</span>
            </div>
          </header>
          <p>{booking?.petNotes || 'ไม่มีบันทึกเพิ่มเติม'}</p>
        </div>
      </div>
    </section>
  );
}
