import { forwardRef, useEffect, useMemo, useState } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import { th } from 'date-fns/locale/th';
import { Link } from 'react-router-dom';
import IssueFields from '../components/IssueFields.jsx';
import { nextTripStatus, tripStatusMeta } from '../constants.js';
import { placeParts, purgeDemoDriverJobs } from '../store.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { speciesOf } from '../../pet-owner/petUtils.js';
import { STORAGE_KEYS, readJSON } from '../../../shared/utils/storage.js';
import { useTransport } from '../useTransport.js';
import 'react-datepicker/dist/react-datepicker.css';
import '../transport.css';

registerLocale('th', th);

const JOB_KIND = {
  pickup: 'รับสัตว์ไปโรงแรม',
  dropoff: 'ส่งกลับบ้าน',
};

const SPECIES_SHORT = {
  dog: 'หมา',
  cat: 'แมว',
};

function findPet(petId) {
  if (!petId) return null;
  const pets = readJSON(STORAGE_KEYS.pets, []);
  return pets.find((p) => p.id === petId) || null;
}

function startOfDay(value = new Date()) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function dayOffset(value, base = new Date()) {
  const that = startOfDay(value);
  const origin = startOfDay(base);
  if (!that || !origin) return 0;
  return Math.round((that.getTime() - origin.getTime()) / 86400000);
}

function sameDay(left, right) {
  const a = startOfDay(left);
  const b = startOfDay(right);
  return Boolean(a && b && a.getTime() === b.getTime());
}

function formatThaiDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const DateTrigger = forwardRef(function DateTrigger({ label, onClick }, ref) {
  return (
    <button
      type="button"
      className="dv-date dv-date--picker"
      onClick={onClick}
      ref={ref}
      aria-label="เลือกวันที่ดูงาน"
    >
      <span aria-hidden="true">📅</span>
      <span>{label}</span>
      <span className="dv-date__caret" aria-hidden="true">▾</span>
    </button>
  );
});

function formatWhen(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.toLocaleDateString('th-TH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })} ${date.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
  })} น.`;
}

function phoneHref(phone) {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : '';
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8v4.5l3 1.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PawIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="8" cy="9" r="1.6" fill="currentColor" />
      <circle cx="12" cy="7.5" r="1.6" fill="currentColor" />
      <circle cx="16" cy="9" r="1.6" fill="currentColor" />
      <ellipse cx="12" cy="15.2" rx="3.4" ry="2.6" fill="currentColor" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-5v-5H10v5H5a1 1 0 0 1-1-1v-8.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
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

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export default function DriverSchedule() {
  const { currentUser } = useAuth();
  const transport = useTransport();
  const { tripsForDriver, advanceTripStatus, reportIssue } = transport;
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [tab, setTab] = useState('today');
  const [issueId, setIssueId] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));

  useEffect(() => {
    purgeDemoDriverJobs();
  }, []);

  const all = tripsForDriver(currentUser?.id);
  const openJobs = useMemo(
    () => all
      .filter((job) => job.status !== 'completed')
      .sort((a, b) => String(a.pickupTime).localeCompare(String(b.pickupTime))),
    [all],
  );

  const selected = selectedDate || startOfDay(new Date());
  const selectedOffset = dayOffset(selected, new Date());
  const todayJobs = openJobs.filter((job) => dayOffset(job.pickupTime) === 0);
  const tomorrowJobs = openJobs.filter((job) => dayOffset(job.pickupTime) === 1);
  const selectedJobs = openJobs.filter((job) => sameDay(job.pickupTime, selected));
  const upcoming = openJobs.filter((job) => dayOffset(job.pickupTime) > 0).length;
  const done = all.filter((job) => job.status === 'completed').length;
  const moving = todayJobs.filter((job) => {
    const step = tripStatusMeta(job.status).step;
    return step >= 2 && step < 7;
  }).length;

  const visible = tab === 'today'
    ? todayJobs
    : tab === 'tomorrow'
      ? tomorrowJobs
      : tab === 'selected'
        ? selectedJobs
        : openJobs;
  const firstName = currentUser?.firstName || 'คนขับ';
  const dateLabel = formatThaiDate(selected);

  function onPickDate(next) {
    const day = startOfDay(next || new Date());
    setSelectedDate(day);
    const offset = dayOffset(day, new Date());
    if (offset === 0) setTab('today');
    else if (offset === 1) setTab('tomorrow');
    else setTab('selected');
  }

  function pickTab(nextTab) {
    setTab(nextTab);
    if (nextTab === 'today') setSelectedDate(startOfDay(new Date()));
    else if (nextTab === 'tomorrow') {
      const tmr = startOfDay(new Date());
      tmr.setDate(tmr.getDate() + 1);
      setSelectedDate(tmr);
    }
  }

  async function markNext(job) {
    setError('');
    setNote('');
    try {
      await advanceTripStatus(job.id);
      const next = nextTripStatus(job.status);
      setNote(next ? `${job.booking?.petName} · ${next.label}` : 'อัปเดตแล้ว');
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitIssue(job, reasonId, message) {
    try {
      await reportIssue({
        tripId: job.id,
        driverId: currentUser.id,
        reasonId,
        message,
      });
      setIssueId('');
      setError('');
      setNote(`${job.booking?.petName || 'งานนี้'} · ส่งปัญหาให้แอดมินแล้ว`);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="driver-page dv-light">
      <header className="dv-hero">
        <div>
          <h1>
            สวัสดี, {firstName}
            <span aria-hidden="true"> 👋</span>
          </h1>
          <p>พร้อมดูแลน้อง ๆ ให้เดินทางปลอดภัย</p>
        </div>
      </header>

      <div className="dv-kpis">
        <article className="dv-kpi is-blue">
          <img className="dv-kpi__icon" src="/driver/kpi-pending.png" alt="" />
          <div>
            <span>งานค้างวันนี้</span>
            <strong>{todayJobs.length}</strong>
          </div>
        </article>
        <article className="dv-kpi is-orange">
          <img className="dv-kpi__icon" src="/driver/kpi-moving.png" alt="" />
          <div>
            <span>กำลังดำเนินการ</span>
            <strong>{moving}</strong>
          </div>
        </article>
        <article className="dv-kpi is-green">
          <img className="dv-kpi__icon" src="/driver/kpi-done.png" alt="" />
          <div>
            <span>ส่งแล้ว</span>
            <strong>{done}</strong>
          </div>
        </article>
        <article className="dv-kpi is-violet">
          <img className="dv-kpi__icon" src="/driver/kpi-upcoming.png" alt="" />
          <div>
            <span>จองวันหน้า</span>
            <strong>{upcoming}</strong>
          </div>
        </article>
      </div>

      <div className="dv-toolbar">
        <div className="dv-tabs" aria-label="ตัวกรองวัน">
          <button type="button" className={tab === 'today' ? 'is-active' : ''} onClick={() => pickTab('today')}>
            วันนี้ <b>{todayJobs.length}</b>
          </button>
          <button type="button" className={tab === 'tomorrow' ? 'is-active' : ''} onClick={() => pickTab('tomorrow')}>
            พรุ่งนี้ <b>{tomorrowJobs.length}</b>
          </button>
          {tab === 'selected' && selectedOffset !== 0 && selectedOffset !== 1 ? (
            <button type="button" className="is-active" onClick={() => setTab('selected')}>
              วันที่เลือก <b>{selectedJobs.length}</b>
            </button>
          ) : null}
          <button type="button" className={tab === 'all' ? 'is-active' : ''} onClick={() => pickTab('all')}>
            ทั้งหมด
          </button>
        </div>
        <DatePicker
          selected={selected}
          onChange={onPickDate}
          locale="th"
          dateFormat="dd/MM/yyyy"
          customInput={<DateTrigger label={dateLabel} />}
          calendarClassName="dv-datepicker"
          popperPlacement="bottom-end"
          showPopperArrow={false}
        />
      </div>

      {note ? <div className="tp-alert tp-alert--ok">{note}</div> : null}
      {error ? <div className="tp-alert tp-alert--danger">{error}</div> : null}

      <div className="dv-appt-list">
        {visible.map((job) => {
          const next = nextTripStatus(job.status);
          const meta = tripStatusMeta(job.status);
          const phone = phoneHref(job.booking?.ownerPhone);
          const paid = job.booking?.paymentStatus === 'paid';
          const from = placeParts(job.from, transport);
          const to = placeParts(job.to, transport);
          const pet = findPet(job.booking?.petId);
          const speciesKey = pet?.species || job.booking?.petSpecies;
          const speciesLabel = SPECIES_SHORT[speciesKey] || speciesOf(speciesKey).label;
          const breed = pet?.breed || job.booking?.petBreed || '';
          const kindLine = [speciesLabel, breed].filter(Boolean).join(' · ')
            || JOB_KIND[job.type]
            || 'สัตว์เลี้ยง';
          const photo = pet?.photo || job.booking?.petPhoto || '';
          const pendingToday = dayOffset(job.pickupTime) === 0;
          const badgeClass = meta.step >= 7 ? 'is-done' : pendingToday ? 'is-pending' : 'is-info';
          const badgeLabel = meta.step >= 2 && meta.step < 7
            ? meta.label
            : pendingToday
              ? 'งานค้างวันนี้'
              : meta.label;

          return (
            <article className={`dv-appt dv-appt--live is-${job.type}`} key={job.id}>
              <div className="dv-appt__row">
                {photo ? (
                  <img className="dv-appt__photo" src={photo} alt="" />
                ) : (
                  <span className="dv-appt__photo is-fallback" aria-hidden="true">
                    {speciesOf(speciesKey).emoji}
                  </span>
                )}

                <div className="dv-appt__info">
                  <time>
                    <ClockIcon />
                    {formatWhen(job.pickupTime)}
                  </time>
                  <strong>{job.booking?.petName || pet?.name || 'สัตว์เลี้ยง'}</strong>
                  <span className="dv-appt__kind">
                    <PawIcon />
                    {kindLine}
                  </span>
                </div>

                <div className="dv-appt__addr">
                  <div className="dv-appt__place">
                    <HomeIcon />
                    <span>รับจาก</span>
                    <strong>{from.name || 'ไม่ระบุสถานที่'}</strong>
                  </div>
                  <p>
                    <PinIcon />
                    <span>{from.address || 'ยังไม่มีที่อยู่'}</span>
                  </p>
                  <div className="dv-appt__place is-drop">
                    <HomeIcon />
                    <span>ส่งที่</span>
                    <strong>{to.name || 'ไม่ระบุสถานที่'}</strong>
                  </div>
                  <p>
                    <PinIcon />
                    <span>{to.address || 'ยังไม่มีที่อยู่'}</span>
                  </p>
                </div>

                <div className="dv-appt__side">
                  <span className={`dv-appt__badge ${badgeClass}`}>
                    <ClockIcon />
                    {badgeLabel}
                  </span>
                  <em className={`dv-chip is-${job.type}`}>{JOB_KIND[job.type] || 'งานส่งสัตว์'}</em>
                </div>
              </div>

              {!paid ? (
                <p className="dv-banner">รอตรวจสอบการชำระ</p>
              ) : (
                <p className="dv-banner is-ok">รอเข้ารับน้องตามเวลานัด และอัปเดตสถานะงาน</p>
              )}

              <footer className="dv-appt__foot">
                <div className="dv-contact">
                  <strong>{job.booking?.ownerName || 'เจ้าของ'}</strong>
                  {phone ? (
                    <a className="dv-phone" href={phone}>{job.booking.ownerPhone}</a>
                  ) : (
                    <span className="dv-phone is-muted">ไม่มีเบอร์</span>
                  )}
                </div>
                <div className="dv-actions">
                  <button
                    type="button"
                    className="dv-btn dv-btn--primary"
                    disabled={!next || !paid}
                    onClick={() => markNext(job)}
                  >
                    {next ? next.label : 'ส่งแล้ว'}
                  </button>
                  <Link className="dv-appt__detail" to={`/pet-transport/jobs/${job.id}`}>
                    <EyeIcon />
                    ดูรายละเอียด
                    <span aria-hidden="true">›</span>
                  </Link>
                  <button
                    type="button"
                    className="dv-btn dv-btn--warn"
                    aria-expanded={issueId === job.id}
                    onClick={() => setIssueId(issueId === job.id ? '' : job.id)}
                  >
                    แจ้งปัญหา
                  </button>
                </div>
              </footer>

              {issueId === job.id ? (
                <IssueFields
                  onClose={() => setIssueId('')}
                  onSubmit={(reasonId, message) => submitIssue(job, reasonId, message)}
                />
              ) : null}
            </article>
          );
        })}

        {!visible.length ? (
          <div className="dv-empty">
            {tab === 'today'
              ? 'วันนี้ยังไม่มีงานค้าง'
              : tab === 'tomorrow'
                ? 'พรุ่งนี้ยังไม่มีงาน'
                : tab === 'selected'
                  ? `ไม่มีงานในวันที่ ${dateLabel}`
                  : 'ยังไม่มีงานที่ได้รับมอบหมาย'}
            <small>รอ Admin Assign จากรายการจองของ Owner แล้วงานจะขึ้นที่นี่</small>
          </div>
        ) : null}
      </div>
    </section>
  );
}
